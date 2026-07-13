from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

# Curated memory taxonomy — the agent stores only durable, reusable preferences /
# context, never a transcript. Anything outside this set is rejected.
CURATED_KINDS = {
    "preference",   # generic durable preference
    "language",     # preferred response language
    "style",        # concise / verbose style preference
    "tone",         # Lorenzo brand tone preference
    "workflow",     # repeated workflow preference
    "context",      # useful, durable project context
}

# Soft cap on stored memories per user (newest kept) so memory stays a small,
# curated set rather than an ever-growing log.
MAX_MEMORIES_PER_USER = 40

_MAX_VALUE_LEN = 400
_MAX_KEY_LEN = 80

# Patterns that must never be stored even if the model is asked to. These guard
# secrets and sensitive personal identifiers; identity (name/email) is available
# live from the session and need not be persisted here.
_SENSITIVE_PATTERNS = [
    re.compile(r"\bpassword\b", re.IGNORECASE),
    re.compile(r"\bpass(?:code|phrase)\b", re.IGNORECASE),
    re.compile(r"\b(?:api[_-]?key|secret|token|bearer)\b", re.IGNORECASE),
    re.compile(r"\bssn\b|\bsocial security\b", re.IGNORECASE),
    re.compile(r"\bpassport\b", re.IGNORECASE),
    re.compile(r"\b(?:\d[ -]?){13,19}\b"),  # card / long account numbers
]


def normalize_kind(kind: str | None) -> str:
    k = (kind or "preference").strip().lower()
    return k if k in CURATED_KINDS else "preference"


def is_sensitive(text: str) -> bool:
    if not text:
        return False
    return any(p.search(text) for p in _SENSITIVE_PATTERNS)


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


async def _prune_user_memory(db: Any, user_id: str) -> None:
    """Keep only the newest MAX_MEMORIES_PER_USER memories for a user."""
    extra = (
        await db["agent_memory"]
        .find({"user_id": user_id}, {"_id": 1})
        .sort("updated_at", -1)
        .skip(MAX_MEMORIES_PER_USER)
        .to_list(length=200)
    )
    if extra:
        await db["agent_memory"].delete_many({"_id": {"$in": [d["_id"] for d in extra]}})


async def remember(
    db: Any, user_id: str, kind: str, key: str, value: str, source: str = "agent"
) -> dict[str, Any]:
    """Upsert a single curated memory fact (used sparingly; not blanket logging).

    Enforces: per-user scoping, the curated kind taxonomy, length caps, a sensitive-
    data block, and a soft cap on total stored memories. Raises ValueError on a
    rejected write so callers can surface a clear reason.
    """
    if not user_id:
        raise ValueError("MEMORY_REQUIRES_USER")
    key = (key or "").strip()[:_MAX_KEY_LEN]
    value = (value or "").strip()[:_MAX_VALUE_LEN]
    if not key or not value:
        raise ValueError("MEMORY_KEY_VALUE_REQUIRED")
    if is_sensitive(key) or is_sensitive(value):
        raise ValueError("MEMORY_SENSITIVE_BLOCKED")
    kind = normalize_kind(kind)

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
    await _prune_user_memory(db, user_id)
    return doc
