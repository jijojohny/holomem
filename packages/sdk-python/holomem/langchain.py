"""LangChain memory adapter — drop HoloMem into any LangChain chain as persistent chat history."""
from __future__ import annotations

from typing import List, Optional, Sequence

from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import BaseMessage, messages_from_dict, messages_to_dict

from .client import HoloMem


class HoloMemChatHistory(BaseChatMessageHistory):
    """
    Stores LangChain chat messages as encrypted memories on Arkiv via HoloMem.

    Usage::

        from holomem.langchain import HoloMemChatHistory
        from langchain.chains import ConversationChain

        chain = ConversationChain(
            memory=HoloMemChatHistory(
                session_id="user-123",
                api_key="hm_live_xxx",
                encryption_key="your-hex-key",
            )
        )

    Each message is stored as a separate encrypted MemoryNode.
    Messages are lazily fetched from the API on first access.
    """

    def __init__(
        self,
        session_id: str,
        api_key: str,
        encryption_key: Optional[str] = None,
        base_url: str = "https://api.holomem.io",
    ) -> None:
        self._session_id = session_id
        self._client = HoloMem(
            api_key=api_key,
            encryption_key=encryption_key,
            base_url=base_url,
        )
        self._cache: Optional[List[BaseMessage]] = None

    @property
    def messages(self) -> List[BaseMessage]:
        if self._cache is None:
            self._cache = self._load()
        return self._cache

    def _load(self) -> List[BaseMessage]:
        memories = self._client.recall(self._session_id)
        msgs: List[BaseMessage] = []
        for mem in memories:
            try:
                import json
                dicts = json.loads(mem.plaintext)
                msgs.extend(messages_from_dict(dicts if isinstance(dicts, list) else [dicts]))
            except Exception:
                pass
        return msgs

    def add_message(self, message: BaseMessage) -> None:
        import json
        payload = json.dumps(messages_to_dict([message]))
        self._client.write(
            self._session_id,
            payload,
            agent_id="langchain",
            ttl="episodic",
        )
        if self._cache is not None:
            self._cache.append(message)

    def add_messages(self, messages: Sequence[BaseMessage]) -> None:
        for msg in messages:
            self.add_message(msg)

    def clear(self) -> None:
        memories = self._client.recall(self._session_id)
        for mem in memories:
            self._client.delete(mem.entity_key)
        self._cache = []
