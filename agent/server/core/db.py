from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

from .config import get_settings

_client: AsyncIOMotorClient | None = None
_db: Any = None


async def connect_db() -> Any:
    """Connect to the dedicated agent database (separate from lorenzodb)."""
    global _client, _db
    settings = get_settings()
    if not settings.mongodb_uri:
        print("⚠  [agent] MONGODB_URI not set — chat persistence/memory disabled.", flush=True)
        return None
    _client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=8000)
    _db = _client[settings.mongodb_db_name]
    try:
        await _client.admin.command("ping")
        print(f"[agent] ✓ MongoDB connected (db='{settings.mongodb_db_name}')", flush=True)
        await _ensure_indexes(_db)
    except Exception as e:  # pragma: no cover
        print(f"✗  [agent] MongoDB connection FAILED: {e}", flush=True)
        _client = None
        _db = None
    return _db


async def _ensure_indexes(db: Any) -> None:
    try:
        await db["agent_conversations"].create_index([("user_id", 1), ("updated_at", -1)])
        await db["agent_messages"].create_index([("conversation_id", 1), ("created_at", 1)])
        await db["agent_memory"].create_index([("user_id", 1), ("updated_at", -1)])
        await db["agent_memory"].create_index([("user_id", 1), ("key", 1)], unique=False)
    except Exception as e:  # pragma: no cover
        print(f"⚠  [agent] ensure_indexes: {e}", flush=True)


def get_db() -> Any:
    return _db


async def close_db() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None
