from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from core.auth import (
    get_current_user,
    is_platform_admin,
    public_user,
    require_admin,
    require_operator,
)
from core.config import get_settings
from core.db import close_db, connect_db, get_db
from core.generator import compute_pricing, generate_pages
from core.pdf import html_to_pdf, shutdown_pdf
from core.products import catalog_page, normalize_product
from core.render import render_proposal_html
from core.seed import seed_default_template
from core.storage import StorageBackend, sanitize_storage_name

BASE_DIR = Path(__file__).resolve().parent

settings = get_settings()
storage = StorageBackend(settings)

PROPOSAL_STATUSES = {"draft", "sent", "approved", "rejected", "archived"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return uuid.uuid4().hex


@asynccontextmanager
async def lifespan(_: FastAPI):
    db = await connect_db()
    await seed_default_template(db)
    yield
    await shutdown_pdf()
    await close_db()


app = FastAPI(title="Lorenzo Proposals API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Brand assets bundled with the service (logo / patterns / intro image).
app.mount(
    "/api/proposals/brand",
    StaticFiles(directory=str(BASE_DIR / "assets" / "brand")),
    name="brand",
)


def _require_db() -> Any:
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="MONGODB_NOT_CONFIGURED")
    return db


async def log_activity(
    db: Any,
    user: dict[str, Any] | None,
    action: str,
    proposal_id: str | None = None,
    details: str = "",
) -> None:
    try:
        await db["proposal_activity"].insert_one({
            "_id": _new_id(),
            "timestamp": _now(),
            "user_id": (user or {}).get("_id", "system"),
            "username": (user or {}).get("username") or (user or {}).get("email") or "system",
            "action": action,
            "proposal_id": proposal_id,
            "details": details,
        })
    except Exception as e:  # pragma: no cover
        print(f"⚠  [proposals] log_activity failed: {e}", flush=True)


# ---------------------------------------------------------------------------
# Health / auth
# ---------------------------------------------------------------------------

@app.get("/api/proposals/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "proposals",
        "mongo": get_db() is not None,
        "s3": storage.s3_enabled,
    }


@app.get("/api/proposals/auth/me")
async def auth_me(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return public_user(user)


# ---------------------------------------------------------------------------
# Product catalog (read-only view over the shared products collection)
# ---------------------------------------------------------------------------

@app.get("/api/proposals/catalog")
async def catalog(
    _: dict[str, Any] = Depends(require_operator),
    search: str = Query(""),
    category: str = Query(""),
    material: str = Query(""),
    color: str = Query(""),
    limit: int = Query(60, ge=1, le=200),
    skip: int = Query(0, ge=0),
) -> dict[str, Any]:
    db = _require_db()
    return await catalog_page(
        db, search=search, category=category, material=material, color=color,
        limit=limit, skip=skip,
    )


# ---------------------------------------------------------------------------
# Salesperson profiles (admin-managed contact blocks / signatures)
# ---------------------------------------------------------------------------

@app.get("/api/proposals/user-profiles/me")
async def my_profile(user: dict[str, Any] = Depends(require_operator)) -> dict[str, Any]:
    db = _require_db()
    doc = await db["proposal_user_profiles"].find_one({"_id": user["_id"]}) or {}
    return {
        "user_id": user["_id"],
        "name": doc.get("name") or user.get("username") or "",
        "phone": doc.get("phone", ""),
        "email": doc.get("email") or user.get("email") or "",
        "whatsapp": doc.get("whatsapp", ""),
        "signature_text": doc.get("signature_text", ""),
        "template_id": doc.get("template_id"),
    }


@app.get("/api/proposals/user-profiles")
async def list_profiles(_: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    db = _require_db()
    users = await db["users"].find(
        {}, {"_id": 1, "username": 1, "email": 1, "role": 1, "is_admin": 1}
    ).to_list(length=500)
    profiles = {p["_id"]: p async for p in db["proposal_user_profiles"].find({})}
    out = []
    for u in users:
        p = profiles.get(u["_id"], {})
        out.append({
            "user_id": u["_id"],
            "username": u.get("username"),
            "email": u.get("email"),
            "role": u.get("role"),
            "name": p.get("name", ""),
            "phone": p.get("phone", ""),
            "whatsapp": p.get("whatsapp", ""),
            "signature_text": p.get("signature_text", ""),
            "template_id": p.get("template_id"),
        })
    return {"profiles": out}


@app.put("/api/proposals/user-profiles/{user_id}")
async def upsert_profile(
    user_id: str,
    payload: dict[str, Any],
    admin: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    db = _require_db()
    patch = {
        k: payload.get(k, "")
        for k in ("name", "phone", "email", "whatsapp", "signature_text")
    }
    patch["template_id"] = payload.get("template_id")
    patch["updated_at"] = _now()
    await db["proposal_user_profiles"].update_one(
        {"_id": user_id}, {"$set": patch}, upsert=True
    )
    await log_activity(db, admin, "PROFILE_UPDATE", details=f"Updated salesperson profile {user_id}")
    return {"updated": True}


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

def _template_visible_to(template: dict[str, Any], user: dict[str, Any]) -> bool:
    if not template.get("active", True):
        return False
    if template.get("scope") == "assigned":
        return user["_id"] in (template.get("assigned_user_ids") or [])
    return True


@app.get("/api/proposals/templates")
async def list_templates(
    user: dict[str, Any] = Depends(require_operator),
    all: int = Query(0),
) -> dict[str, Any]:
    db = _require_db()
    docs = await db["proposal_templates"].find({}).sort("created_at", 1).to_list(length=200)
    if all and is_platform_admin(user):
        records = docs
    else:
        records = [t for t in docs if _template_visible_to(t, user)]
    return {"templates": [{**t, "id": t["_id"]} for t in records]}


@app.post("/api/proposals/templates")
async def create_template(
    payload: dict[str, Any],
    admin: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    db = _require_db()
    doc = {
        "_id": _new_id(),
        "name": payload.get("name") or "Untitled template",
        "slug": payload.get("slug") or _new_id()[:8],
        "scope": payload.get("scope") or "global",
        "assigned_user_ids": payload.get("assigned_user_ids") or [],
        "active": bool(payload.get("active", True)),
        "branding": payload.get("branding") or {},
        "fixed_pages": payload.get("fixed_pages") or {},
        "pricing_defaults": payload.get("pricing_defaults") or {},
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db["proposal_templates"].insert_one(doc)
    await log_activity(db, admin, "TEMPLATE_CREATE", details=f"Created template: {doc['name']}")
    return {**doc, "id": doc["_id"]}


@app.get("/api/proposals/templates/{template_id}")
async def get_template(
    template_id: str,
    user: dict[str, Any] = Depends(require_operator),
) -> dict[str, Any]:
    db = _require_db()
    doc = await db["proposal_templates"].find_one({"_id": template_id})
    if not doc:
        raise HTTPException(status_code=404, detail="TEMPLATE_NOT_FOUND")
    if not is_platform_admin(user) and not _template_visible_to(doc, user):
        raise HTTPException(status_code=403, detail="FORBIDDEN")
    return {**doc, "id": doc["_id"]}


@app.patch("/api/proposals/templates/{template_id}")
async def update_template(
    template_id: str,
    payload: dict[str, Any],
    admin: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    db = _require_db()
    allowed = {
        "name", "scope", "assigned_user_ids", "active",
        "branding", "fixed_pages", "pricing_defaults",
    }
    patch = {k: v for k, v in payload.items() if k in allowed}
    patch["updated_at"] = _now()
    res = await db["proposal_templates"].update_one({"_id": template_id}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="TEMPLATE_NOT_FOUND")
    await log_activity(db, admin, "TEMPLATE_UPDATE", details=f"Updated template {template_id}")
    doc = await db["proposal_templates"].find_one({"_id": template_id})
    return {**doc, "id": doc["_id"]}


@app.post("/api/proposals/templates/{template_id}/duplicate")
async def duplicate_template(
    template_id: str,
    admin: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    db = _require_db()
    doc = await db["proposal_templates"].find_one({"_id": template_id})
    if not doc:
        raise HTTPException(status_code=404, detail="TEMPLATE_NOT_FOUND")
    copy = dict(doc)
    copy["_id"] = _new_id()
    copy["name"] = f"{doc.get('name')} (copy)"
    copy["slug"] = _new_id()[:8]
    copy["created_at"] = _now()
    copy["updated_at"] = _now()
    await db["proposal_templates"].insert_one(copy)
    await log_activity(db, admin, "TEMPLATE_DUPLICATE", details=f"Duplicated template {template_id}")
    return {**copy, "id": copy["_id"]}


@app.delete("/api/proposals/templates/{template_id}")
async def delete_template(
    template_id: str,
    admin: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    db = _require_db()
    doc = await db["proposal_templates"].find_one({"_id": template_id})
    if not doc:
        raise HTTPException(status_code=404, detail="TEMPLATE_NOT_FOUND")
    if doc.get("slug") == "lorenzo-classic":
        # Never hard-delete the default; archive instead.
        await db["proposal_templates"].update_one(
            {"_id": template_id}, {"$set": {"active": False, "updated_at": _now()}}
        )
        return {"archived": True}
    await db["proposal_templates"].delete_one({"_id": template_id})
    await log_activity(db, admin, "TEMPLATE_DELETE", details=f"Deleted template {template_id}")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Fixed-path routes that must be registered BEFORE /api/proposals/{proposal_id}
# ---------------------------------------------------------------------------

@app.get("/api/proposals/assets")
async def list_assets(
    _: dict[str, Any] = Depends(require_operator),
    kind: str = Query(""),
    limit: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    db = _require_db()
    query = {"kind": kind} if kind else {}
    docs = await db["proposal_assets"].find(query).sort("created_at", -1).limit(limit).to_list(length=limit)
    return {"assets": [{**d, "id": d["_id"]} for d in docs]}


@app.get("/api/proposals/activity")
async def activity(
    _: dict[str, Any] = Depends(require_admin),
    proposal_id: str = Query(""),
    limit: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    db = _require_db()
    query = {"proposal_id": proposal_id} if proposal_id else {}
    docs = await db["proposal_activity"].find(query).sort("timestamp", -1).limit(limit).to_list(length=limit)
    return {"activity": [{**d, "id": d["_id"]} for d in docs]}


# ---------------------------------------------------------------------------
# Proposals
# ---------------------------------------------------------------------------

def _proposal_out(doc: dict[str, Any]) -> dict[str, Any]:
    return {**doc, "id": doc["_id"]}


async def _load_proposal(db: Any, proposal_id: str, user: dict[str, Any]) -> dict[str, Any]:
    doc = await db["proposals"].find_one({"_id": proposal_id})
    if not doc:
        raise HTTPException(status_code=404, detail="PROPOSAL_NOT_FOUND")
    if not is_platform_admin(user) and doc.get("created_by") != user["_id"]:
        raise HTTPException(status_code=403, detail="FORBIDDEN")
    return doc


async def _resolve_items(db: Any, raw_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Snapshot selected catalog products into proposal items (with overrides)."""
    items: list[dict[str, Any]] = []
    for raw in raw_items or []:
        item: dict[str, Any] = {
            "id": raw.get("id") or _new_id()[:12],
            "product_id": raw.get("product_id"),
            "room": (raw.get("room") or "").strip(),
            "qty": raw.get("qty") or 1,
        }
        snapshot: dict[str, Any] = {}
        if raw.get("product_id"):
            doc = await db["products"].find_one({"_id": raw["product_id"]})
            if doc:
                snapshot = normalize_product(doc)
        overrides = raw.get("overrides") or {}
        for key in (
            "name", "code", "design", "category", "material", "color", "size",
            "pieces", "light", "description", "price", "price_raw",
            "image_url", "image_urls", "drawing_url", "room_image_url", "spec_title",
        ):
            if key in overrides and overrides[key] not in (None, ""):
                item[key] = overrides[key]
            elif key in snapshot and snapshot.get(key) not in (None, "", []):
                item[key] = snapshot[key]
        if isinstance(item.get("price"), str):
            from core.products import parse_price
            item["price"] = parse_price(item["price"])
        items.append(item)
    return items


@app.get("/api/proposals")
async def list_proposals(
    user: dict[str, Any] = Depends(require_operator),
    all: int = Query(0),
    status: str = Query(""),
    search: str = Query(""),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
) -> dict[str, Any]:
    db = _require_db()
    query: dict[str, Any] = {}
    if not (all and is_platform_admin(user)):
        query["created_by"] = user["_id"]
    if status and status in PROPOSAL_STATUSES:
        query["status"] = status
    if search:
        import re as _re
        rx = _re.compile(_re.escape(search.strip()), _re.IGNORECASE)
        query["$or"] = [
            {"title": rx}, {"customer.name": rx}, {"project.name": rx}, {"project.location": rx},
        ]
    cursor = db["proposals"].find(
        query,
        {"pages": 0},  # keep list payloads light
    ).sort("updated_at", -1).skip(skip).limit(limit + 1)
    docs = await cursor.to_list(length=limit + 1)
    has_more = len(docs) > limit
    return {
        "proposals": [_proposal_out(d) for d in docs[:limit]],
        "has_more": has_more,
    }


@app.post("/api/proposals")
async def create_proposal(
    payload: dict[str, Any],
    user: dict[str, Any] = Depends(require_operator),
) -> dict[str, Any]:
    db = _require_db()
    template_id = payload.get("template_id")
    template = None
    if template_id:
        template = await db["proposal_templates"].find_one({"_id": template_id})
    if not template:
        template = await db["proposal_templates"].find_one({"slug": "lorenzo-classic"})
    if not template:
        raise HTTPException(status_code=400, detail="NO_TEMPLATE_AVAILABLE")

    items = await _resolve_items(db, payload.get("items") or [])

    pricing_defaults = template.get("pricing_defaults") or {}
    pricing_in = payload.get("pricing") or {}
    pricing = compute_pricing(items, {
        "currency": pricing_in.get("currency") or pricing_defaults.get("currency", "AED"),
        "discount_pct": pricing_in.get("discount_pct", pricing_defaults.get("discount_pct", 0)),
        "vat_pct": pricing_in.get("vat_pct", pricing_defaults.get("vat_pct", 0)),
        "notes": pricing_in.get("notes", ""),
    })

    # Salesperson block: stored profile, overridable per proposal.
    profile = await db["proposal_user_profiles"].find_one({"_id": user["_id"]}) or {}
    salesperson_in = payload.get("salesperson") or {}
    salesperson = {
        "name": salesperson_in.get("name") or profile.get("name") or user.get("username") or "",
        "phone": salesperson_in.get("phone") or profile.get("phone", ""),
        "email": salesperson_in.get("email") or profile.get("email") or user.get("email") or "",
        "whatsapp": salesperson_in.get("whatsapp") or profile.get("whatsapp", ""),
        "signature_text": salesperson_in.get("signature_text") or profile.get("signature_text", ""),
    }

    doc = {
        "_id": _new_id(),
        "title": payload.get("title") or "Untitled proposal",
        "status": "draft",
        "customer": payload.get("customer") or {},
        "project": payload.get("project") or {},
        "salesperson": salesperson,
        "created_by": user["_id"],
        "created_by_name": user.get("username") or user.get("email") or "",
        "template_id": template["_id"],
        "items": items,
        "pricing": pricing,
        "pages": [],
        "pdf_key": None,
        "pdf_url": None,
        "share_token": None,
        "version": 1,
        "created_at": _now(),
        "updated_at": _now(),
    }

    if payload.get("generate", True):
        doc["pages"] = generate_pages(template, doc)

    await db["proposals"].insert_one(doc)
    await log_activity(db, user, "PROPOSAL_CREATE", doc["_id"], f"Created proposal: {doc['title']}")
    return _proposal_out(doc)


@app.get("/api/proposals/{proposal_id}")
async def get_proposal(
    proposal_id: str,
    user: dict[str, Any] = Depends(require_operator),
) -> dict[str, Any]:
    db = _require_db()
    doc = await _load_proposal(db, proposal_id, user)
    return _proposal_out(doc)


@app.patch("/api/proposals/{proposal_id}")
async def update_proposal(
    proposal_id: str,
    payload: dict[str, Any],
    user: dict[str, Any] = Depends(require_operator),
) -> dict[str, Any]:
    db = _require_db()
    doc = await _load_proposal(db, proposal_id, user)

    patch: dict[str, Any] = {}
    for key in ("title", "customer", "project", "salesperson", "pages"):
        if key in payload:
            patch[key] = payload[key]

    items = doc.get("items") or []
    if "items" in payload:
        items = await _resolve_items(db, payload["items"])
        patch["items"] = items

    if "pricing" in payload or "items" in payload:
        pricing_in = {**(doc.get("pricing") or {}), **(payload.get("pricing") or {})}
        patch["pricing"] = compute_pricing(items, pricing_in)

    patch["updated_at"] = _now()
    patch["version"] = int(doc.get("version") or 1) + 1
    await db["proposals"].update_one({"_id": proposal_id}, {"$set": patch})
    await log_activity(db, user, "PROPOSAL_EDIT", proposal_id, "Edited proposal")
    updated = await db["proposals"].find_one({"_id": proposal_id})
    return _proposal_out(updated)


@app.delete("/api/proposals/{proposal_id}")
async def delete_proposal(
    proposal_id: str,
    user: dict[str, Any] = Depends(require_operator),
) -> dict[str, Any]:
    db = _require_db()
    doc = await _load_proposal(db, proposal_id, user)
    if doc.get("pdf_key"):
        storage.delete(doc["pdf_key"])
    await db["proposals"].delete_one({"_id": proposal_id})
    await log_activity(db, user, "PROPOSAL_DELETE", proposal_id, f"Deleted proposal: {doc.get('title')}")
    return {"deleted": True}


@app.post("/api/proposals/{proposal_id}/duplicate")
async def duplicate_proposal(
    proposal_id: str,
    user: dict[str, Any] = Depends(require_operator),
) -> dict[str, Any]:
    db = _require_db()
    doc = await _load_proposal(db, proposal_id, user)
    copy = dict(doc)
    copy["_id"] = _new_id()
    copy["title"] = f"{doc.get('title')} (copy)"
    copy["status"] = "draft"
    copy["created_by"] = user["_id"]
    copy["created_by_name"] = user.get("username") or user.get("email") or ""
    copy["pdf_key"] = None
    copy["pdf_url"] = None
    copy["share_token"] = None
    copy["version"] = 1
    copy["created_at"] = _now()
    copy["updated_at"] = _now()
    await db["proposals"].insert_one(copy)
    await log_activity(db, user, "PROPOSAL_DUPLICATE", copy["_id"], f"Duplicated from {proposal_id}")
    return _proposal_out(copy)


@app.patch("/api/proposals/{proposal_id}/status")
async def set_status(
    proposal_id: str,
    payload: dict[str, Any],
    user: dict[str, Any] = Depends(require_operator),
) -> dict[str, Any]:
    db = _require_db()
    await _load_proposal(db, proposal_id, user)
    status = (payload.get("status") or "").strip().lower()
    if status not in PROPOSAL_STATUSES:
        raise HTTPException(status_code=400, detail="INVALID_STATUS")
    await db["proposals"].update_one(
        {"_id": proposal_id}, {"$set": {"status": status, "updated_at": _now()}}
    )
    await log_activity(db, user, "PROPOSAL_STATUS", proposal_id, f"Status -> {status}")
    return {"status": status}


@app.post("/api/proposals/{proposal_id}/generate")
async def regenerate(
    proposal_id: str,
    user: dict[str, Any] = Depends(require_operator),
) -> dict[str, Any]:
    """(Re)build pages from the template + current items. Overwrites page edits."""
    db = _require_db()
    doc = await _load_proposal(db, proposal_id, user)
    template = await db["proposal_templates"].find_one({"_id": doc.get("template_id")})
    if not template:
        template = await db["proposal_templates"].find_one({"slug": "lorenzo-classic"})
    if not template:
        raise HTTPException(status_code=400, detail="NO_TEMPLATE_AVAILABLE")
    pages = generate_pages(template, doc)
    pricing = compute_pricing(doc.get("items") or [], doc.get("pricing") or {})
    await db["proposals"].update_one(
        {"_id": proposal_id},
        {"$set": {"pages": pages, "pricing": pricing, "updated_at": _now()}},
    )
    await log_activity(db, user, "PROPOSAL_GENERATE", proposal_id, "Generated pages from template")
    updated = await db["proposals"].find_one({"_id": proposal_id})
    return _proposal_out(updated)


# ---------------------------------------------------------------------------
# Rendering / PDF export / sharing
# ---------------------------------------------------------------------------

async def _render_html(
    db: Any, doc: dict[str, Any], *, page_index: int | None, base_url: str, for_pdf: bool
) -> str:
    template = await db["proposal_templates"].find_one({"_id": doc.get("template_id")})
    if not template:
        template = await db["proposal_templates"].find_one({"slug": "lorenzo-classic"}) or {}
    return render_proposal_html(
        doc, template, page_index=page_index, base_url=base_url, for_pdf=for_pdf
    )


@app.get("/api/proposals/{proposal_id}/render", response_class=HTMLResponse)
async def render_proposal(
    proposal_id: str,
    user: dict[str, Any] = Depends(require_operator),
    page: int | None = Query(None, ge=0),
) -> HTMLResponse:
    db = _require_db()
    doc = await _load_proposal(db, proposal_id, user)
    html = await _render_html(db, doc, page_index=page, base_url="", for_pdf=False)
    return HTMLResponse(html)


@app.post("/api/proposals/{proposal_id}/export")
async def export_pdf(
    proposal_id: str,
    user: dict[str, Any] = Depends(require_operator),
) -> dict[str, Any]:
    db = _require_db()
    doc = await _load_proposal(db, proposal_id, user)
    if not doc.get("pages"):
        raise HTTPException(status_code=400, detail="PROPOSAL_HAS_NO_PAGES")
    html = await _render_html(
        db, doc, page_index=None, base_url=settings.proposals_internal_base, for_pdf=True
    )
    try:
        pdf_bytes = await html_to_pdf(html)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF_RENDER_FAILED: {e}")

    safe_title = sanitize_storage_name(doc.get("title") or "proposal")
    version = int(doc.get("version") or 1)
    key = f"{settings.aws_s3_proposals_prefix}/{proposal_id}/{safe_title}-v{version}.pdf"
    url = storage.put_bytes(key, pdf_bytes, content_type="application/pdf")
    await db["proposals"].update_one(
        {"_id": proposal_id},
        {"$set": {"pdf_key": key, "pdf_url": url, "updated_at": _now()}},
    )
    await log_activity(db, user, "PROPOSAL_EXPORT", proposal_id, f"Exported PDF v{version}")
    return {"pdf_key": key, "pdf_url": url, "size": len(pdf_bytes)}


@app.get("/api/proposals/{proposal_id}/pdf")
async def download_pdf(
    proposal_id: str,
    user: dict[str, Any] = Depends(require_operator),
) -> Response:
    db = _require_db()
    doc = await _load_proposal(db, proposal_id, user)
    if not doc.get("pdf_key"):
        raise HTTPException(status_code=404, detail="PDF_NOT_EXPORTED")
    data = storage.get_bytes(doc["pdf_key"])
    if data is None:
        raise HTTPException(status_code=404, detail="PDF_FILE_MISSING")
    filename = sanitize_storage_name(f"{doc.get('title') or 'proposal'}.pdf")
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@app.post("/api/proposals/{proposal_id}/share")
async def create_share_link(
    proposal_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_operator),
) -> dict[str, Any]:
    db = _require_db()
    doc = await _load_proposal(db, proposal_id, user)
    token = doc.get("share_token") or uuid.uuid4().hex
    await db["proposals"].update_one(
        {"_id": proposal_id}, {"$set": {"share_token": token, "updated_at": _now()}}
    )
    base = settings.proposals_public_base or str(request.base_url).rstrip("/")
    await log_activity(db, user, "PROPOSAL_SHARE", proposal_id, "Created share link")
    return {
        "share_token": token,
        "share_url": f"{base}/api/proposals/share/{token}",
        "share_pdf_url": f"{base}/api/proposals/share/{token}/pdf",
    }


@app.get("/api/proposals/share/{token}", response_class=HTMLResponse)
async def shared_view(token: str) -> HTMLResponse:
    """Public, read-only customer view (no login)."""
    db = _require_db()
    doc = await db["proposals"].find_one({"share_token": token})
    if not doc:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    html = await _render_html(db, doc, page_index=None, base_url="", for_pdf=False)
    return HTMLResponse(html)


@app.get("/api/proposals/share/{token}/pdf")
async def shared_pdf(token: str) -> Response:
    db = _require_db()
    doc = await db["proposals"].find_one({"share_token": token})
    if not doc or not doc.get("pdf_key"):
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    data = storage.get_bytes(doc["pdf_key"])
    if data is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    return Response(content=data, media_type="application/pdf")


# ---------------------------------------------------------------------------
# Assets (uploaded images / replaced product shots / brand uploads)
# ---------------------------------------------------------------------------

@app.post("/api/proposals/assets/upload")
async def upload_asset(
    user: dict[str, Any] = Depends(require_operator),
    file: UploadFile = File(...),
    kind: str = Query("image"),
) -> dict[str, Any]:
    db = _require_db()
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="FILE_TOO_LARGE")
    name = sanitize_storage_name(file.filename or "image")
    key = f"{settings.aws_s3_proposals_prefix}/assets/{_new_id()[:10]}-{name}"
    content_type = file.content_type or StorageBackend.guess_content_type(name)
    url = storage.put_bytes(key, data, content_type=content_type)
    doc = {
        "_id": _new_id(),
        "key": key,
        "url": url,
        "kind": kind,
        "filename": name,
        "content_type": content_type,
        "size": len(data),
        "uploaded_by": user["_id"],
        "created_at": _now(),
    }
    await db["proposal_assets"].insert_one(doc)
    return {**doc, "id": doc["_id"]}


@app.delete("/api/proposals/assets/{asset_id}")
async def delete_asset(
    asset_id: str,
    admin: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    db = _require_db()
    doc = await db["proposal_assets"].find_one({"_id": asset_id})
    if not doc:
        raise HTTPException(status_code=404, detail="ASSET_NOT_FOUND")
    storage.delete(doc["key"])
    await db["proposal_assets"].delete_one({"_id": asset_id})
    return {"deleted": True}


@app.get("/api/proposals/files/{key:path}")
async def serve_file(key: str) -> Response:
    """Serves locally-stored files (dev / volume mode). S3 mode uses public URLs."""
    if ".." in key:
        raise HTTPException(status_code=400, detail="INVALID_KEY")
    data = storage.get_bytes(key)
    if data is None:
        raise HTTPException(status_code=404, detail="FILE_NOT_FOUND")
    return Response(content=data, media_type=StorageBackend.guess_content_type(key))


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    print(f"✗  [proposals] Unhandled error: {exc}", flush=True)
    return JSONResponse(status_code=500, content={"detail": "INTERNAL_ERROR"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=settings.proposals_port, reload=True)
