from .client import HoloMem, Memory, SessionEntry, MemoryIndexEntry, SearchResult, TtlTier
from .async_client import AsyncHoloMem

__all__ = [
    "HoloMem",
    "AsyncHoloMem",
    "Memory",
    "SessionEntry",
    "MemoryIndexEntry",
    "SearchResult",
    "TtlTier",
    # Framework adapters (optional imports — requires extra deps)
    "HoloMemStore",      # langgraph
    "HoloMemToolkit",    # tools (LangChain, CrewAI, AutoGen)
    "HoloMemChatHistory",  # langchain
]


def __getattr__(name: str):
    if name == "HoloMemStore":
        from .langgraph import HoloMemStore
        return HoloMemStore
    if name == "HoloMemToolkit":
        from .tools import HoloMemToolkit
        return HoloMemToolkit
    if name == "HoloMemChatHistory":
        from .langchain import HoloMemChatHistory
        return HoloMemChatHistory
    raise AttributeError(f"module 'holomem' has no attribute {name!r}")
