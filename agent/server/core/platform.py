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
    await remember(agent_db, user.get("id"), kind, key, value, source="agent")
    return {"ok": True, "summary": f"Remembered: {key} = {value}"}
