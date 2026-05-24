from __future__ import annotations

import warnings
from dataclasses import dataclass
from typing import Callable, Literal, Optional
from urllib.parse import quote

import httpx

from .crypto import generate_encryption_key, encrypt_memory, decrypt_memory

TtlTier = Literal["working", "episodic", "persistent"]
_API_BASE = "https://api.holomem.io"


@dataclass
class SearchResult:
    entity_key: str
    session_id: str
    agent_id: Optional[str]
    ttl_tier: str
    created_at: str
    expires_at: str
    pinned: bool
    score: float
    plaintext: str


@dataclass
class Memory:
    entity_key: str
    agent_id: str
    plaintext: str


@dataclass
class SessionEntry:
    session_id: str
    memory_count: int
    last_activity: str


@dataclass
class MemoryIndexEntry:
    entity_key: str
    session_id: str
    agent_id: Optional[str]
    ttl_tier: str
    created_at: str
    expires_at: str
    pinned: bool = False


class HoloMem:
    """
    Encrypted memory client for AI agents.

    Usage::

        mem = HoloMem(api_key="hm_live_xxx", encryption_key="your-hex-key")
        key = mem.write("session-001", "User wants to book a flight to Tokyo")
        memories = mem.recall("session-001")
    """

    def __init__(
        self,
        api_key: str,
        encryption_key: Optional[str] = None,
        base_url: str = _API_BASE,
        timeout: float = 30.0,
        embed: Optional[Callable[[str], list[float]]] = None,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._embed = embed
        self._http = httpx.Client(
            base_url=self._base_url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            timeout=timeout,
        )

        if encryption_key:
            self._priv_hex = encryption_key
            from ecies.utils import generate_key
            from coincurve import PublicKey
            priv_bytes = bytes.fromhex(encryption_key)
            self._pub_hex = PublicKey.from_valid_secret(priv_bytes).format(compressed=True).hex()
        else:
            warnings.warn(
                "No encryption_key provided — generating ephemeral key. "
                "Memories written in this session cannot be recalled after restart. "
                "Pass encryption_key= to HoloMem for persistence.",
                UserWarning,
                stacklevel=2,
            )
            self._priv_hex, self._pub_hex = generate_encryption_key()

    @property
    def encryption_key(self) -> str:
        """The private key hex — persist this to recall memories across sessions."""
        return self._priv_hex

    def write(
        self,
        session_id: str,
        plaintext: str,
        *,
        agent_id: Optional[str] = None,
        ttl: TtlTier = "episodic",
    ) -> str:
        """Encrypt and store a memory. Returns the entity key."""
        ciphertext = encrypt_memory(plaintext, self._pub_hex)
        embedding = self._embed(plaintext) if self._embed else None
        resp = self._http.post(
            "/v1/memories",
            json={
                "session_id": session_id,
                "ciphertext": ciphertext,
                "ttl_tier": ttl,
                "agent_id": agent_id,
                "embedding": embedding,
            },
        )
        resp.raise_for_status()
        return resp.json()["entity_key"]

    def read(self, entity_key: str) -> Optional[str]:
        """Fetch and decrypt a single memory by key. Returns None if expired."""
        resp = self._http.get(f"/v1/memories/{entity_key}")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()
        if not data.get("ciphertext"):
            return None
        return decrypt_memory(data["ciphertext"], self._priv_hex)

    def recall(self, session_id: str, *, limit: int = 20) -> list[Memory]:
        """Fetch and decrypt all memories in a session."""
        resp = self._http.post(
            "/v1/memories/recall",
            json={"session_id": session_id, "limit": limit},
        )
        resp.raise_for_status()
        results = []
        for m in resp.json().get("memories", []):
            if not m.get("ciphertext"):
                continue
            try:
                plaintext = decrypt_memory(m["ciphertext"], self._priv_hex)
                results.append(Memory(
                    entity_key=m["entity_key"],
                    agent_id=m.get("agent_id", ""),
                    plaintext=plaintext,
                ))
            except Exception:
                pass  # skip memories encrypted with a different key
        return results

    def usage(self) -> dict:
        """Return current billing period usage for this API key."""
        resp = self._http.get("/v1/usage")
        resp.raise_for_status()
        return resp.json()

    def delete(self, entity_key: str) -> None:
        """Soft-delete a memory (marks deleted in index; Arkiv TTL handles on-chain)."""
        resp = self._http.delete(f"/v1/memories/{entity_key}")
        if resp.status_code != 404:
            resp.raise_for_status()

    def list_sessions(self) -> list[SessionEntry]:
        """List all sessions with memory counts."""
        resp = self._http.get("/v1/sessions")
        resp.raise_for_status()
        return [
            SessionEntry(
                session_id=s["session_id"],
                memory_count=s["memory_count"],
                last_activity=s["last_activity"],
            )
            for s in resp.json().get("sessions", [])
        ]

    def delete_session(self, session_id: str) -> int:
        """Bulk soft-delete all memories in a session. Returns count deleted."""
        resp = self._http.delete(f"/v1/sessions/{quote(session_id, safe='')}")
        resp.raise_for_status()
        return resp.json().get("deleted", 0)

    def write_many(
        self,
        session_id: str,
        texts: list[str],
        *,
        agent_id: Optional[str] = None,
        ttl: TtlTier = "episodic",
    ) -> list[str]:
        """Encrypt and store multiple memories. Returns list of entity keys."""
        return [self.write(session_id, text, agent_id=agent_id, ttl=ttl) for text in texts]

    def list_memories(
        self,
        *,
        session_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        limit: int = 100,
    ) -> list[MemoryIndexEntry]:
        """List memory metadata (no decryption) with optional session/agent filters."""
        params: dict[str, str] = {"limit": str(limit)}
        if session_id:
            params["session_id"] = session_id
        if agent_id:
            params["agent_id"] = agent_id
        resp = self._http.get("/v1/memories", params=params)
        resp.raise_for_status()
        return [
            MemoryIndexEntry(
                entity_key=m["entity_key"],
                session_id=m["session_id"],
                agent_id=m.get("agent_id"),
                ttl_tier=m["ttl_tier"],
                created_at=m["created_at"],
                expires_at=m["expires_at"],
                pinned=m.get("pinned", False),
            )
            for m in resp.json().get("memories", [])
        ]

    def pin(self, entity_key: str) -> None:
        """Pin a memory to prevent TTL expiry."""
        resp = self._http.patch(f"/v1/memories/{entity_key}", json={"pinned": True})
        resp.raise_for_status()

    def unpin(self, entity_key: str) -> None:
        """Unpin a memory, allowing normal TTL expiry."""
        resp = self._http.patch(f"/v1/memories/{entity_key}", json={"pinned": False})
        resp.raise_for_status()

    def search(
        self,
        query_text: str,
        *,
        session_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        limit: int = 10,
        threshold: float = 0.7,
    ) -> list[SearchResult]:
        """Embed query client-side and find similar memories by cosine similarity."""
        if not self._embed:
            raise ValueError("search() requires an embed= callback — pass embed=fn to HoloMem")
        embedding = self._embed(query_text)
        resp = self._http.post(
            "/v1/memories/search",
            json={
                "embedding": embedding,
                "session_id": session_id,
                "agent_id": agent_id,
                "limit": limit,
                "threshold": threshold,
            },
        )
        resp.raise_for_status()
        results = []
        for m in resp.json().get("memories", []):
            if not m.get("ciphertext"):
                continue
            try:
                plaintext = decrypt_memory(m["ciphertext"], self._priv_hex)
                results.append(SearchResult(
                    entity_key=m["entity_key"],
                    session_id=m["session_id"],
                    agent_id=m.get("agent_id"),
                    ttl_tier=m["ttl_tier"],
                    created_at=m["created_at"],
                    expires_at=m["expires_at"],
                    pinned=m.get("pinned", False),
                    score=m["score"],
                    plaintext=plaintext,
                ))
            except Exception:
                pass
        return results

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "HoloMem":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
