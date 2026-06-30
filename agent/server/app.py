from __future__ import annotations

import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from core.agent_loop import run_agent
from core.auth import get_current_user, get_optional_user
from core.config import get_settings
from core.db import close_db, connect_db, get_db, get_platform_db
from core.llm import build_system_prompt
from core.memory import (
    get_or_create_conversation,
    get_recent_messages,
    get_user_memory,
    save_message,
    touch_conversation,
)
from core.platform import build_user_identity
from core.tools import registry

SUGGESTIONS = {
    "products": [
        "Find chandeliers under 10,000 AED",
        "Summarize my selected products",
        "Which selected products are missing a main image?",
    ],
    "proposals": [
        "Show my recent proposals",
        "Summarize the current proposal",
        "What products are in this proposal?",
    ],
    "images": [
        "Is the image service running?",
        "What does the official compose flow do?",
    ],
    "marketing": [
        "What can you help me with in marketing?",
        "Show platform status",
    ],
    "default": ["What can you do?", "Show platform status", "Show my recent proposals"],
}


def _context_blurb(context: dict[str, Any]) -> str:
    if not context:
        return ""
    parts: list[str] = []
    if context.get("app"):
        parts.append(f"app = {context['app']}")
    if context.get("module"):
        parts.append(f"module/page = {context['module']}")
    if context.get("path"):
        parts.append(f"path = {context['path']}")
    if context.get("proposal_id"):
        parts.append(f"current_proposal_id = {context['proposal_id']}")
    staging = context.get("import_staging")
    if context.get("module") == "imports" or isinstance(staging, dict):
        parts.append("page = Excel Imports staging (NOT the main Products catalog)")
        if isinstance(staging, dict):
            if staging.get("filename"):
                parts.append(f"import_file = {staging['filename']}")
            if staging.get("visible_rows_count") is not None:
                parts.append(f"visible_staging_rows = {staging['visible_rows_count']}")
            if staging.get("total_rows") is not None:
                parts.append(f"import_total_rows = {staging['total_rows']}")
        parts.append(
            "For questions about this list, call get_visible_import_context — "
            "do NOT use get_selected_products on this page."
        )
    sel = context.get("selected_product_ids") or []
    if sel:
        parts.append(f"selected_product_ids = {sel[:20]}")
    if not parts:
        return ""
    return (
        "Current user context (use it to be specific and to default tool "
        "arguments — e.g. selected_product_ids, current_proposal_id):\n- "
        + "\n- ".join(parts)
    )

def _identity_blurb(identity: dict[str, Any]) -> str:
    if not identity or not identity.get("authenticated"):
        return ""
    parts: list[str] = []
    name = identity.get("display_name")
    if name:
        parts.append(f"display_name = {name}")
    if identity.get("email"):
        parts.append(f"email = {identity['email']}")
    parts.append(f"user_id = {identity.get('user_id')}")
    parts.append(f"role = {identity.get('role')}")
    if identity.get("is_admin"):
        parts.append("is_admin = true")
    return (
        "Authenticated user (verified from the signed-in session — you DO have this "
        "context; answer identity/account questions like 'what is my name' directly "
        "from it, and never claim you lack account access):\n- " + "\n- ".join(parts)
    )


BASE_DIR = Path(__file__).resolve().parent
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="Lorenzo Agent API",
    lifespan=lifespan,
    # Only set when a reverse proxy forwards the base path without stripping it.
    root_path=settings.agent_root_path or "",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# The embeddable widget bundle. Primary URL is `${NEXT_PUBLIC_AGENT_URL}/widget.js`;
# the /static mount is kept for backward compatibility.
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")


@app.get("/widget.js")
async def widget_js() -> FileResponse:
    return FileResponse(
        str(BASE_DIR / "static" / "widget.js"),
        media_type="application/javascript",
        headers={"Cache-Control": "public, max-age=300"},
    )


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
    """Public: gives the widget its nav URLs, whether the visitor is signed in, and
    (read-only) their display name/role for the account header."""
    user_out: dict[str, Any] | None = None
    if user:
        identity = {}
        try:
            identity = await build_user_identity(
                {"user": user, "context": {}, "platform_db": get_platform_db()}
            )
        except Exception:  # noqa: BLE001
            identity = {}
        user_out = {
            "id": user["id"],
            "is_admin": user["is_admin"],
            "display_name": identity.get("display_name"),
            "email": identity.get("email"),
            "role": identity.get("role"),
        }
    return {
        "authenticated": user is not None,
        "user": user_out,
        "nav": settings.nav_urls(),
        "llm_provider": settings.resolved_provider(),
        "suggestions": SUGGESTIONS,
    }


# ---------------------------------------------------------------------------
# Conversations / memory (read)
# ---------------------------------------------------------------------------

@app.get("/api/agent/conversations")
async def list_conversations(
    user: dict[str, Any] = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=200),
) -> dict[str, Any]:
    db = _require_db()
    docs = (
        await db["agent_conversations"]
        .find({"user_id": user["id"]})
        .sort("updated_at", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    conversations = []
    for doc in docs:
        conversations.append({
            "id": doc.get("_id"),
            "title": doc.get("title") or "Conversation",
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
            "last_message_at": doc.get("last_message_at") or doc.get("updated_at"),
        })
    return {"conversations": conversations}


@app.get("/api/agent/conversations/{conversation_id}/messages")
async def conversation_messages(
    conversation_id: str,
    user: dict[str, Any] = Depends(get_current_user),
    limit: int = Query(200, ge=1, le=500),
) -> dict[str, Any]:
    db = _require_db()
    conv = await db["agent_conversations"].find_one(
        {"_id": conversation_id, "user_id": user["id"]}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="CONVERSATION_NOT_FOUND")
    msgs = await get_recent_messages(db, conversation_id, limit)
    return {
        "conversation": {
            "id": conv.get("_id"),
            "title": conv.get("title") or "Conversation",
            "created_at": conv.get("created_at"),
            "updated_at": conv.get("updated_at"),
            "last_message_at": conv.get("last_message_at") or conv.get("updated_at"),
        },
        "messages": [{"role": m["role"], "content": m["content"], "created_at": m.get("created_at")} for m in msgs],
    }


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

    context = payload.get("context") or {}
    if not isinstance(context, dict):
        context = {}

    conv = await get_or_create_conversation(
        db, user["id"], payload.get("conversation_id"), text
    )
    await save_message(db, conv["_id"], user["id"], "user", text)

    platform_db = get_platform_db()
    runtime = {
        "user": user,
        "context": context,
        "settings": settings,
        "agent_db": db,
        "platform_db": platform_db,
    }

    history = await get_recent_messages(db, conv["_id"], settings.short_term_max_messages)
    user_memory = await get_user_memory(db, user["id"])
    system = build_system_prompt(settings, user_memory)

    # Authenticated identity stamp — so the agent can answer "what is my name / who am
    # I / check my account" directly from verified session context (read-only lookup).
    try:
        identity = await build_user_identity(runtime)
    except Exception:  # noqa: BLE001 — identity must never block the chat
        identity = {}
    id_blurb = _identity_blurb(identity)
    if id_blurb:
        system += "\n\n" + id_blurb

    blurb = _context_blurb(context)
    if blurb:
        system += "\n\n" + blurb
    llm_messages = [
        {"role": m["role"], "content": m["content"]}
        for m in history
        if m["role"] in ("user", "assistant") and m.get("content")
    ]

    async def gen():
        yield _sse({"type": "meta", "conversation_id": conv["_id"]})
        collected: list[str] = []
        try:
            async for ev in run_agent(
                settings=settings,
                provider=settings.resolved_provider(),
                system=system,
                messages=llm_messages,
                runtime=runtime,
            ):
                if ev.get("type") == "delta":
                    collected.append(ev.get("text", ""))
                yield _sse(ev)
        except Exception as e:  # noqa: BLE001
            print(f"✗  [agent] chat error: {e}", flush=True)
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
