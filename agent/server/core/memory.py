from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return uuid.uuid4().hex


async def get_or_create_conversation(
    db: Any, user_id: str, conversation_id: str | None, first_message: str
) -> dict[str, Any]:
    if conversation_id:
        doc = await db["agent_conversations"].find_one(
            {"_id": conversation_id, "user_id": user_id}
        )
        if doc:
            return doc
    title = (first_message or "New conversation").strip()[:60] or "New conversation"
    doc = {
        "_id": _new_id(),
        "user_id": user_id,
        "title": title,
        "created_at": _now(),
        "updated_at": _now(),
        "last_message_at": _now(),
    }
    await db["agent_conversations"].insert_one(doc)
    return doc


async def save_message(
    db: Any, conversation_id: str, user_id: str, role: str, content: str
) -> dict[str, Any]:
    doc = {
        "_id": _new_id(),
        "conversation_id": conversation_id,
        "user_id": user_id,
        "role": role,
        "content": content,
        "created_at": _now(),
    }
    await db["agent_messages"].insert_one(doc)
    return doc


async def touch_conversation(db: Any, conversation_id: str) -> None:
    await db["agent_conversations"].update_one(
        {"_id": conversation_id},
        {"$set": {"updated_at": _now(), "last_message_at": _now()}},
    )


async def get_recent_messages(db: Any, conversation_id: str, limit: int) -> list[dict[str, Any]]:
    cursor = (
        db["agent_messages"]
        .find({"conversation_id": conversation_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    docs.reverse()  # chronological order for the model
    return docs


async def get_user_memory(db: Any, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    cursor = (
        db["agent_memory"].find({"user_id": user_id}).sort("updated_at", -1).limit(limit)
    )
    return await cursor.to_list(length=limit)


async def remember(
    db: Any, user_id: str, kind: str, key: str, value: str, source: str = "agent"
) -> dict[str, Any]:
    """Upsert a single curated memory fact (used sparingly; not blanket logging)."""
    existing = await db["agent_memory"].find_one({"user_id": user_id, "key": key})
    doc = {
        "user_id": user_id,
        "kind": kind,
        "key": key,
        "value": value,
        "source": source,
        "updated_at": _now(),
    }
    if existing:
        await db["agent_memory"].update_one({"_id": existing["_id"]}, {"$set": doc})
        return {**existing, **doc}
    doc["_id"] = _new_id()
    doc["created_at"] = _now()
    await db["agent_memory"].insert_one(doc)
    return doc
