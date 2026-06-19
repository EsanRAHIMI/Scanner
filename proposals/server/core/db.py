from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

from .config import get_settings

_client: AsyncIOMotorClient | None = None
_db: Any = None


async def connect_db() -> Any:
    """Connect to the shared platform MongoDB (same Atlas DB as trainer/server)."""
    global _client, _db
    settings = get_settings()
    if not settings.mongodb_uri:
        print("⚠  [proposals] MONGODB_URI is not set — API endpoints will return 503.", flush=True)
        return None
    _client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=8000)
    _db = _client[settings.mongodb_db_name]
    try:
        await _client.admin.command("ping")
        print(f"[proposals] ✓ MongoDB connected (db='{settings.mongodb_db_name}')", flush=True)
        await _ensure_indexes(_db)
    except Exception as e:  # pragma: no cover
        print(f"✗  [proposals] MongoDB connection FAILED: {e}", flush=True)
        _client = None
        _db = None
    return _db


async def _ensure_indexes(db: Any) -> None:
    try:
        await db["proposals"].create_index([("created_by", 1), ("updated_at", -1)])
        await db["proposals"].create_index([("status", 1)])
        await db["proposals"].create_index([("share_token", 1)], sparse=True)
        await db["proposal_templates"].create_index([("active", 1)])
        await db["proposal_activity"].create_index([("proposal_id", 1), ("timestamp", -1)])
        await db["proposal_assets"].create_index([("kind", 1), ("created_at", -1)])
    except Exception as e:  # pragma: no cover
        print(f"⚠  [proposals] ensure_indexes: {e}", flush=True)


def get_db() -> Any:
    return _db


async def close_db() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None
