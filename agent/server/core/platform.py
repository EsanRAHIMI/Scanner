"""Read-only access to the shared platform DB (lorenzodb) + tool handlers.

The agent NEVER writes to platform collections here. These functions back the
read-only tools (search_products, product/proposal lookups, status). Product
field resolution mirrors proposals/server/core/products.py so the agent sees the
same product identity the rest of the platform uses.
"""

from __future__ import annotations

import json
import re
import urllib.request
from typing import Any

# --- field aliases (mirror proposals/products) ---
_NAME = ["Collection Name", "Colecction Name", "Name"]
_CODE = ["Collection Code", "Colecction Code", "Code", "Code Number", "Code No"]
_CATEGORY = ["Category"]
_MATERIAL = ["Material"]
_COLOR = ["Color"]
_SPACE = ["Space"]
_SIZE = ["Size", "Dimensions", "Dimension"]
_PRICE = ["Price"]
_MAIN_IMAGE = ["Main Image", "Main Product Image"]


def _scalar(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list) and value:
        return _scalar(value[0])
    return ""


def _first(fields: dict[str, Any], keys: list[str]) -> str:
    lower = {k.strip().lower(): k for k in fields.keys()}
    for key in keys:
        actual = lower.get(key.lower())
        if actual is not None:
            v = _scalar(fields.get(actual))
            if v:
                return v
    return ""


def _extract_urls(value: Any) -> list[str]:
    out: list[str] = []
    if value is None:
        return out
    if isinstance(value, str):
        for part in re.split(r"[\n,\s]+", value.strip()):
            p = part.strip()
            if p.startswith("http"):
                out.append(p)
    elif isinstance(value, list):
        for item in value:
            if isinstance(item, dict) and isinstance(item.get("url"), str):
                out.append(item["url"])
            else:
                out.extend(_extract_urls(item))
    elif isinstance(value, dict) and isinstance(value.get("url"), str):
        out.append(value["url"])
    return out


def _media_urls(fields: dict[str, Any]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    lower = {k.strip().lower(): k for k in fields.keys()}
    for canonical in ("url", "image", "dam"):
        if canonical in lower:
            for u in _extract_urls(fields.get(lower[canonical])):
                if u not in seen:
                    seen.add(u)
                    out.append(u)
    return out


def _parse_price(raw: str) -> float | None:
    if not raw:
        return None
    cleaned = re.sub(r"[^\d.,]", "", raw).replace(",", "")
    parts = cleaned.split(".")
    if len(parts) == 2 and len(parts[1]) == 3:
        cleaned = cleaned.replace(".", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def normalize_product(doc: dict[str, Any]) -> dict[str, Any]:
    fields = doc.get("fields") or {}
    main = ""
    for k in _MAIN_IMAGE:
        urls = _extract_urls(fields.get(k))
        if urls:
            main = urls[0]
            break
    images = _media_urls(fields)
    price_raw = _first(fields, _PRICE)
    return {
        "id": doc.get("_id"),
        "name": _first(fields, _NAME),
        "code": _first(fields, _CODE),
        "category": _first(fields, _CATEGORY),
        "material": _first(fields, _MATERIAL),
        "color": _first(fields, _COLOR),
        "space": _first(fields, _SPACE),
        "size": _first(fields, _SIZE),
        "price": _parse_price(price_raw),
        "price_raw": price_raw,
        "main_image": main or (images[0] if images else None),
        "has_main_image": bool(main),
        "image_count": len(images),
    }


# ------------------------------------------------------- user / identity

async def _lookup_user_profile(rt: dict[str, Any]) -> dict[str, Any]:
    """Read-only enrichment of the signed-in user's profile.

    The trainer JWT only carries id/is_admin/permissions, so the display name and
    email are fetched from the shared `lorenzodb.users` collection by primary key
    (_id == token sub). Never writes; returns {} silently if unavailable so callers
    can still fall back to token-only identity.
    """
    user = rt.get("user") or {}
    uid = user.get("id")
    db = rt.get("platform_db")
    if not uid or db is None:
        return {}
    try:
        doc = await db["users"].find_one(
            {"_id": uid},
            {"password_hash": 0},
        )
    except Exception:  # noqa: BLE001 — identity lookup must never hard-fail the turn
        return {}
    if not doc:
        return {}
    return {
        "username": doc.get("username"),
        "email": doc.get("email"),
        "status": doc.get("status"),
        "role": doc.get("role"),
        "permissions": doc.get("permissions"),
    }


def _display_name(profile: dict[str, Any], user: dict[str, Any]) -> str | None:
    """Best available human name: username, else email local-part, else None."""
    name = (profile.get("username") or "").strip()
    if name:
        return name
    email = (profile.get("email") or "").strip()
    if email and "@" in email:
        return email.split("@", 1)[0]
    return None


async def build_user_identity(rt: dict[str, Any]) -> dict[str, Any]:
    """Authenticated identity + current page/selection context, merged.

    Shared by the `get_current_user_context` tool and the system-prompt stamp so
    both always agree. Token fields are authoritative for id/permissions; the
    read-only profile lookup adds the human name/email.
    """
    user = rt.get("user") or {}
    context = rt.get("context") or {}
    profile = await _lookup_user_profile(rt)
    role = profile.get("role") or user.get("role") or ("admin" if user.get("is_admin") else "user")
    permissions = profile.get("permissions")
    if not isinstance(permissions, list):
        permissions = user.get("permissions") or []
    selected = context.get("selected_product_ids") or []
    visible = context.get("visible_product_ids") or []
    return {
        "authenticated": bool(user.get("id")),
        "user_id": user.get("id"),
        "display_name": _display_name(profile, user),
        "username": profile.get("username"),
        "email": profile.get("email"),
        "is_admin": bool(user.get("is_admin")),
        "role": role,
        "permissions": permissions,
        "account_status": profile.get("status"),
        "profile_source": "platform_db.users" if profile else "token_only",
        "current_app": context.get("app"),
        "current_module": context.get("module"),
        "current_path": context.get("path"),
        "current_url": context.get("url"),
        "current_proposal_id": context.get("proposal_id"),
        "selected_product_ids": selected[:50] if isinstance(selected, list) else [],
        "selected_count": len(selected) if isinstance(selected, list) else 0,
        "visible_product_ids": visible[:80] if isinstance(visible, list) else [],
        "visible_count": len(visible) if isinstance(visible, list) else 0,
    }


async def tool_get_current_user_context(args: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any]:
    identity = await build_user_identity(rt)
    if not identity.get("authenticated"):
        return {"ok": False, "summary": "No authenticated user in this session."}
    name = identity.get("display_name") or identity.get("user_id")
    where = identity.get("current_app") or "the platform"
    return {
        "ok": True,
        "summary": f"Signed in as {name} ({identity.get('role')}) on {where}.",
        "data": identity,
    }


# ----------------------------------------------------------------- tools

async def tool_search_products(args: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any]:
    db = rt.get("platform_db")
    if db is None:
        return {"ok": False, "summary": "Platform DB not available."}
    query = str(args.get("query") or "").strip()
    category = str(args.get("category") or "").strip()
    limit = max(1, min(int(args.get("limit") or 12), 25))
    clauses: list[dict[str, Any]] = []
    if query:
        rx = re.compile(re.escape(query), re.IGNORECASE)
        clauses.append({"$or": [{f"fields.{k}": rx} for k in _NAME + _CODE + _CATEGORY]})
    if category:
        clauses.append({"fields.Category": re.compile(f"^{re.escape(category)}$", re.IGNORECASE)})
    mongo_query = {"$and": clauses} if len(clauses) > 1 else (clauses[0] if clauses else {})
    docs = await db["products"].find(mongo_query).limit(limit).to_list(length=limit)
    records = [normalize_product(d) for d in docs]
    return {
        "ok": True,
        "summary": f"{len(records)} product(s) found"
        + (f" for '{query}'" if query else ""),
        "data": {"count": len(records), "products": records},
    }


async def tool_get_product_details(args: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any]:
    db = rt.get("platform_db")
    if db is None:
        return {"ok": False, "summary": "Platform DB not available."}
    pid = str(args.get("product_id") or "").strip()
    if not pid:
        ids = (rt.get("context") or {}).get("selected_product_ids") or []
        pid = ids[0] if ids else ""
    if not pid:
        return {"ok": False, "summary": "No product_id provided."}
    doc = await db["products"].find_one({"_id": pid})
    if not doc:
        return {"ok": False, "summary": f"Product {pid} not found."}
    p = normalize_product(doc)
    return {"ok": True, "summary": f"Product: {p.get('name') or p.get('code') or pid}", "data": p}


async def _fetch_products_by_ids(db: Any, ids: list[str], limit: int = 50) -> list[dict[str, Any]]:
    safe_ids = [str(i) for i in ids if i][:limit]
    # Motor DB objects block bool() — must compare with None explicitly.
    if db is None or not safe_ids:
        return []
    docs = await db["products"].find({"_id": {"$in": safe_ids}}).to_list(length=len(safe_ids))
    by_id = {d.get("_id"): d for d in docs}
    # Preserve the caller's order (selection / visible order is meaningful).
    return [normalize_product(by_id[i]) for i in safe_ids if i in by_id]


async def tool_get_selected_products(args: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any]:
    db = rt.get("platform_db")
    if db is None:
        return {"ok": False, "summary": "Platform DB not available."}
    ids = (rt.get("context") or {}).get("selected_product_ids") or []
    if not isinstance(ids, list) or not ids:
        return {"ok": True, "summary": "No products are selected right now.",
                "data": {"count": 0, "products": []}}
    products = await _fetch_products_by_ids(db, ids)
    return {
        "ok": True,
        "summary": f"{len(products)} selected product(s).",
        "data": {"count": len(products), "products": products, "source": "current_selection"},
    }


async def tool_get_visible_products_context(args: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any]:
    db = rt.get("platform_db")
    if db is None:
        return {"ok": False, "summary": "Platform DB not available."}
    ctx = rt.get("context") or {}
    ids = ctx.get("visible_product_ids") or []
    if not isinstance(ids, list) or not ids:
        return {"ok": True,
                "summary": "No on-screen product rows were reported by the current page.",
                "data": {"count": 0, "products": [], "app": ctx.get("app")}}
    products = await _fetch_products_by_ids(db, ids, limit=80)
    return {
        "ok": True,
        "summary": f"{len(products)} product(s) currently visible on screen.",
        "data": {"count": len(products), "products": products, "source": "current_viewport"},
    }


# Documented business meaning of the schemaless product fields (Airtable mirror).
_FIELD_SCHEMA_DOC = [
    {"field": "Num", "aliases": [], "meaning": "Stable business ordering number for the catalog (primary sort)."},
    {"field": "Collection Name", "aliases": _NAME, "meaning": "Product/collection display name."},
    {"field": "Collection Code", "aliases": _CODE, "meaning": "Product code / SKU."},
    {"field": "Category", "aliases": _CATEGORY, "meaning": "Product category (e.g. chandelier, table)."},
    {"field": "Material", "aliases": _MATERIAL, "meaning": "Primary material."},
    {"field": "Color", "aliases": _COLOR, "meaning": "Color/finish."},
    {"field": "Space", "aliases": _SPACE, "meaning": "Intended room/space."},
    {"field": "Size", "aliases": _SIZE, "meaning": "Dimensions."},
    {"field": "Price", "aliases": _PRICE, "meaning": "Price (raw text; parsed to a number where possible)."},
    {"field": "Main Image", "aliases": _MAIN_IMAGE, "meaning": "The chosen primary image used for official composed presentation."},
    {"field": "URL", "aliases": ["URL", "Image", "DAM"], "meaning": "Media/image URLs (gallery); first is the fallback main image."},
]


async def tool_get_product_fields_schema(args: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any]:
    """Explain the product table fields (documented aliases) and, when possible,
    list the actual field keys present on a sample product doc. Read-only."""
    db = rt.get("platform_db")
    actual_keys: list[str] = []
    if db is not None:
        try:
            sample = await db["products"].find_one({}, {"fields": 1})
            if sample and isinstance(sample.get("fields"), dict):
                actual_keys = sorted(sample["fields"].keys())
        except Exception:  # noqa: BLE001
            actual_keys = []
    return {
        "ok": True,
        "summary": f"{len(_FIELD_SCHEMA_DOC)} documented product fields.",
        "data": {"fields": _FIELD_SCHEMA_DOC, "actual_field_keys": actual_keys},
    }


async def tool_get_recent_proposals(args: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any]:
    db = rt.get("platform_db")
    user = rt.get("user") or {}
    if db is None:
        return {"ok": False, "summary": "Platform DB not available."}
    limit = max(1, min(int(args.get("limit") or 8), 20))
    q: dict[str, Any] = {}
    if not user.get("is_admin"):
        q["created_by"] = user.get("id")
    docs = (
        await db["proposals"]
        .find(q, {"pages": 0})
        .sort("updated_at", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    items = [
        {
            "id": d.get("_id"),
            "title": d.get("title"),
            "status": d.get("status"),
            "customer": (d.get("customer") or {}).get("name"),
            "total": (d.get("pricing") or {}).get("total"),
            "currency": (d.get("pricing") or {}).get("currency"),
            "updated_at": d.get("updated_at"),
        }
        for d in docs
    ]
    return {"ok": True, "summary": f"{len(items)} recent proposal(s).", "data": {"proposals": items}}


async def tool_get_proposal_details(args: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any]:
    db = rt.get("platform_db")
    user = rt.get("user") or {}
    if db is None:
        return {"ok": False, "summary": "Platform DB not available."}
    pid = str(args.get("proposal_id") or "").strip()
    if not pid:
        pid = str((rt.get("context") or {}).get("proposal_id") or "").strip()
    if not pid:
        return {"ok": False, "summary": "No proposal_id provided."}
    doc = await db["proposals"].find_one({"_id": pid}, {"pages": 0})
    if not doc:
        return {"ok": False, "summary": f"Proposal {pid} not found."}
    if not user.get("is_admin") and doc.get("created_by") != user.get("id"):
        return {"ok": False, "summary": "You don't have access to that proposal."}
    items = [
        {"name": it.get("name"), "room": it.get("room"), "qty": it.get("qty"), "price": it.get("price")}
        for it in (doc.get("items") or [])
    ]
    data = {
        "id": doc.get("_id"),
        "title": doc.get("title"),
        "status": doc.get("status"),
        "customer": doc.get("customer"),
        "project": doc.get("project"),
        "pricing": doc.get("pricing"),
        "item_count": len(items),
        "items": items[:40],
    }
    return {"ok": True, "summary": f"Proposal: {doc.get('title')}", "data": data}


async def tool_get_current_proposal_context(args: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any]:
    """Summarize the proposal the user is currently viewing (from page context).
    Returns a clear 'no current proposal' when none is open — never guesses."""
    db = rt.get("platform_db")
    user = rt.get("user") or {}
    ctx = rt.get("context") or {}
    if db is None:
        return {"ok": False, "summary": "Platform DB not available."}
    pid = str(ctx.get("proposal_id") or "").strip()
    if not pid:
        return {"ok": True, "summary": "No proposal is currently open.",
                "data": {"has_current_proposal": False, "app": ctx.get("app")}}
    doc = await db["proposals"].find_one({"_id": pid}, {"pages": 0})
    if not doc:
        return {"ok": False, "summary": f"Current proposal {pid} not found."}
    if not user.get("is_admin") and doc.get("created_by") != user.get("id"):
        return {"ok": False, "summary": "You don't have access to the current proposal."}
    items = doc.get("items") or []
    data = {
        "has_current_proposal": True,
        "id": doc.get("_id"),
        "title": doc.get("title"),
        "status": doc.get("status"),
        "customer": doc.get("customer"),
        "pricing": doc.get("pricing"),
        "item_count": len(items),
    }
    return {"ok": True, "summary": f"Current proposal: {doc.get('title')}", "data": data}


def _product_image_context(p: dict[str, Any], fields: dict[str, Any]) -> dict[str, Any]:
    gallery = _media_urls(fields)
    return {
        "id": p.get("id"),
        "name": p.get("name"),
        "code": p.get("code"),
        "has_main_image": p.get("has_main_image"),
        "main_image": p.get("main_image"),
        "gallery_count": len(gallery),
        "gallery": gallery[:12],
        # Official presentation is produced by the image service compose flow; the
        # agent only reports availability and never triggers a render.
        "official_compose_available": bool(p.get("has_main_image")),
    }


async def tool_get_product_image_context(args: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any]:
    db = rt.get("platform_db")
    if db is None:
        return {"ok": False, "summary": "Platform DB not available."}
    ctx = rt.get("context") or {}
    pid = str(args.get("product_id") or "").strip()
    if not pid:
        sel = ctx.get("selected_product_ids") or []
        vis = ctx.get("visible_product_ids") or []
        pid = (sel[0] if sel else (vis[0] if vis else ""))
    if not pid:
        return {"ok": False, "summary": "No product in context — provide a product_id."}
    doc = await db["products"].find_one({"_id": pid})
    if not doc:
        return {"ok": False, "summary": f"Product {pid} not found."}
    p = normalize_product(doc)
    data = _product_image_context(p, doc.get("fields") or {})
    state = "has a main image" if data["has_main_image"] else "has NO main image set"
    return {"ok": True, "summary": f"{p.get('name') or pid} {state}.", "data": data}


async def tool_get_main_image_status(args: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any]:
    """Report which selected (or visible) products have a Main Image set vs missing.
    Read-only — does not set or compose any image."""
    db = rt.get("platform_db")
    if db is None:
        return {"ok": False, "summary": "Platform DB not available."}
    ctx = rt.get("context") or {}
    ids = ctx.get("selected_product_ids") or []
    source = "selection"
    if not ids:
        ids = ctx.get("visible_product_ids") or []
        source = "viewport"
    if not isinstance(ids, list) or not ids:
        return {"ok": True, "summary": "No products in context to check.",
                "data": {"count": 0, "with_main": 0, "missing_main": 0, "missing": []}}
    products = await _fetch_products_by_ids(db, ids, limit=80)
    missing = [{"id": p.get("id"), "name": p.get("name"), "code": p.get("code")}
               for p in products if not p.get("has_main_image")]
    with_main = len(products) - len(missing)
    return {
        "ok": True,
        "summary": f"{with_main}/{len(products)} have a main image; {len(missing)} missing ({source}).",
        "data": {"count": len(products), "with_main": with_main,
                 "missing_main": len(missing), "missing": missing[:50], "source": source},
    }


async def tool_get_image_service_status(args: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any]:
    import asyncio

    settings = rt.get("settings")
    base = getattr(settings, "image_api_base", None)
    if not base:
        return {"ok": False, "summary": "Image service URL not configured (IMAGE_API_BASE)."}

    def _fetch() -> dict[str, Any]:
        req = urllib.request.Request(base.rstrip("/") + "/api/v1/health")
        with urllib.request.urlopen(req, timeout=8) as resp:  # noqa: S310
            return json.loads(resp.read().decode("utf-8"))

    try:
        health = await asyncio.to_thread(_fetch)
        return {"ok": True, "summary": "Image service is reachable.", "data": health}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "summary": f"Image service not reachable: {e}"}


async def tool_get_platform_status(args: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any]:
    platform_db = rt.get("platform_db")
    data: dict[str, Any] = {
        "services": ["products", "proposals", "images", "marketing", "trainer"],
        "platform_db": platform_db is not None,
    }
    if platform_db is not None:
        try:
            data["product_count"] = await platform_db["products"].estimated_document_count()
            data["proposal_count"] = await platform_db["proposals"].estimated_document_count()
        except Exception:  # noqa: BLE001
            pass
    return {"ok": True, "summary": "Platform status retrieved.", "data": data}


async def tool_remember_preference(args: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any]:
    """Stores a single curated preference in the agent's OWN per-user memory
    (lorenzo_agent). This is NOT a platform write — safe to run automatically."""
    from .memory import remember

    agent_db = rt.get("agent_db")
    user = rt.get("user") or {}
    if agent_db is None:
        return {"ok": False, "summary": "Memory store unavailable."}
    key = str(args.get("key") or "").strip()
    value = str(args.get("value") or "").strip()
    kind = str(args.get("kind") or "preference").strip() or "preference"
    if not key or not value:
        return {"ok": False, "summary": "Both key and value are required."}
    _REASONS = {
        "MEMORY_SENSITIVE_BLOCKED": "I won't store sensitive data (passwords, tokens, "
        "card or ID numbers). Tell me a durable preference instead.",
        "MEMORY_KEY_VALUE_REQUIRED": "Both a key and a value are required.",
        "MEMORY_REQUIRES_USER": "Memory is per-user and needs a signed-in user.",
    }
    try:
        await remember(agent_db, user.get("id"), kind, key, value, source="agent")
    except ValueError as e:  # curation guard rejected the write
        return {"ok": False, "summary": _REASONS.get(str(e), "Couldn't save that to memory.")}
    return {"ok": True, "summary": f"Remembered: {key} = {value}"}
