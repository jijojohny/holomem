from __future__ import annotations

import warnings
from dataclasses import dataclass
from typing import Literal, Optional

import httpx

from .crypto import generate_encryption_key, encrypt_memory, decrypt_memory

TtlTier = Literal["working", "episodic", "persistent"]
_API_BASE = "https://api.holomem.io"


@dataclass
class Memory:
    entity_key: str
    agent_id: str
    plaintext: str


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
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
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
        resp = self._http.post(
            "/v1/memories",
            json={
                "session_id": session_id,
                "ciphertext": ciphertext,
                "ttl_tier": ttl,
                "agent_id": agent_id,
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

    def delete(self, entity_key: str) -> None:
        """Soft-delete a memory (marks deleted in index; Arkiv TTL handles on-chain)."""
        resp = self._http.delete(f"/v1/memories/{entity_key}")
        if resp.status_code != 404:
            resp.raise_for_status()

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "HoloMem":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
