"""LangChain / CrewAI / AutoGen tool adapters for HoloMem."""
from __future__ import annotations

from typing import Optional

from .client import HoloMem


class HoloMemToolkit:
    """
    Wraps HoloMem as LangChain-compatible Tool objects.

    Works with LangChain agents, CrewAI, and AutoGen.

    Usage::

        from holomem.tools import HoloMemToolkit

        toolkit = HoloMemToolkit(
            session_id="agent-session-001",
            api_key="hm_live_xxx",
            encryption_key="your-hex-key",
        )

        # LangChain / CrewAI
        tools = toolkit.as_langchain_tools()

        # AutoGen
        tool_list = toolkit.as_autogen_tools()
    """

    def __init__(
        self,
        session_id: str,
        api_key: str,
        encryption_key: Optional[str] = None,
        base_url: str = "https://api.holomem.io",
        agent_id: Optional[str] = None,
        ttl: str = "episodic",
    ) -> None:
        self._session_id = session_id
        self._agent_id = agent_id
        self._ttl = ttl
        self._client = HoloMem(
            api_key=api_key,
            encryption_key=encryption_key,
            base_url=base_url,
        )

    def _write_memory(self, text: str) -> str:
        key = self._client.write(
            self._session_id,
            text,
            agent_id=self._agent_id,
            ttl=self._ttl,
        )
        return f"Memory stored with key: {key}"

    def _recall_memories(self, query: str = "") -> str:
        memories = self._client.recall(self._session_id)
        if not memories:
            return "No memories found for this session."
        items = []
        for m in memories:
            if query and query.lower() not in m.plaintext.lower():
                continue
            items.append(f"[{m.entity_key}] {m.plaintext}")
        if not items:
            return "No memories matched the query."
        return "\n".join(items)

    def _delete_memory(self, entity_key: str) -> str:
        self._client.delete(entity_key)
        return f"Memory {entity_key} deleted."

    def as_langchain_tools(self) -> list:
        """Return a list of LangChain Tool objects."""
        from langchain_core.tools import Tool

        return [
            Tool(
                name="write_memory",
                func=self._write_memory,
                description=(
                    "Store a new memory in the current session. "
                    "Input: the text to remember. "
                    "Use this to save important facts, user preferences, or context for later recall."
                ),
            ),
            Tool(
                name="recall_memories",
                func=self._recall_memories,
                description=(
                    "Retrieve memories from the current session. "
                    "Input: optional keyword filter string (leave empty to get all memories). "
                    "Returns all stored memories, optionally filtered by keyword."
                ),
            ),
            Tool(
                name="delete_memory",
                func=self._delete_memory,
                description=(
                    "Delete a specific memory by its entity key. "
                    "Input: the entity_key string returned by write_memory. "
                    "Use when a memory is outdated or incorrect."
                ),
            ),
        ]

    def as_autogen_tools(self) -> list[dict]:
        """Return AutoGen-compatible tool definitions (OpenAI function-calling schema)."""
        return [
            {
                "type": "function",
                "function": {
                    "name": "write_memory",
                    "description": "Store a new encrypted memory in the current agent session.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "text": {"type": "string", "description": "The text to store as a memory."},
                        },
                        "required": ["text"],
                    },
                    "callable": self._write_memory,
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "recall_memories",
                    "description": "Retrieve memories from the current agent session, optionally filtered by keyword.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "Optional keyword filter. Leave empty to get all memories."},
                        },
                        "required": [],
                    },
                    "callable": self._recall_memories,
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "delete_memory",
                    "description": "Delete a specific memory by its entity key.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "entity_key": {"type": "string", "description": "The entity key of the memory to delete."},
                        },
                        "required": ["entity_key"],
                    },
                    "callable": self._delete_memory,
                },
            },
        ]
