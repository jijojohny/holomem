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
    # CrewAI-native memory backend
    "HoloMemStorage",        # crewai storage layer
    "HoloMemCrewAIConfig",   # crewai config dataclass
    "patch_crew_memory",     # crewai crew patcher
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
    if name in ("HoloMemStorage", "HoloMemCrewAIConfig", "patch_crew_memory"):
        from .crewai import HoloMemStorage, HoloMemCrewAIConfig, patch_crew_memory
        return locals()[name]
    raise AttributeError(f"module 'holomem' has no attribute {name!r}")
