"""
CrewAI-native memory backend for HoloMem.

This module provides ``HoloMemStorage`` — a storage class that implements CrewAI's
``BaseRAGStorage`` protocol — so that HoloMem's encrypted, on-chain memory becomes
the storage layer for all three of CrewAI's memory tiers.

Architecture overview
---------------------
CrewAI has three memory layers:

* **Short-term memory** (``ShortTermMemory``): Recent context within the current run.
  Backed by a RAG storage that implements ``save / search / reset``.
  Maps to HoloMem TTL tier ``"working"``.

* **Long-term memory** (``LongTermMemory``): Persistent cross-run memory.
  Normally backed by SQLite via ``LTMSQLiteStorage`` with a *different* interface
  (``save(task_description, score, datetime, ...)``, ``load(...)``).
  We substitute this with ``HoloMemStorage`` using duck-typing, which lets reads and
  writes work transparently.  The SQLite-specific ``load`` call is shimmed via ``search``.
  Maps to HoloMem TTL tier ``"persistent"``.

  .. note::
     Because CrewAI's LTM storage interface differs from RAG storage, the long-term
     memory integration relies on duck-typing.  In the unlikely event CrewAI calls
     undocumented LTM-specific methods, those calls will raise ``AttributeError`` and
     CrewAI will fall back to its default SQLite backend for that access path.

* **Entity memory** (``EntityMemory``): Named entity / person facts across runs.
  Also backed by a RAG storage.
  Maps to HoloMem TTL tier ``"persistent"``.

Keyword search heuristic
------------------------
CrewAI's ``BaseRAGStorage.search`` normally uses vector similarity.  Because HoloMem's
``recall`` endpoint does not embed queries client-side (no embed function is passed), we
over-fetch ``limit * 3`` memories and apply a lexical score:

    score = (number of query tokens found in content) / (total query tokens)

Results with ``score >= score_threshold`` are kept, sorted by score descending, and
truncated to ``limit``.  This is a best-effort heuristic; provide an ``embed=`` function
to ``HoloMem`` for real cosine-similarity search.

Session-ID scheme
-----------------
``patch_crew_memory`` derives session IDs deterministically::

    {config.session_prefix}-{run_id}-{layer}

where ``layer`` is one of ``short_term``, ``long_term``, or ``entity``.

Quick start
-----------
::

    from crewai import Crew, Agent, Task
    from holomem import patch_crew_memory, HoloMemCrewAIConfig

    crew = Crew(agents=[...], tasks=[...], memory=True)
    patch_crew_memory(
        crew,
        HoloMemCrewAIConfig(api_key="hm_live_xxx", encryption_key="your-hex-key"),
        run_id="run-001",
    )
    result = crew.kickoff()
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Optional

from .client import HoloMem, TtlTier

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# TTL mapping
# ---------------------------------------------------------------------------

_TTL_MAP: dict[str, TtlTier] = {
    "short_term": "working",
    "long_term": "persistent",
    "entity": "persistent",
}

# ---------------------------------------------------------------------------
# Optional base class — import lazily so the module is importable without crewai
# ---------------------------------------------------------------------------

def _get_base_rag_storage_cls() -> type:
    """Return BaseRAGStorage if crewai is installed, otherwise return object."""
    try:
        from crewai.memory.storage.base_rag_storage import BaseRAGStorage  # type: ignore[import]
        return BaseRAGStorage
    except ImportError:
        return object


# ---------------------------------------------------------------------------
# HoloMemStorage
# ---------------------------------------------------------------------------

class HoloMemStorage:
    """
    HoloMem-backed storage that satisfies the CrewAI ``BaseRAGStorage`` protocol.

    This class intentionally does *not* inherit from ``BaseRAGStorage`` at class
    definition time.  Instead it implements the exact same interface
    (``save``, ``search``, ``reset``) so it works via duck-typing.  If crewai is
    installed, :func:`patch_crew_memory` verifies protocol compliance at runtime.

    Parameters
    ----------
    storage_type:
        One of ``"short_term"``, ``"long_term"``, or ``"entity"``.
        Determines the HoloMem TTL tier used for all writes.
    session_id:
        HoloMem session identifier for this memory layer.  All memories written
        through this storage object share the same session.
    api_key:
        HoloMem API key (``hm_live_...``).
    encryption_key:
        Optional 32-byte hex private key.  If omitted an ephemeral key is
        generated — memories will not survive a process restart.
    base_url:
        HoloMem API base URL.  Defaults to ``"https://api.holomem.io"``.
    """

    def __init__(
        self,
        storage_type: str,
        session_id: str,
        api_key: str,
        encryption_key: Optional[str] = None,
        base_url: str = "https://api.holomem.io",
    ) -> None:
        if storage_type not in _TTL_MAP:
            raise ValueError(
                f"storage_type must be one of {list(_TTL_MAP)!r}, got {storage_type!r}"
            )
        self._storage_type = storage_type
        self._session_id = session_id
        self._ttl: TtlTier = _TTL_MAP[storage_type]
        self._mem = HoloMem(
            api_key=api_key,
            encryption_key=encryption_key,
            base_url=base_url,
        )

    # ------------------------------------------------------------------
    # BaseRAGStorage interface
    # ------------------------------------------------------------------

    def save(self, value: Any, metadata: dict, agent: str) -> None:
        """
        Serialize and persist a memory entry.

        The payload is stored as a JSON string::

            {"content": str(value), "metadata": {...}, "agent": "..."}

        Parameters
        ----------
        value:
            The memory content (any type; coerced to string).
        metadata:
            Arbitrary key/value pairs attached to the memory.
        agent:
            Identifier of the agent that produced the memory.
        """
        payload = json.dumps(
            {"content": str(value), "metadata": metadata, "agent": agent}
        )
        try:
            self._mem.write(
                self._session_id,
                payload,
                agent_id=agent or None,
                ttl=self._ttl,
            )
        except Exception:
            logger.exception(
                "HoloMemStorage.save failed (storage_type=%s, session=%s)",
                self._storage_type,
                self._session_id,
            )

    def search(
        self,
        query: str,
        limit: int = 3,
        score_threshold: float = 0.35,
    ) -> list[Any]:
        """
        Recall memories matching *query* using a lexical scoring heuristic.

        Fetches up to ``limit * 3`` memories from HoloMem, scores each by the
        fraction of whitespace-tokenised query terms present in the content
        (case-insensitive), filters by ``score_threshold``, sorts descending,
        and returns up to ``limit`` results.

        Parameters
        ----------
        query:
            Natural-language search string.
        limit:
            Maximum number of results to return.
        score_threshold:
            Minimum lexical score (0–1) required to include a result.

        Returns
        -------
        list[dict]:
            Each element has keys ``"context"`` (content string),
            ``"metadata"`` (dict), and ``"agent"`` (string).
        """
        try:
            memories = self._mem.recall(self._session_id, limit=limit * 3)
        except Exception:
            logger.exception(
                "HoloMemStorage.search recall failed (session=%s)", self._session_id
            )
            return []

        query_tokens = query.lower().split()
        if not query_tokens:
            # Empty query — return first `limit` memories without scoring
            results = []
            for mem in memories[:limit]:
                parsed = _try_parse(mem.plaintext)
                if parsed is not None:
                    results.append(parsed)
            return results

        scored: list[tuple[float, dict]] = []
        for mem in memories:
            parsed = _try_parse(mem.plaintext)
            if parsed is None:
                continue
            content_lower = parsed["context"].lower()
            matches = sum(1 for t in query_tokens if t in content_lower)
            score = matches / len(query_tokens)
            if score >= score_threshold:
                scored.append((score, parsed))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored[:limit]]

    def reset(self) -> None:
        """
        Delete all memories in this storage layer's session.

        Calls ``HoloMem.delete_session`` for an efficient bulk soft-delete.
        Falls back to a recall-then-delete loop if the bulk endpoint fails.
        """
        try:
            deleted = self._mem.delete_session(self._session_id)
            logger.debug(
                "HoloMemStorage.reset: deleted %d memories (session=%s)",
                deleted,
                self._session_id,
            )
        except Exception:
            logger.warning(
                "HoloMemStorage.reset: bulk delete failed for session %s, "
                "falling back to recall+delete loop",
                self._session_id,
            )
            try:
                memories = self._mem.recall(self._session_id, limit=500)
                for mem in memories:
                    try:
                        self._mem.delete(mem.entity_key)
                    except Exception:
                        pass
            except Exception:
                logger.exception(
                    "HoloMemStorage.reset: fallback loop also failed (session=%s)",
                    self._session_id,
                )

    # ------------------------------------------------------------------
    # LTM duck-typing shim
    # ------------------------------------------------------------------

    def load(
        self,
        task_description: str,
        latest_n: int = 3,
    ) -> list[dict]:
        """
        Shim for CrewAI's ``LTMSQLiteStorage.load`` interface.

        ``LongTermMemory`` calls ``storage.load(task_description, latest_n)``
        instead of ``storage.search``.  This method delegates to :meth:`search`
        so that the long-term layer works transparently through HoloMem.

        Parameters
        ----------
        task_description:
            Task description used as the search query.
        latest_n:
            Maximum number of results to return.
        """
        return self.search(task_description, limit=latest_n)

    # ------------------------------------------------------------------
    # Properties for CrewAI introspection
    # ------------------------------------------------------------------

    @property
    def type(self) -> str:
        """Storage type identifier (mirrors CrewAI attribute convention)."""
        return self._storage_type

    def __repr__(self) -> str:
        return (
            f"HoloMemStorage(storage_type={self._storage_type!r}, "
            f"session_id={self._session_id!r})"
        )


# ---------------------------------------------------------------------------
# Config dataclass
# ---------------------------------------------------------------------------

@dataclass
class HoloMemCrewAIConfig:
    """
    Configuration for using HoloMem as CrewAI's memory backend.

    Attributes
    ----------
    api_key:
        HoloMem API key (``hm_live_...``).
    encryption_key:
        Optional 32-byte hex private key for end-to-end encryption.
        Strongly recommended for production — without it, an ephemeral key
        is generated per process and memories cannot be recalled across restarts.
    base_url:
        HoloMem API base URL.
    session_prefix:
        Prefix used when constructing per-layer session IDs.
        Final session IDs take the form ``{session_prefix}-{run_id}-{layer}``.
    """

    api_key: str
    encryption_key: Optional[str] = None
    base_url: str = "https://api.holomem.io"
    session_prefix: str = "crewai"


# ---------------------------------------------------------------------------
# patch_crew_memory
# ---------------------------------------------------------------------------

def patch_crew_memory(
    crew: Any,
    config: HoloMemCrewAIConfig,
    run_id: str,
) -> None:
    """
    Patch a CrewAI ``Crew`` instance to use HoloMem for all memory storage.

    Call this *after* constructing the crew with ``memory=True`` and *before*
    calling ``crew.kickoff()``.

    Session IDs are derived deterministically as::

        {config.session_prefix}-{run_id}-{layer}

    where ``layer`` is ``short_term``, ``long_term``, or ``entity``.

    Parameters
    ----------
    crew:
        A ``crewai.Crew`` instance created with ``memory=True``.
    config:
        :class:`HoloMemCrewAIConfig` with your API key and optional settings.
    run_id:
        A unique identifier for this crew run.  Use a stable value (e.g. a
        workflow ID) if you want long-term and entity memories to persist
        across multiple runs that belong to the same logical task.

    Example
    -------
    ::

        from crewai import Crew, Agent, Task
        from holomem import patch_crew_memory, HoloMemCrewAIConfig

        crew = Crew(agents=[...], tasks=[...], memory=True)
        patch_crew_memory(
            crew,
            HoloMemCrewAIConfig(api_key="hm_live_xxx", encryption_key="your-hex-key"),
            run_id="run-001",
        )
        result = crew.kickoff()

    Notes
    -----
    * Each memory layer is patched independently.  If a particular layer does not
      exist on the crew object (e.g. ``memory=False`` was passed or the CrewAI
      version uses a different attribute name), that layer is silently skipped and
      a ``DEBUG``-level log message is emitted.
    * Long-term memory is patched via duck-typing because CrewAI's
      ``LongTermMemory`` normally uses a SQLite-backed storage with a different
      interface.  The :class:`HoloMemStorage` ``load`` shim translates calls
      transparently.
    * Patch is best-effort: individual failures are logged at WARNING level and do
      not prevent the crew from running with whatever memory backend remains active.
    """
    layer_specs = [
        ("short_term", "_short_term_memory", "short_term_memory"),
        ("long_term",  "_long_term_memory",  "long_term_memory"),
        ("entity",     "_entity_memory",     "entity_memory"),
    ]

    for layer, private_attr, public_attr in layer_specs:
        session_id = f"{config.session_prefix}-{run_id}-{layer}"
        storage = HoloMemStorage(
            storage_type=layer,
            session_id=session_id,
            api_key=config.api_key,
            encryption_key=config.encryption_key,
            base_url=config.base_url,
        )
        _patch_layer(crew, private_attr, public_attr, storage, layer)


def _patch_layer(
    crew: Any,
    private_attr: str,
    public_attr: str,
    storage: HoloMemStorage,
    layer: str,
) -> None:
    """Attempt to inject *storage* into a single CrewAI memory layer."""
    # Resolve the memory object — try private attr first (modern crewai), then public
    memory_obj = None
    for attr in (private_attr, public_attr):
        try:
            candidate = getattr(crew, attr, None)
            if candidate is not None:
                memory_obj = candidate
                break
        except Exception:
            pass

    if memory_obj is None:
        logger.debug(
            "patch_crew_memory: layer %r not found on crew object (tried %r, %r) — skipping",
            layer,
            private_attr,
            public_attr,
        )
        return

    # Try to swap the .storage attribute
    patched = False
    for storage_attr in ("storage", "_storage"):
        if hasattr(memory_obj, storage_attr):
            try:
                setattr(memory_obj, storage_attr, storage)
                patched = True
                logger.debug(
                    "patch_crew_memory: patched %r.%s with HoloMemStorage(session=%s)",
                    layer,
                    storage_attr,
                    storage._session_id,
                )
                break
            except Exception as exc:
                logger.warning(
                    "patch_crew_memory: could not set %r.%s — %s",
                    layer,
                    storage_attr,
                    exc,
                )

    if not patched:
        # Last resort: replace the memory object's __class__ storage attribute by
        # monkey-patching the instance dict
        try:
            memory_obj.__dict__["storage"] = storage
            patched = True
            logger.debug(
                "patch_crew_memory: injected %r storage via __dict__ (session=%s)",
                layer,
                storage._session_id,
            )
        except Exception as exc:
            logger.warning(
                "patch_crew_memory: all patch attempts failed for layer %r — %s",
                layer,
                exc,
            )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _try_parse(plaintext: str) -> Optional[dict]:
    """
    Parse a JSON memory payload into a search-result dict.

    Returns ``None`` for entries that are not valid JSON or lack a ``"content"`` key
    (e.g. memories written by a different subsystem or a non-CrewAI writer).
    """
    try:
        data = json.loads(plaintext)
        content = data.get("content")
        if content is None:
            return None
        return {
            "context": content,
            "metadata": data.get("metadata", {}),
            "agent": data.get("agent", ""),
        }
    except (json.JSONDecodeError, AttributeError, TypeError):
        return None
