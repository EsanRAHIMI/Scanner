"""Content, campaigns, initiatives, people, assets, and search.

Content and campaigns stay in the collections the Trainer calendar already uses
(`content_calendar`, `marketing_campaigns`). New keys are added beside the old
ones, so the classic calendar keeps reading and writing the same documents.
"""

from __future__ import annotations

import re
import time
from datetime import date, datetime, timezone
from typing import Any
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import HTTPException

from .db import require_db

CONTENT_STAGES = ("Idea", "Brief", "Production", "Review", "Approved", "Scheduled", "Published")
CONTENT_CHANNELS = ("Instagram", "Facebook", "LinkedIn", "Pinterest", "TikTok", "YouTube", "Snapchat", "Website")
CONTENT_MODES = ("Organic", "Paid", "Both")
KPI_KEYS = ("likes", "comments", "clicks", "leads")
_LEGACY_STAGE = {
    "needs plan": "Idea",
    "drafts": "Brief",
    "draft": "Brief",
    "in progress": "Production",
}
_HOST_CHANNEL = {
    "instagram.com": "Instagram",
    "facebook.com": "Facebook",
    "fb.watch": "Facebook",
    "linkedin.com": "LinkedIn",
    "pinterest.com": "Pinterest",
    "pin.it": "Pinterest",
    "tiktok.com": "TikTok",
    "youtube.com": "YouTube",
    "youtu.be": "YouTube",
    "snapchat.com": "Snapchat",
    "lorenzolighting.com": "Website",
    "lorenzohome.ae": "Website",
}

CAMPAIGN_STATES = ("Active", "Paused", "Cancelled")
INITIATIVE_STATUSES = ("Not started", "Active", "Blocked", "On hold", "Done")
PRIORITIES = ("High", "Medium", "Low")
SEED_INITIATIVES = (
    "Downtown Design",
    "2027 Campaign",
    "Showroom Branding",
    "Billboard",
    "UK Brand",
    "Awards",
    "Hospitality",
    "Magic Room",
    "Tablets",
    "Photo/Video Shoots",
)
_WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
_HAS_IMAGE = {"fields.Image.0.url": {"$exists": True}}
_category_cache: tuple[float, list[str]] | None = None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _text(value: Any, limit: int, field: str) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"INVALID_{field.upper()}")
    clean = value.strip()
    if len(clean) > limit:
        raise HTTPException(status_code=400, detail=f"{field.upper()}_TOO_LONG")
    return clean


def day_or_none(value: Any, field: str = "date") -> str | None:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(str(value).strip()[:10]).isoformat()
    except ValueError:
        raise HTTPException(status_code=400, detail=f"INVALID_{field.upper()}")


def amount_or_none(value: Any, field: str = "amount") -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"INVALID_{field.upper()}")
    if number < 0 or number > 100_000_000:
        raise HTTPException(status_code=400, detail=f"INVALID_{field.upper()}")
    return round(number, 2)


def _number(value: Any) -> float | None:
    if value is None or value == "" or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if value >= 0 else None
    text = str(value).replace(",", "").strip()
    try:
        number = float(text)
    except ValueError:
        return None
    return number if number >= 0 else None


def _parts(raw: Any) -> list[str]:
    if isinstance(raw, list):
        return [str(item).strip() for item in raw if str(item).strip()]
    if not isinstance(raw, str):
        return []
    return [part.strip() for part in re.split(r"[,;\n]+", raw) if part.strip()]


def _bool(raw: Any) -> bool:
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str):
        return raw.strip().lower() in ("1", "true", "yes", "on")
    return bool(raw)


def _pattern(q: str) -> re.Pattern[str]:
    return re.compile(re.escape(q.strip()[:80]), re.IGNORECASE)


# ─── Content ───────────────────────────────────────────────────────────────


def content_stage(raw: Any) -> str:
    text = str(raw or "").strip()
    if text in CONTENT_STAGES:
        return text
    return _LEGACY_STAGE.get(text.lower(), "Idea")


def _channels_from_link(link: str) -> list[str]:
    try:
        host = (urlsplit(link).hostname or "").lower()
    except ValueError:
        return []
    for suffix, name in _HOST_CHANNEL.items():
        if host == suffix or host.endswith(f".{suffix}"):
            return [name]
    return []


def is_planning_placeholder(doc: dict[str, Any]) -> bool:
    """Empty rows the classic calendar creates for campaigns without content."""
    fields = doc.get("fields") if isinstance(doc.get("fields"), dict) else {}
    return not str(fields.get("Title") or "").strip() and str(fields.get("Status") or "").strip() == "Needs plan"


def content_public(doc: dict[str, Any], campaigns: dict[str, str] | None = None) -> dict[str, Any]:
    fields = doc.get("fields") if isinstance(doc.get("fields"), dict) else {}
    link = str(fields.get("Content Link") or "").strip()
    channels = [name for name in _parts(fields.get("Channels")) if name in CONTENT_CHANNELS]
    if not channels and link:
        channels = _channels_from_link(link)
    campaign_id = str(fields.get("Campaign ID") or fields.get("_campaign_planning_id") or "").strip() or None
    kpi_raw = fields.get("KPI") if isinstance(fields.get("KPI"), dict) else {}
    kpi = {"views": _number(fields.get("Social Views"))}
    for key in KPI_KEYS:
        kpi[key] = _number(kpi_raw.get(key))
    mode = str(fields.get("Mode") or "").strip()
    publish = doc.get("publish_date") or fields.get("Publish Date") or None
    return {
        "id": str(doc.get("_id")),
        "title": str(fields.get("Title") or "").strip(),
        "status": content_stage(fields.get("Status")),
        "publish_date": str(publish)[:10] if publish else None,
        "due_date": str(fields.get("Due Date") or "")[:10] or None,
        "channels": channels,
        "format": str(fields.get("Format") or "").strip(),
        "pillar": str(fields.get("Content Pillar") or "").strip(),
        "hero_product": str(fields.get("Product") or "").strip(),
        "owner": str(fields.get("Owner") or "").strip(),
        "campaign_id": campaign_id,
        "campaign_name": (campaigns or {}).get(campaign_id or "") if campaign_id else None,
        "mode": mode if mode in CONTENT_MODES else None,
        "caption": str(fields.get("Caption Idea") or ""),
        "brief": str(fields.get("Brief") or ""),
        "assets": _parts(str(fields.get("Assets") or "").replace(",", "\n")) if fields.get("Assets") else [],
        "content_link": link,
        "kpi": kpi,
        "updated_at": doc.get("updated_at"),
    }


async def _campaign_names() -> dict[str, str]:
    database = require_db()
    rows = await database["marketing_campaigns"].find({}, {"name": 1}).to_list(length=1000)
    return {str(row["_id"]): str(row.get("name") or "") for row in rows}


async def list_content(start: str | None, end: str | None) -> dict[str, Any]:
    database = require_db()
    query: dict[str, Any] = {}
    start_day = day_or_none(start, "from")
    end_day = day_or_none(end, "to")
    if start_day or end_day:
        window: dict[str, str] = {}
        if start_day:
            window["$gte"] = start_day
        if end_day:
            window["$lte"] = end_day
        query = {
            "$or": [
                {"publish_date": window},
                {"fields.Due Date": window},
                {"publish_date": None, "fields.Due Date": {"$in": [None, ""]}},
            ]
        }
    docs = await database["content_calendar"].find(query).sort([("publish_date", 1), ("created_at", -1)]).to_list(length=2000)
    names = await _campaign_names()
    return {"items": [content_public(doc, names) for doc in docs if not is_planning_placeholder(doc)]}


def _content_patch(body: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if "title" in body:
        title = _text(body["title"], 200, "title")
        if not title:
            raise HTTPException(status_code=400, detail="TITLE_REQUIRED")
        out["fields.Title"] = title
    if "status" in body:
        if body["status"] not in CONTENT_STAGES:
            raise HTTPException(status_code=400, detail="INVALID_STATUS")
        out["fields.Status"] = body["status"]
    if "publish_date" in body:
        day = day_or_none(body["publish_date"], "publish_date")
        out["fields.Publish Date"] = day or ""
        out["publish_date"] = day
        out["fields.Day of Week"] = _WEEKDAYS[date.fromisoformat(day).weekday()] if day else ""
    if "due_date" in body:
        out["fields.Due Date"] = day_or_none(body["due_date"], "due_date") or ""
    if "channels" in body:
        channels = body["channels"] or []
        if not isinstance(channels, list) or any(name not in CONTENT_CHANNELS for name in channels):
            raise HTTPException(status_code=400, detail="INVALID_CHANNELS")
        ordered = [name for name in CONTENT_CHANNELS if name in channels]
        out["fields.Channels"] = ", ".join(ordered)
    for key, field, limit in (
        ("format", "Format", 60),
        ("pillar", "Content Pillar", 60),
        ("hero_product", "Product", 120),
        ("owner", "Owner", 80),
        ("caption", "Caption Idea", 5000),
        ("brief", "Brief", 5000),
        ("content_link", "Content Link", 1000),
    ):
        if key in body:
            out[f"fields.{field}"] = _text(body[key], limit, key)
    if "mode" in body:
        mode = body["mode"] or ""
        if mode and mode not in CONTENT_MODES:
            raise HTTPException(status_code=400, detail="INVALID_MODE")
        out["fields.Mode"] = mode
    if "assets" in body:
        assets = body["assets"] or []
        if not isinstance(assets, list) or len(assets) > 30:
            raise HTTPException(status_code=400, detail="INVALID_ASSETS")
        clean = [_text(item, 1000, "asset") for item in assets]
        clean = [item for item in clean if item]
        out["fields.Assets"] = "\n".join(clean)
        out["fields.Product Image"] = clean[0] if clean else ""
    if "kpi" in body:
        kpi = body["kpi"] or {}
        if not isinstance(kpi, dict):
            raise HTTPException(status_code=400, detail="INVALID_KPI")
        if "views" in kpi:
            views = amount_or_none(kpi.get("views"), "views")
            out["fields.Social Views"] = "" if views is None else str(int(views))
        stored = {key: amount_or_none(kpi.get(key), key) for key in KPI_KEYS if key in kpi}
        for key, value in stored.items():
            out[f"fields.KPI.{key}"] = value
    return out


async def _ensure_campaign(campaign_id: Any) -> str:
    if campaign_id in (None, ""):
        return ""
    database = require_db()
    if not await database["marketing_campaigns"].find_one({"_id": str(campaign_id)}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="CAMPAIGN_NOT_FOUND")
    return str(campaign_id)


async def create_content(body: dict[str, Any], user_id: str) -> dict[str, Any]:
    database = require_db()
    if not str(body.get("title") or "").strip():
        raise HTTPException(status_code=400, detail="TITLE_REQUIRED")
    body = {"status": "Idea", **body}
    patch = _content_patch(body)
    if "campaign_id" in body:
        patch["fields.Campaign ID"] = await _ensure_campaign(body.get("campaign_id"))
    fields: dict[str, Any] = {}
    top: dict[str, Any] = {"publish_date": None}
    for key, value in patch.items():
        if key.startswith("fields.KPI."):
            fields.setdefault("KPI", {})[key.split(".", 2)[2]] = value
        elif key.startswith("fields."):
            fields[key[len("fields."):]] = value
        else:
            top[key] = value
    stamp = now_iso()
    doc = {
        "_id": str(uuid4()),
        "fields": fields,
        **top,
        "created_at": stamp,
        "updated_at": stamp,
        "created_by": user_id,
        "updated_by": user_id,
    }
    await database["content_calendar"].insert_one(doc)
    return content_public(doc, await _campaign_names())


async def update_content(item_id: str, body: dict[str, Any], user_id: str) -> dict[str, Any]:
    database = require_db()
    patch = _content_patch(body)
    if "campaign_id" in body:
        patch["fields.Campaign ID"] = await _ensure_campaign(body.get("campaign_id"))
    if not patch:
        raise HTTPException(status_code=400, detail="EMPTY_PATCH")
    current = await database["content_calendar"].find_one({"_id": item_id}, {"fields.KPI": 1})
    if current is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    if not isinstance((current.get("fields") or {}).get("KPI"), dict):
        kpi = {key.split(".", 2)[2]: value for key, value in patch.items() if key.startswith("fields.KPI.")}
        patch = {key: value for key, value in patch.items() if not key.startswith("fields.KPI.")}
        if kpi:
            patch["fields.KPI"] = kpi
    patch["updated_at"] = now_iso()
    patch["updated_by"] = user_id
    await database["content_calendar"].update_one({"_id": item_id}, {"$set": patch})
    doc = await database["content_calendar"].find_one({"_id": item_id})
    return content_public(doc or {}, await _campaign_names())


async def delete_content(item_id: str) -> dict[str, Any]:
    database = require_db()
    res = await database["content_calendar"].delete_one({"_id": item_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    await database["marketing_os_work"].update_many(
        {"link_type": "content", "link_id": item_id}, {"$set": {"link_type": None, "link_id": None}}
    )
    return {"ok": True}


# ─── Campaigns ─────────────────────────────────────────────────────────────


def campaign_status(doc: dict[str, Any], today: date | None = None) -> str:
    state = str(doc.get("state") or "Active")
    if state in ("Paused", "Cancelled"):
        return state
    today_iso = (today or date.today()).isoformat()
    start = str(doc.get("start_date") or "")[:10]
    end = str(doc.get("end_date") or "")[:10] or start
    if start and today_iso < start:
        return "Planned"
    if end and today_iso > end:
        return "Done"
    return "Live"


def campaign_public(doc: dict[str, Any], today: date | None = None) -> dict[str, Any]:
    end = doc.get("end_date") if isinstance(doc.get("end_date"), str) and doc.get("end_date") else None
    mode = str(doc.get("mode") or "").strip()
    return {
        "id": str(doc.get("_id")),
        "name": str(doc.get("name") or ""),
        "objective": str(doc.get("goal") or ""),
        "start_date": doc.get("start_date"),
        "end_date": end,
        "color": doc.get("color") if _COLOR.match(str(doc.get("color") or "")) else "#6366f1",
        "channels": _parts(doc.get("channels")),
        "is_critical": _bool(doc.get("is_critical")),
        "mode": mode if mode in CONTENT_MODES else None,
        "budget_aed": _number(doc.get("budget_aed")),
        "owner": str(doc.get("owner") or ""),
        "state": doc.get("state") if doc.get("state") in CAMPAIGN_STATES else "Active",
        "status": campaign_status(doc, today),
        "landing_url": str(doc.get("landing_url") or ""),
        "creatives": _parts(doc.get("creatives")) if isinstance(doc.get("creatives"), list) else [],
        "kpi_target": str(doc.get("kpi_target") or ""),
        "results": str(doc.get("results") or ""),
        "updated_at": doc.get("updated_at"),
    }


def _campaign_doc(merged: dict[str, Any]) -> dict[str, Any]:
    name = _text(merged.get("name"), 160, "name")
    if not name:
        raise HTTPException(status_code=400, detail="NAME_REQUIRED")
    start = day_or_none(merged.get("start_date"), "start_date")
    if not start:
        raise HTTPException(status_code=400, detail="START_DATE_REQUIRED")
    end = day_or_none(merged.get("end_date"), "end_date")
    if end and end < start:
        raise HTTPException(status_code=400, detail="END_DATE_BEFORE_START")
    color = str(merged.get("color") or "#6366f1")
    channels = merged.get("channels") or []
    if isinstance(channels, str):
        channels = _parts(channels)
    if not isinstance(channels, list):
        raise HTTPException(status_code=400, detail="INVALID_CHANNELS")
    mode = merged.get("mode") or ""
    if mode and mode not in CONTENT_MODES:
        raise HTTPException(status_code=400, detail="INVALID_MODE")
    state = merged.get("state") or "Active"
    if state not in CAMPAIGN_STATES:
        raise HTTPException(status_code=400, detail="INVALID_STATE")
    creatives = merged.get("creatives") or []
    if not isinstance(creatives, list) or len(creatives) > 30:
        raise HTTPException(status_code=400, detail="INVALID_CREATIVES")
    return {
        "name": name,
        "goal": _text(merged.get("objective"), 4000, "objective"),
        "start_date": start,
        "end_date": end,
        "color": color if _COLOR.match(color) else "#6366f1",
        "channels": ", ".join(_text(item, 40, "channel") for item in channels if str(item).strip()),
        "is_critical": _bool(merged.get("is_critical")),
        "mode": mode,
        "budget_aed": amount_or_none(merged.get("budget_aed"), "budget"),
        "owner": _text(merged.get("owner"), 80, "owner"),
        "state": state,
        "landing_url": _text(merged.get("landing_url"), 1000, "landing_url"),
        "creatives": [item for item in (_text(c, 1000, "creative") for c in creatives) if item],
        "kpi_target": _text(merged.get("kpi_target"), 500, "kpi_target"),
        "results": _text(merged.get("results"), 4000, "results"),
    }


async def _link_counts() -> tuple[dict[str, dict[str, int]], dict[tuple[str, str], int]]:
    database = require_db()
    content: dict[str, dict[str, int]] = {}
    async for doc in database["content_calendar"].find({}, {"fields": 1}):
        if is_planning_placeholder(doc):
            continue
        item = content_public(doc)
        if not item["campaign_id"]:
            continue
        slot = content.setdefault(item["campaign_id"], {"total": 0, "published": 0, "views": 0})
        slot["total"] += 1
        if item["status"] == "Published":
            slot["published"] += 1
        if item["kpi"]["views"]:
            slot["views"] += int(item["kpi"]["views"])
    tasks: dict[tuple[str, str], int] = {}
    async for doc in database["marketing_os_work"].find(
        {"open": {"$ne": False}, "stage": {"$ne": "Done"}, "link_id": {"$nin": [None, ""]}},
        {"link_type": 1, "link_id": 1},
    ):
        key = (str(doc.get("link_type")), str(doc.get("link_id")))
        tasks[key] = tasks.get(key, 0) + 1
    return content, tasks


async def list_campaigns() -> dict[str, Any]:
    database = require_db()
    docs = await database["marketing_campaigns"].find({}).sort([("start_date", -1)]).to_list(length=1000)
    content, tasks = await _link_counts()
    items = []
    for doc in docs:
        item = campaign_public(doc)
        item["content"] = content.get(item["id"], {"total": 0, "published": 0, "views": 0})
        item["open_tasks"] = tasks.get(("campaign", item["id"]), 0)
        items.append(item)
    return {"items": items}


async def create_campaign(body: dict[str, Any], user_id: str) -> dict[str, Any]:
    database = require_db()
    stamp = now_iso()
    doc = {
        "_id": str(uuid4()),
        **_campaign_doc(body),
        "created_at": stamp,
        "updated_at": stamp,
        "created_by": user_id,
        "updated_by": user_id,
    }
    await database["marketing_campaigns"].insert_one(doc)
    return campaign_public(doc)


async def update_campaign(campaign_id: str, body: dict[str, Any], user_id: str) -> dict[str, Any]:
    database = require_db()
    current = await database["marketing_campaigns"].find_one({"_id": campaign_id})
    if current is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    merged = {**campaign_public(current), **body}
    patch = {**_campaign_doc(merged), "updated_at": now_iso(), "updated_by": user_id}
    await database["marketing_campaigns"].update_one({"_id": campaign_id}, {"$set": patch})
    return campaign_public({**current, **patch})


async def delete_campaign(campaign_id: str) -> dict[str, Any]:
    database = require_db()
    res = await database["marketing_campaigns"].delete_one({"_id": campaign_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    await database["content_calendar"].update_many({"fields.Campaign ID": campaign_id}, {"$set": {"fields.Campaign ID": ""}})
    await database["marketing_os_work"].update_many(
        {"link_type": "campaign", "link_id": campaign_id}, {"$set": {"link_type": None, "link_id": None}}
    )
    return {"ok": True}


# ─── Initiatives ───────────────────────────────────────────────────────────


def initiative_public(doc: dict[str, Any]) -> dict[str, Any]:
    files = []
    for item in doc.get("files") or []:
        if isinstance(item, dict) and item.get("url"):
            files.append({"label": str(item.get("label") or ""), "url": str(item["url"])})
    return {
        "id": str(doc.get("_id")),
        "name": str(doc.get("name") or ""),
        "owner": str(doc.get("owner") or ""),
        "priority": doc.get("priority") if doc.get("priority") in PRIORITIES else "Medium",
        "deadline": doc.get("deadline"),
        "status": doc.get("status") if doc.get("status") in INITIATIVE_STATUSES else "Not started",
        "budget_aed": _number(doc.get("budget_aed")),
        "spent_aed": _number(doc.get("spent_aed")),
        "blockers": str(doc.get("blockers") or ""),
        "files": files,
        "notes": str(doc.get("notes") or ""),
        "updated_at": doc.get("updated_at"),
    }


def _initiative_doc(merged: dict[str, Any]) -> dict[str, Any]:
    name = _text(merged.get("name"), 120, "name")
    if not name:
        raise HTTPException(status_code=400, detail="NAME_REQUIRED")
    priority = merged.get("priority") or "Medium"
    status = merged.get("status") or "Not started"
    if priority not in PRIORITIES or status not in INITIATIVE_STATUSES:
        raise HTTPException(status_code=400, detail="INVALID_INITIATIVE")
    files = merged.get("files") or []
    if not isinstance(files, list) or len(files) > 40:
        raise HTTPException(status_code=400, detail="INVALID_FILES")
    clean_files = []
    for item in files:
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail="INVALID_FILES")
        url = _text(item.get("url"), 1000, "file_url")
        if url:
            clean_files.append({"label": _text(item.get("label"), 120, "file_label"), "url": url})
    return {
        "name": name,
        "owner": _text(merged.get("owner"), 80, "owner"),
        "priority": priority,
        "deadline": day_or_none(merged.get("deadline"), "deadline"),
        "status": status,
        "budget_aed": amount_or_none(merged.get("budget_aed"), "budget"),
        "spent_aed": amount_or_none(merged.get("spent_aed"), "spent"),
        "blockers": _text(merged.get("blockers"), 2000, "blockers"),
        "files": clean_files,
        "notes": _text(merged.get("notes"), 8000, "notes"),
    }


async def seed_initiatives() -> None:
    database = require_db()
    if await database["marketing_os_initiatives"].count_documents({}) > 0:
        return
    stamp = now_iso()
    await database["marketing_os_initiatives"].insert_many(
        [
            {"_id": uuid4().hex, **_initiative_doc({"name": name}), "order": index, "created_at": stamp, "updated_at": stamp}
            for index, name in enumerate(SEED_INITIATIVES)
        ]
    )


async def list_initiatives() -> dict[str, Any]:
    database = require_db()
    docs = await database["marketing_os_initiatives"].find({}).sort([("order", 1), ("created_at", 1)]).to_list(length=500)
    _, tasks = await _link_counts()
    items = []
    for doc in docs:
        item = initiative_public(doc)
        item["open_tasks"] = tasks.get(("initiative", item["id"]), 0)
        items.append(item)
    return {"items": items}


async def create_initiative(body: dict[str, Any], user_id: str) -> dict[str, Any]:
    database = require_db()
    stamp = now_iso()
    last = await database["marketing_os_initiatives"].find({}, {"order": 1}).sort("order", -1).to_list(length=1)
    doc = {
        "_id": uuid4().hex,
        **_initiative_doc(body),
        "order": (int(last[0].get("order") or 0) + 1) if last else 0,
        "created_at": stamp,
        "updated_at": stamp,
        "created_by": user_id,
    }
    await database["marketing_os_initiatives"].insert_one(doc)
    return initiative_public(doc)


async def update_initiative(initiative_id: str, body: dict[str, Any], user_id: str) -> dict[str, Any]:
    database = require_db()
    current = await database["marketing_os_initiatives"].find_one({"_id": initiative_id})
    if current is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    merged = {**initiative_public(current), **body}
    patch = {**_initiative_doc(merged), "updated_at": now_iso(), "updated_by": user_id}
    if patch["status"] == "Done" and current.get("status") != "Done":
        patch["done_on"] = date.today().isoformat()
    await database["marketing_os_initiatives"].update_one({"_id": initiative_id}, {"$set": patch})
    return initiative_public({**current, **patch})


async def delete_initiative(initiative_id: str) -> dict[str, Any]:
    database = require_db()
    res = await database["marketing_os_initiatives"].delete_one({"_id": initiative_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    await database["marketing_os_work"].update_many(
        {"link_type": "initiative", "link_id": initiative_id}, {"$set": {"link_type": None, "link_id": None}}
    )
    return {"ok": True}


# ─── People, assets, search ────────────────────────────────────────────────


async def list_people() -> dict[str, Any]:
    database = require_db()
    names: dict[str, str] = {}

    def add(raw: Any) -> None:
        text = str(raw or "").strip()
        if text:
            names.setdefault(text.casefold(), text)

    for value in await database["marketing_os_work"].distinct("owner"):
        add(value)
    for value in await database["content_calendar"].distinct("fields.Owner"):
        add(value)
    for value in await database["marketing_campaigns"].distinct("owner"):
        add(value)
    for value in await database["marketing_os_initiatives"].distinct("owner"):
        add(value)
    return {"items": sorted(names.values(), key=str.casefold)}


def asset_public(doc: dict[str, Any]) -> dict[str, Any]:
    fields = doc.get("fields") if isinstance(doc.get("fields"), dict) else {}
    images = fields.get("Image") if isinstance(fields.get("Image"), list) else []
    first = images[0] if images and isinstance(images[0], dict) else {}
    thumbs = first.get("thumbnails") if isinstance(first.get("thumbnails"), dict) else {}
    large = thumbs.get("large") if isinstance(thumbs.get("large"), dict) else {}
    image = str(first.get("url") or "") or None
    return {
        "id": str(doc.get("_id")),
        "name": str(fields.get("Colecction Name") or fields.get("product_tmpl_id/name") or "").strip(),
        "title": str(fields.get("product_tmpl_id/name") or "").strip(),
        "code": str(fields.get("CODE NUMBER") or fields.get("Colecction Code") or "").strip(),
        "category": str(fields.get("Category") or "").strip(),
        "price": _number(fields.get("Price")),
        "image": image,
        "thumb": str(large.get("url") or "") or image,
        "images": [str(item.get("url")) for item in images if isinstance(item, dict) and item.get("url")][:12],
    }


def _product_key(asset_id: str) -> Any:
    if len(asset_id) == 24:
        try:
            from bson import ObjectId

            if ObjectId.is_valid(asset_id):
                return ObjectId(asset_id)
        except Exception:
            pass
    return asset_id


async def _asset_categories(database: Any) -> list[str]:
    global _category_cache
    now = time.monotonic()
    if _category_cache and now - _category_cache[0] < 60:
        return _category_cache[1]
    values = sorted(
        {str(value).strip() for value in await database["products"].distinct("fields.Category") if str(value or "").strip()},
        key=str.casefold,
    )
    _category_cache = (now, values)
    return values


async def get_asset(asset_id: str) -> dict[str, Any]:
    database = require_db()
    doc = await database["products"].find_one({"_id": asset_id}, {"fields": 1})
    if not doc:
        key = _product_key(asset_id)
        if key != asset_id:
            doc = await database["products"].find_one({"_id": key}, {"fields": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    return asset_public(doc)


async def list_assets(q: str | None, category: str | None, skip: int, limit: int) -> dict[str, Any]:
    database = require_db()
    query: dict[str, Any] = dict(_HAS_IMAGE)
    if q and q.strip():
        pattern = _pattern(q)
        query["$or"] = [
            {"fields.Colecction Name": pattern},
            {"fields.CODE NUMBER": pattern},
            {"fields.Colecction Code": pattern},
            {"fields.product_tmpl_id/name": pattern},
            {"fields.Category": pattern},
        ]
    if category:
        query["fields.Category"] = category
    safe_limit = max(1, min(limit, 60))
    safe_skip = max(0, skip)
    docs = (
        await database["products"]
        .find(query, {"fields": 1})
        .sort([("fields.Num", 1), ("_id", 1)])
        .skip(safe_skip)
        .limit(safe_limit + 1)
        .to_list(length=safe_limit + 1)
    )
    categories = await _asset_categories(database)
    return {
        "items": [asset_public(doc) for doc in docs[:safe_limit]],
        "next_skip": safe_skip + safe_limit if len(docs) > safe_limit else None,
        "categories": categories,
    }


async def search(q: str) -> dict[str, Any]:
    database = require_db()
    if len(q.strip()) < 2:
        return {"items": []}
    pattern = _pattern(q)
    items: list[dict[str, Any]] = []
    async for doc in database["content_calendar"].find(
        {"$or": [{"fields.Title": pattern}, {"fields.Caption Idea": pattern}, {"fields.Product": pattern}]}
    ).limit(6):
        item = content_public(doc)
        items.append({"type": "content", "id": item["id"], "title": item["title"] or "Untitled", "meta": f"{item['status']} · {item['publish_date'] or 'No date'}"})
    async for doc in database["marketing_campaigns"].find({"$or": [{"name": pattern}, {"goal": pattern}]}).limit(5):
        item = campaign_public(doc)
        items.append({"type": "campaign", "id": item["id"], "title": item["name"], "meta": f"{item['status']} · {item['start_date']}"})
    async for doc in database["marketing_os_initiatives"].find({"$or": [{"name": pattern}, {"notes": pattern}]}).limit(5):
        item = initiative_public(doc)
        items.append({"type": "initiative", "id": item["id"], "title": item["name"], "meta": f"{item['status']} · {item['owner'] or 'No owner'}"})
    async for doc in database["marketing_os_work"].find({"open": {"$ne": False}, "$or": [{"title": pattern}, {"note": pattern}]}).limit(6):
        items.append({"type": "task", "id": str(doc["_id"]), "title": str(doc.get("title") or ""), "meta": f"{doc.get('stage')} · {doc.get('owner') or 'Unassigned'}"})
    async for doc in database["products"].find(
        {**_HAS_IMAGE, "$or": [{"fields.Colecction Name": pattern}, {"fields.CODE NUMBER": pattern}]}, {"fields": 1}
    ).limit(5):
        item = asset_public(doc)
        items.append({"type": "asset", "id": item["id"], "title": item["name"] or item["code"], "meta": f"{item['code']} · {item['category']}", "image": item["thumb"]})
    return {"items": items}
