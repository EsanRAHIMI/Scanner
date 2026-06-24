from __future__ import annotations

import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from core.auth import get_current_user, get_optional_user
from core.config import get_settings
from core.db import close_db, connect_db, get_db
from core.llm import build_system_prompt, stream_reply
from core.memory import (
    get_or_create_conversation,
    get_recent_messages,
    get_user_memory,
    save_message,
    touch_conversation,
)
from core.tools import registry

BASE_DIR = Path(__file__).resolve().parent
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(title="Lorenzo Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# The embeddable widget bundle is served as a static file.
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")


def _require_db() -> Any:
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="MONGODB_NOT_CONFIGURED")
    return db


def _sse(obj: dict[str, Any]) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


# ---------------------------------------------------------------------------
# Health / bootstrap
# ---------------------------------------------------------------------------

@app.get("/api/agent/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "agent",
        "mongo": get_db() is not None,
        "llm_provider": settings.resolved_provider(),
        "tools": registry.list_public(),
    }


@app.get("/api/agent/bootstrap")
async def bootstrap(user: dict[str, Any] | None = Depends(get_optional_user)) -> dict[str, Any]:
    """Public: gives the widget its nav URLs and whether the visitor is signed in."""
    return {
        "authenticated": user is not None,
        "user": {"id": user["id"], "is_admin": user["is_admin"]} if user else None,
        "nav": settings.nav_urls(),
        "llm_provider": settings.resolved_provider(),
    }


# ---------------------------------------------------------------------------
# Conversations / memory (read)
# ---------------------------------------------------------------------------

@app.get("/api/agent/conversations")
async def list_conversations(
    user: dict[str, Any] = Depends(get_current_user),
    limit: int = Query(30, ge=1, le=100),
) -> dict[str, Any]:
    db = _require_db()
    docs = (
        await db["agent_conversations"]
        .find({"user_id": user["id"]})
        .sort("updated_at", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    return {"conversations": [{**d, "id": d["_id"]} for d in docs]}


@app.get("/api/agent/conversations/{conversation_id}/messages")
async def conversation_messages(
    conversation_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    db = _require_db()
    conv = await db["agent_conversations"].find_one(
        {"_id": conversation_id, "user_id": user["id"]}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="CONVERSATION_NOT_FOUND")
    msgs = await get_recent_messages(db, conversation_id, settings.short_term_max_messages)
    return {"messages": [{"role": m["role"], "content": m["content"]} for m in msgs]}


@app.get("/api/agent/memory")
async def memory(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    db = _require_db()
    items = await get_user_memory(db, user["id"])
    return {"memory": [{**m, "id": m["_id"]} for m in items]}


# ---------------------------------------------------------------------------
# Chat (SSE streaming)
# ---------------------------------------------------------------------------

@app.post("/api/agent/chat")
async def chat(
    payload: dict[str, Any],
    user: dict[str, Any] = Depends(get_current_user),
) -> StreamingResponse:
    db = _require_db()
    text = (payload.get("message") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="EMPTY_MESSAGE")
    if len(text) > 8000:
        raise HTTPException(status_code=413, detail="MESSAGE_TOO_LONG")

    conv = await get_or_create_conversation(
        db, user["id"], payload.get("conversation_id"), text
    )
    await save_message(db, conv["_id"], user["id"], "user", text)

    history = await get_recent_messages(db, conv["_id"], settings.short_term_max_messages)
    user_memory = await get_user_memory(db, user["id"])
    system = build_system_prompt(settings, user_memory)
    llm_messages = [
        {"role": m["role"], "content": m["content"]}
        for m in history
        if m["role"] in ("user", "assistant") and m.get("content")
    ]

    async def gen():
        yield _sse({"type": "meta", "conversation_id": conv["_id"]})
        collected: list[str] = []
        try:
            async for delta in stream_reply(llm_messages, system, settings):
                collected.append(delta)
                yield _sse({"type": "delta", "text": delta})
        except Exception as e:  # noqa: BLE001
            print(f"✗  [agent] chat stream error: {e}", flush=True)
            yield _sse({"type": "error", "detail": "LLM_ERROR"})
        assistant = "".join(collected).strip()
        if assistant:
            await save_message(db, conv["_id"], user["id"], "assistant", assistant)
            await touch_conversation(db, conv["_id"])
        yield _sse({"type": "done", "conversation_id": conv["_id"]})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception) -> JSONResponse:
    print(f"✗  [agent] Unhandled error: {exc}", flush=True)
    return JSONResponse(status_code=500, content={"detail": "INTERNAL_ERROR"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=settings.agent_port, reload=True)
