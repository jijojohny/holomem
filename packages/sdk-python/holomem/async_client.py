from __future__ import annotations

import asyncio
import warnings
from typing import Awaitable, Callable, Literal, Optional, Union
from urllib.parse import quote

import httpx

from .crypto import generate_encryption_key, encrypt_memory, decrypt_memory
from .client import Memory, SessionEntry, MemoryIndexEntry, SearchResult

TtlTier = Literal["working", "episodic", "persistent"]
_API_BASE = "https://api.holomem.io"


class AsyncHoloMem:
    """
    Async encrypted memory client for AI agents.

    Usage::

        async with AsyncHoloMem(api_key="hm_live_xxx", encryption_key="your-hex-key") as mem:
            key = await mem.write("session-001", "User wants to book a flight to Tokyo")
            memories = await mem.recall("session-001")

    Works with asyncio-based agent frameworks (LangGraph, CrewAI async, AutoGen).
    """

    def __init__(
        self,
        api_key: str,
        encryption_key: Optional[str] = None,
        base_url: str = _API_BASE,
        timeout: float = 30.0,
        embed: Optional[Callable[[str], Union[list[float], Awaitable[list[float]]]]] = None,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._embed = embed
        self._http = httpx.AsyncClient(
            base_url=self._base_url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            timeout=timeout,
        )

        if encryption_key:
            self._priv_hex = encryption_key
            from coincurve import PublicKey
            priv_bytes = bytes.fromhex(encryption_key)
            self._pub_hex = PublicKey.from_valid_secret(priv_bytes).format(compressed=True).hex()
        else:
            warnings.warn(
                "No encryption_key provided — generating ephemeral key. "
                "Memories written in this session cannot be recalled after restart. "
                "Pass encryption_key= to AsyncHoloMem for persistence.",
                UserWarning,
                stacklevel=2,
            )
            self._priv_hex, self._pub_hex = generate_encryption_key()

    @property
    def encryption_key(self) -> str:
        """The private key hex — persist this to recall memories across sessions."""
        return self._priv_hex

    async def _get_embedding(self, text: str) -> Optional[list[float]]:
        if not self._embed:
            return None
        result = self._embed(text)
        if asyncio.iscoroutine(result):
            return await result
        return result  # type: ignore[return-value]

    async def write(
        self,
        session_id: str,
        plaintext: str,
        *,
        agent_id: Optional[str] = None,
        ttl: TtlTier = "episodic",
    ) -> str:
        """Encrypt and store a memory. Returns the entity key."""
        ciphertext = encrypt_memory(plaintext, self._pub_hex)
        embedding = await self._get_embedding(plaintext)
        resp = await self._http.post(
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

    async def read(self, entity_key: str) -> Optional[str]:
        """Fetch and decrypt a single memory by key. Returns None if expired."""
        resp = await self._http.get(f"/v1/memories/{entity_key}")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()
        if not data.get("ciphertext"):
            return None
        return decrypt_memory(data["ciphertext"], self._priv_hex)

    async def recall(self, session_id: str, *, limit: int = 20) -> list[Memory]:
        """Fetch and decrypt all memories in a session."""
        resp = await self._http.post(
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
                pass
        return results

    async def delete(self, entity_key: str) -> None:
        """Soft-delete a memory."""
        resp = await self._http.delete(f"/v1/memories/{entity_key}")
        if resp.status_code != 404:
            resp.raise_for_status()

    async def list_sessions(self) -> list[SessionEntry]:
        """List all sessions with memory counts."""
        resp = await self._http.get("/v1/sessions")
        resp.raise_for_status()
        return [
            SessionEntry(
                session_id=s["session_id"],
                memory_count=s["memory_count"],
                last_activity=s["last_activity"],
            )
            for s in resp.json().get("sessions", [])
        ]

    async def delete_session(self, session_id: str) -> int:
        """Bulk soft-delete all memories in a session. Returns count deleted."""
        resp = await self._http.delete(f"/v1/sessions/{quote(session_id, safe='')}")
        resp.raise_for_status()
        return resp.json().get("deleted", 0)

    async def write_many(
        self,
        session_id: str,
        texts: list[str],
        *,
        agent_id: Optional[str] = None,
        ttl: TtlTier = "episodic",
    ) -> list[str]:
        """Encrypt and store multiple memories concurrently. Returns list of entity keys."""
        return list(await asyncio.gather(
            *[self.write(session_id, text, agent_id=agent_id, ttl=ttl) for text in texts]
        ))

    async def list_memories(
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
        resp = await self._http.get("/v1/memories", params=params)
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

    async def pin(self, entity_key: str) -> None:
        """Pin a memory to prevent TTL expiry."""
        resp = await self._http.patch(f"/v1/memories/{entity_key}", json={"pinned": True})
        resp.raise_for_status()

    async def unpin(self, entity_key: str) -> None:
        """Unpin a memory, allowing normal TTL expiry."""
        resp = await self._http.patch(f"/v1/memories/{entity_key}", json={"pinned": False})
        resp.raise_for_status()

    async def usage(self) -> dict:
        """Return current billing period usage for this API key."""
        resp = await self._http.get("/v1/usage")
        resp.raise_for_status()
        return resp.json()

    async def search(
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
            raise ValueError("search() requires an embed= callback — pass embed=fn to AsyncHoloMem")
        embedding = await self._get_embedding(query_text)
        resp = await self._http.post(
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

    async def close(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "AsyncHoloMem":
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.close()
