from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import get_settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect() -> None:
    global _client, _db
    settings = get_settings()
    if not settings.mongodb_uri:
        _client = None
        _db = None
        return
    _client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=8000)
    _db = _client[settings.mongodb_db_name]


async def close() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


def db() -> AsyncIOMotorDatabase | None:
    return _db


def require_db() -> AsyncIOMotorDatabase:
    if _db is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=503, detail="MONGODB_NOT_CONFIGURED")
    return _db


async def ensure_indexes() -> None:
    database = db()
    if database is None:
        return
    await database["marketing_os_records"].create_index(
        [("channel", 1), ("record_type", 1), ("period_start", 1), ("snapshot_date", -1)]
    )
    await database["marketing_os_budgets"].create_index([("month", 1), ("channel", 1)], unique=True)
    await database["marketing_os_crm"].create_index([("month", 1), ("channel", 1)], unique=True)
    await database["marketing_os_targets"].create_index([("channel", 1), ("metric", 1)], unique=True)
