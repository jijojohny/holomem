"""LangGraph BaseStore adapter — use HoloMem as the memory backend for LangGraph agents."""
from __future__ import annotations

import json
from typing import Any, Iterable, Optional, Sequence

from .client import HoloMem
from .async_client import AsyncHoloMem


def _namespace_to_session(namespace: tuple[str, ...]) -> str:
    return "/".join(namespace) if namespace else "__default__"


def _session_to_namespace(session_id: str) -> tuple[str, ...]:
    return tuple(session_id.split("/"))


class HoloMemStore:
    """
    LangGraph BaseStore backed by HoloMem encrypted memory.

    Namespace tuples are joined with "/" and stored as session_ids.
    The item key is stored inside the JSON payload under "__key__".

    Usage::

        from holomem.langgraph import HoloMemStore

        store = HoloMemStore(api_key="hm_live_xxx", encryption_key="your-hex-key")

        # Use with LangGraph
        builder = StateGraph(State)
        builder.compile(store=store)
    """

    def __init__(
        self,
        api_key: str,
        encryption_key: Optional[str] = None,
        base_url: str = "https://api.holomem.io",
        ttl: str = "episodic",
    ) -> None:
        self._sync = HoloMem(api_key=api_key, encryption_key=encryption_key, base_url=base_url)
        self._async = AsyncHoloMem(api_key=api_key, encryption_key=encryption_key, base_url=base_url)
        self._ttl = ttl

    # ── LangGraph BaseStore interface ──────────────────────────────────────────

    def batch(self, ops: Iterable[Any]) -> list[Any]:
        """Process a batch of operations synchronously."""
        results = []
        for op in ops:
            results.append(self._handle_op_sync(op))
        return results

    async def abatch(self, ops: Iterable[Any]) -> list[Any]:
        """Process a batch of operations asynchronously."""
        results = []
        for op in ops:
            results.append(await self._handle_op_async(op))
        return results

    # ── Sync helpers ───────────────────────────────────────────────────────────

    def _handle_op_sync(self, op: Any) -> Any:
        op_type = type(op).__name__

        if op_type == "GetOp":
            return self._get_sync(op.namespace, op.key)
        elif op_type == "PutOp":
            return self._put_sync(op.namespace, op.key, op.value)
        elif op_type == "SearchOp":
            return self._search_sync(op.namespace_prefix, query=getattr(op, "query", None), limit=getattr(op, "limit", 10))
        elif op_type == "ListNamespacesOp":
            return self._list_namespaces_sync(
                prefix=getattr(op, "prefix", None),
                suffix=getattr(op, "suffix", None),
                max_depth=getattr(op, "max_depth", None),
                limit=getattr(op, "limit", 100),
            )
        return None

    def _get_sync(self, namespace: tuple[str, ...], key: str) -> Optional[Any]:
        session_id = _namespace_to_session(namespace)
        memories = self._sync.recall(session_id)
        for mem in memories:
            try:
                data = json.loads(mem.plaintext)
                if data.get("__key__") == key:
                    return _make_item(namespace, key, data)
            except Exception:
                pass
        return None

    def _put_sync(self, namespace: tuple[str, ...], key: str, value: Optional[dict[str, Any]]) -> None:
        session_id = _namespace_to_session(namespace)
        if value is None:
            # Delete: find memory with __key__ and soft-delete it
            memories = self._sync.recall(session_id)
            for mem in memories:
                try:
                    data = json.loads(mem.plaintext)
                    if data.get("__key__") == key:
                        self._sync.delete(mem.entity_key)
                        return
                except Exception:
                    pass
        else:
            payload = {"__key__": key, **value}
            self._sync.write(session_id, json.dumps(payload), ttl=self._ttl)

    def _search_sync(self, namespace_prefix: tuple[str, ...], *, query: Optional[str], limit: int) -> list[Any]:
        prefix = _namespace_to_session(namespace_prefix)
        sessions = self._sync.list_sessions()
        results = []
        for s in sessions:
            if not s.session_id.startswith(prefix):
                continue
            namespace = _session_to_namespace(s.session_id)
            memories = self._sync.recall(s.session_id, limit=limit)
            for mem in memories:
                try:
                    data = json.loads(mem.plaintext)
                    if query and query.lower() not in mem.plaintext.lower():
                        continue
                    key = data.get("__key__", mem.entity_key)
                    results.append(_make_item(namespace, key, data))
                    if len(results) >= limit:
                        return results
                except Exception:
                    pass
        return results

    def _list_namespaces_sync(
        self,
        *,
        prefix: Optional[tuple[str, ...]],
        suffix: Optional[tuple[str, ...]],
        max_depth: Optional[int],
        limit: int,
    ) -> list[tuple[str, ...]]:
        sessions = self._sync.list_sessions()
        namespaces = []
        prefix_str = _namespace_to_session(prefix) if prefix else None
        for s in sessions:
            ns = _session_to_namespace(s.session_id)
            if prefix_str and not s.session_id.startswith(prefix_str):
                continue
            if suffix and not ns[-len(suffix):] == suffix:
                continue
            if max_depth is not None:
                ns = ns[:max_depth]
            if ns not in namespaces:
                namespaces.append(ns)
            if len(namespaces) >= limit:
                break
        return namespaces

    # ── Async helpers ──────────────────────────────────────────────────────────

    async def _handle_op_async(self, op: Any) -> Any:
        op_type = type(op).__name__

        if op_type == "GetOp":
            return await self._get_async(op.namespace, op.key)
        elif op_type == "PutOp":
            return await self._put_async(op.namespace, op.key, op.value)
        elif op_type == "SearchOp":
            return await self._search_async(op.namespace_prefix, query=getattr(op, "query", None), limit=getattr(op, "limit", 10))
        elif op_type == "ListNamespacesOp":
            return await self._list_namespaces_async(
                prefix=getattr(op, "prefix", None),
                suffix=getattr(op, "suffix", None),
                max_depth=getattr(op, "max_depth", None),
                limit=getattr(op, "limit", 100),
            )
        return None

    async def _get_async(self, namespace: tuple[str, ...], key: str) -> Optional[Any]:
        session_id = _namespace_to_session(namespace)
        memories = await self._async.recall(session_id)
        for mem in memories:
            try:
                data = json.loads(mem.plaintext)
                if data.get("__key__") == key:
                    return _make_item(namespace, key, data)
            except Exception:
                pass
        return None

    async def _put_async(self, namespace: tuple[str, ...], key: str, value: Optional[dict[str, Any]]) -> None:
        session_id = _namespace_to_session(namespace)
        if value is None:
            memories = await self._async.recall(session_id)
            for mem in memories:
                try:
                    data = json.loads(mem.plaintext)
                    if data.get("__key__") == key:
                        await self._async.delete(mem.entity_key)
                        return
                except Exception:
                    pass
        else:
            payload = {"__key__": key, **value}
            await self._async.write(session_id, json.dumps(payload), ttl=self._ttl)

    async def _search_async(self, namespace_prefix: tuple[str, ...], *, query: Optional[str], limit: int) -> list[Any]:
        prefix = _namespace_to_session(namespace_prefix)
        sessions = await self._async.list_sessions()
        results = []
        for s in sessions:
            if not s.session_id.startswith(prefix):
                continue
            namespace = _session_to_namespace(s.session_id)
            memories = await self._async.recall(s.session_id, limit=limit)
            for mem in memories:
                try:
                    data = json.loads(mem.plaintext)
                    if query and query.lower() not in mem.plaintext.lower():
                        continue
                    key = data.get("__key__", mem.entity_key)
                    results.append(_make_item(namespace, key, data))
                    if len(results) >= limit:
                        return results
                except Exception:
                    pass
        return results

    async def _list_namespaces_async(
        self,
        *,
        prefix: Optional[tuple[str, ...]],
        suffix: Optional[tuple[str, ...]],
        max_depth: Optional[int],
        limit: int,
    ) -> list[tuple[str, ...]]:
        sessions = await self._async.list_sessions()
        namespaces = []
        prefix_str = _namespace_to_session(prefix) if prefix else None
        for s in sessions:
            ns = _session_to_namespace(s.session_id)
            if prefix_str and not s.session_id.startswith(prefix_str):
                continue
            if suffix and not ns[-len(suffix):] == suffix:
                continue
            if max_depth is not None:
                ns = ns[:max_depth]
            if ns not in namespaces:
                namespaces.append(ns)
            if len(namespaces) >= limit:
                break
        return namespaces


def _make_item(namespace: tuple[str, ...], key: str, data: dict[str, Any]) -> dict[str, Any]:
    value = {k: v for k, v in data.items() if k != "__key__"}
    return {"namespace": namespace, "key": key, "value": value}
