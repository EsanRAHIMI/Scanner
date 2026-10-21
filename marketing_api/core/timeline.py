"""Live marketing timeline: lanes, projected records, assignments, and time logs."""

from __future__ import annotations

import asyncio
import re
from datetime import date, datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from .db import require_db
from .operating import (
    CONTENT_STAGES,
    PRIORITIES,
    campaign_public,
    content_public,
    initiative_public,
    is_planning_placeholder,
    now_iso,
    update_campaign,
    update_content,
    update_initiative,
)
from .paid_campaigns import list_paid_campaigns, list_paid_errors
from .store import notify
from .work import STAGES as TASK_STAGES

ACTIVITY_STATUSES = ("Planned", "Live", "Blocked", "Review", "Done", "Paused", "Cancelled")
LINK_TYPES = ("campaign", "content", "initiative", "paid")
LANE_GROUPS = ("paid", "work")
_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")

DEFAULT_LANES: tuple[dict[str, Any], ...] = (
    {"key": "paid-meta", "name": "Meta", "group": "paid", "platform": "Meta", "color": "#1877F2", "locked": True},
    {"key": "paid-google", "name": "Google Ads", "group": "paid", "platform": "Google Ads", "color": "#4285F4", "locked": True},
    {"key": "paid-linkedin", "name": "LinkedIn", "group": "paid", "platform": "LinkedIn", "color": "#0A66C2", "locked": True},
    {"key": "paid-tiktok", "name": "TikTok", "group": "paid", "platform": "TikTok", "color": "#111111", "locked": True},
    {"key": "paid-snapchat", "name": "Snapchat", "group": "paid", "platform": "Snapchat", "color": "#EAB308", "locked": True},
    {"key": "paid-pinterest", "name": "Pinterest", "group": "paid", "platform": "Pinterest", "color": "#BD081C", "locked": True},
    {"key": "social", "name": "Social Media & Content", "group": "work", "color": "#6B1635", "locked": True},
    {"key": "website", "name": "Website & SEO", "group": "work", "color": "#0F766E", "locked": True},
    {"key": "outdoor", "name": "Outdoor Advertising", "group": "work", "color": "#B45309", "locked": True},
    {"key": "showroom", "name": "Showroom Branding", "group": "work", "color": "#7C3AED", "locked": True},
    {"key": "brand", "name": "Brand Development", "group": "work", "color": "#BE185D", "locked": True},
    {"key": "events", "name": "Events & Partnerships", "group": "work", "color": "#0369A1", "locked": True},
)

CHANNEL_LANE = {
    "meta": "paid-meta",
    "facebook": "paid-meta",
    "instagram": "paid-meta",
    "meta ads": "paid-meta",
    "google": "paid-google",
    "google ads": "paid-google",
    "linkedin": "paid-linkedin",
    "tiktok": "paid-tiktok",
    "snapchat": "paid-snapchat",
    "pinterest": "paid-pinterest",
    "website": "website",
}

PAID_ALWAYS = {"paid-google", "paid-tiktok", "paid-snapchat", "paid-pinterest"}
PAID_IF_PAID_MODE = {"paid-meta", "paid-linkedin"}

INITIATIVE_LANE = {
    "downtown design": "events",
    "2027 campaign": "brand",
    "showroom branding": "showroom",
    "billboard": "outdoor",
    "uk brand": "brand",
    "awards": "brand",
    "hospitality": "showroom",
    "magic room": "showroom",
    "tablets": "showroom",
    "photo/video shoots": "social",
}

PLATFORM_LANE = {lane["platform"]: lane["key"] for lane in DEFAULT_LANES if lane.get("platform")}


def logged_hours(logs: list[dict[str, Any]]) -> float | None:
    """Actual hours come only from completed logs, never from calendar duration."""
    minutes = 0.0
    found = False
    for row in logs:
        if row.get("running"):
            continue
        value = row.get("minutes")
        if value is None:
            continue
        found = True
        minutes += float(value)
    if not found:
        return None
    return round(minutes / 60.0, 2)


def dates_overlap(a_start: str | None, a_end: str | None, b_start: str | None, b_end: str | None) -> bool:
    if not a_start or not b_start:
        return False
    return a_start <= (b_end or b_start) and b_start <= (a_end or a_start)


def stack_rows(items: list[dict[str, Any]]) -> dict[str, int]:
    ordered = sorted(
        (item for item in items if item.get("start")),
        key=lambda item: (str(item.get("start")), str(item.get("end") or item.get("start")), str(item.get("id"))),
    )
    ends: list[str] = []
    rows: dict[str, int] = {}
    for item in ordered:
        start = str(item["start"])
        end = str(item.get("end") or start)
        row = next((index for index, last in enumerate(ends) if start > last), None)
        if row is None:
            row = len(ends)
            ends.append(end)
        else:
            ends[row] = end
        rows[str(item["id"])] = row
    return rows


def _norm(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().casefold()


def _text(value: Any, limit: int, field: str) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"INVALID_{field.upper()}")
    clean = value.strip()
    if len(clean) > limit:
        raise HTTPException(status_code=400, detail=f"{field.upper()}_TOO_LONG")
    return clean


def _day(value: Any, field: str = "date") -> str | None:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(str(value).strip()[:10]).isoformat()
    except ValueError:
        raise HTTPException(status_code=400, detail=f"INVALID_{field.upper()}")


def _color(value: Any) -> str | None:
    if value in (None, ""):
        return None
    text = str(value).strip()
    if not _COLOR.match(text):
        raise HTTPException(status_code=400, detail="INVALID_COLOR")
    return text


def _people_of(overlay: dict[str, Any], owner: str = "", reviewer: str = "") -> list[str]:
    names = [owner or str(overlay.get("owner") or ""), reviewer or str(overlay.get("reviewer") or "")]
    for item in overlay.get("contributors") or []:
        if isinstance(item, dict):
            names.append(str(item.get("person") or ""))
    return [name for name in names if name]


def _map_content_status(status: str) -> str:
    if status in ("Published",):
        return "Done"
    if status == "Review":
        return "Review"
    if status in ("Approved", "Scheduled"):
        return "Planned"
    if status in CONTENT_STAGES:
        return "Planned"
    return "Planned"


def _map_initiative_status(status: str) -> str:
    return {
        "Not started": "Planned",
        "Active": "Live",
        "Blocked": "Blocked",
        "On hold": "Paused",
        "Done": "Done",
    }.get(status, "Planned")


def _campaign_lanes(channels: list[str], mode: str | None) -> list[str]:
    paid: list[str] = []
    website = False
    for channel in channels:
        lane = CHANNEL_LANE.get(channel.strip().casefold())
        if lane == "website":
            website = True
            continue
        if not lane:
            continue
        if lane in PAID_ALWAYS or (lane in PAID_IF_PAID_MODE and mode != "Organic"):
            if lane not in paid:
                paid.append(lane)
    if paid:
        return paid
    if website and not channels:
        return ["website"]
    if website and all(CHANNEL_LANE.get(c.strip().casefold()) == "website" for c in channels):
        return ["website"]
    return ["social"]


def _initiative_lane(name: str, overlay: dict[str, Any] | None) -> str:
    if overlay and overlay.get("lane_id"):
        return str(overlay["lane_id"])
    return INITIATIVE_LANE.get(_norm(name), "brand")


def lane_public(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc.get("_id") or doc.get("key")),
        "key": str(doc.get("key") or doc.get("_id")),
        "name": str(doc.get("name") or ""),
        "group": doc.get("group") if doc.get("group") in LANE_GROUPS else "work",
        "platform": doc.get("platform"),
        "owner": str(doc.get("owner") or ""),
        "color": doc.get("color") if _COLOR.match(str(doc.get("color") or "")) else "#6B1635",
        "locked": bool(doc.get("locked")),
        "order": int(doc.get("order") or 0),
    }


async def ensure_lanes() -> list[dict[str, Any]]:
    database = require_db()
    existing = {str(doc.get("key") or doc.get("_id")): doc async for doc in database["marketing_os_lanes"].find({})}
    stamp = now_iso()
    for index, lane in enumerate(DEFAULT_LANES):
        current = existing.get(lane["key"])
        if current is None:
            doc = {
                "_id": lane["key"],
                **lane,
                "owner": "",
                "order": index,
                "created_at": stamp,
                "updated_at": stamp,
            }
            await database["marketing_os_lanes"].insert_one(doc)
            existing[lane["key"]] = doc
        else:
            patch = {}
            if current.get("locked") != lane.get("locked"):
                patch["locked"] = lane.get("locked")
            if current.get("platform") != lane.get("platform"):
                patch["platform"] = lane.get("platform")
            if current.get("group") != lane.get("group"):
                patch["group"] = lane.get("group")
            if patch:
                patch["updated_at"] = stamp
                await database["marketing_os_lanes"].update_one({"_id": current["_id"]}, {"$set": patch})
                current.update(patch)
    lanes = [lane_public(doc) for doc in existing.values()]
    lanes.sort(key=lambda item: (item["order"], item["name"]))
    return lanes


async def drop_linked(link_type: str, link_id: str) -> None:
    database = require_db()
    await database["marketing_os_activities"].delete_many({"link_type": link_type, "link_id": link_id})


def _contributors(raw: Any) -> list[dict[str, Any]]:
    if raw in (None, ""):
        return []
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="INVALID_CONTRIBUTORS")
    out = []
    for item in raw:
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail="INVALID_CONTRIBUTORS")
        person = _text(item.get("person"), 80, "person")
        if not person:
            continue
        start = _day(item.get("start"), "participation_start")
        end = _day(item.get("end"), "participation_end")
        if start and end and end < start:
            raise HTTPException(status_code=400, detail="PARTICIPATION_END_BEFORE_START")
        out.append(
            {
                "person": person,
                "start": start,
                "end": end,
                "active": item.get("active") is not False and not end,
            }
        )
    if len(out) > 40:
        raise HTTPException(status_code=400, detail="INVALID_CONTRIBUTORS")
    return out


def _overlay_public(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc.get("_id")),
        "lane_id": doc.get("lane_id"),
        "title": str(doc.get("title") or ""),
        "start": doc.get("start"),
        "end": doc.get("end"),
        "deadline": doc.get("deadline"),
        "status": doc.get("status") if doc.get("status") in ACTIVITY_STATUSES else None,
        "priority": doc.get("priority") if doc.get("priority") in PRIORITIES else None,
        "progress": doc.get("progress"),
        "owner": str(doc.get("owner") or ""),
        "reviewer": str(doc.get("reviewer") or ""),
        "contributors": [item for item in (doc.get("contributors") or []) if isinstance(item, dict)],
        "link_type": doc.get("link_type"),
        "link_id": doc.get("link_id"),
        "color": doc.get("color"),
        "updated_at": doc.get("updated_at"),
        "updated_by": doc.get("updated_by"),
    }


def _activity(
    *,
    identity: str,
    lane_id: str,
    title: str,
    link_type: str | None,
    link_id: str | None,
    source: str,
    confirmed: bool,
    start: str | None,
    end: str | None,
    deadline: str | None,
    status: str,
    priority: str,
    owner: str,
    overlay: dict[str, Any] | None,
    hours: float | None,
    running: dict[str, Any] | None,
    color: str,
    href: str | None,
    paid: dict[str, Any] | None,
    tasks: list[dict[str, Any]],
    today: str,
) -> dict[str, Any]:
    overlay = overlay or {}
    locked = link_type in ("campaign", "content")
    if not locked:
        start = overlay.get("start") or start
        end = overlay.get("end") or end
        deadline = overlay.get("deadline") or deadline
    owner = overlay.get("owner") or owner
    status = overlay.get("status") or status
    priority = overlay.get("priority") or priority
    overdue = bool(deadline and deadline < today and status not in ("Done", "Cancelled", "Paused"))
    if not overdue and end and end < today and status == "Live":
        overdue = True
    contributors = overlay.get("contributors") or []
    return {
        "id": identity,
        "lane_id": lane_id,
        "title": overlay.get("title") or title,
        "link_type": link_type,
        "link_id": link_id,
        "source": source,
        "confirmed": confirmed,
        "start": start,
        "end": end,
        "deadline": deadline,
        "status": status if status in ACTIVITY_STATUSES else "Planned",
        "priority": priority if priority in PRIORITIES else "Medium",
        "progress": overlay.get("progress"),
        "owner": owner,
        "reviewer": str(overlay.get("reviewer") or ""),
        "contributors": contributors,
        "people": sorted({*_people_of(overlay, owner, str(overlay.get("reviewer") or ""))}),
        "hours": hours,
        "running": running,
        "color": overlay.get("color") or color,
        "href": href,
        "paid": paid,
        "tasks": tasks,
        "overdue": overdue,
        "updated_at": overlay.get("updated_at"),
    }


def _hours_index(logs: list[dict[str, Any]]) -> tuple[dict[str, float | None], dict[str, dict[str, Any]]]:
    by_activity: dict[str, list[dict[str, Any]]] = {}
    running: dict[str, dict[str, Any]] = {}
    for row in logs:
        activity_id = str(row.get("activity_id") or "")
        by_activity.setdefault(activity_id, []).append(row)
        if row.get("running"):
            running[activity_id] = {
                "id": str(row.get("_id")),
                "person": str(row.get("person") or ""),
                "started_at": row.get("started_at"),
            }
    hours = {key: logged_hours(value) for key, value in by_activity.items()}
    return hours, running


def _task_brief(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc.get("_id")),
        "title": str(doc.get("title") or ""),
        "owner": str(doc.get("owner") or ""),
        "stage": doc.get("stage") if doc.get("stage") in TASK_STAGES else "Queued",
        "deadline": doc.get("deadline"),
        "priority": doc.get("priority") if doc.get("priority") in PRIORITIES else "Medium",
    }


async def get_timeline() -> dict[str, Any]:
    database = require_db()
    today = date.today().isoformat()
    lanes = await ensure_lanes()
    lane_ids = {item["id"] for item in lanes}
    overlays, campaigns, content, initiatives, tasks, logs, paid, paid_errors = await _load(database)
    hours, running = _hours_index(logs)
    overlay_by_link: dict[tuple[str, str], dict[str, Any]] = {}
    overlay_by_id = {}
    for doc in overlays:
        overlay_by_id[str(doc["_id"])] = doc
        if doc.get("link_type") and doc.get("link_id"):
            overlay_by_link[(str(doc["link_type"]), str(doc["link_id"]))] = doc

    task_by_link: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for doc in tasks:
        key = (str(doc.get("link_type") or ""), str(doc.get("link_id") or ""))
        if key[0] and key[1]:
            task_by_link.setdefault(key, []).append(_task_brief(doc))

    paid_by_platform: dict[str, list[dict[str, Any]]] = {}
    for row in paid:
        paid_by_platform.setdefault(str(row.get("platform") or ""), []).append(row)

    used_paid: set[str] = set()
    activities: list[dict[str, Any]] = []
    people: dict[str, str] = {}

    def add_person(name: str) -> None:
        text = name.strip()
        if text:
            people.setdefault(text.casefold(), text)

    for campaign in campaigns:
        item = campaign_public(campaign, date.fromisoformat(today))
        lanes_for = [lane for lane in _campaign_lanes(item["channels"], item.get("mode")) if lane in lane_ids]
        overlay = overlay_by_link.get(("campaign", item["id"])) or overlay_by_id.get(f"campaign:{item['id']}")
        identity = str((overlay or {}).get("_id") or f"campaign:{item['id']}")
        for lane_id in lanes_for:
            platform = next((lane["platform"] for lane in lanes if lane["id"] == lane_id and lane.get("platform")), None)
            paid_row = _match_paid(paid_by_platform.get(str(platform) or ""), item["name"]) if platform else None
            if paid_row:
                used_paid.add(str(paid_row.get("_id")))
            activities.append(
                _activity(
                    identity=identity,
                    lane_id=lane_id,
                    title=item["name"],
                    link_type="campaign",
                    link_id=item["id"],
                    source="paid_api" if paid_row else "record",
                    confirmed=bool(paid_row),
                    start=item.get("start_date"),
                    end=item.get("end_date"),
                    deadline=item.get("end_date"),
                    status=item["status"],
                    priority="High" if item.get("is_critical") else "Medium",
                    owner=item.get("owner") or "",
                    overlay=_overlay_public(overlay) if overlay else None,
                    hours=hours.get(identity),
                    running=running.get(identity),
                    color=item.get("color") or "#6366f1",
                    href=f"/campaigns?open={item['id']}",
                    paid=_paid_public(paid_row, str(platform or "")),
                    tasks=task_by_link.get(("campaign", item["id"]), []),
                    today=today,
                )
            )

    for doc in content:
        if is_planning_placeholder(doc):
            continue
        item = content_public(doc)
        overlay = overlay_by_link.get(("content", item["id"])) or overlay_by_id.get(f"content:{item['id']}")
        identity = str((overlay or {}).get("_id") or f"content:{item['id']}")
        channels = item.get("channels") or []
        lane_id = str((overlay or {}).get("lane_id") or ("website" if channels == ["Website"] else "social"))
        start = item.get("publish_date") or item.get("due_date")
        activities.append(
            _activity(
                identity=identity,
                lane_id=lane_id,
                title=item.get("title") or "Untitled",
                link_type="content",
                link_id=item["id"],
                source="record",
                confirmed=False,
                start=start,
                end=start,
                deadline=item.get("due_date"),
                status=_map_content_status(item.get("status") or ""),
                priority="Medium",
                owner=item.get("owner") or "",
                overlay=_overlay_public(overlay) if overlay else None,
                hours=hours.get(identity),
                running=running.get(identity),
                color="#6B1635",
                href=f"/content?open={item['id']}",
                paid=None,
                tasks=task_by_link.get(("content", item["id"]), []),
                today=today,
            )
        )

    for doc in initiatives:
        item = initiative_public(doc)
        overlay = overlay_by_link.get(("initiative", item["id"])) or overlay_by_id.get(f"initiative:{item['id']}")
        identity = str((overlay or {}).get("_id") or f"initiative:{item['id']}")
        lane_id = _initiative_lane(item["name"], overlay)
        if lane_id not in lane_ids:
            lane_id = "brand"
        start = (overlay or {}).get("start")
        end = (overlay or {}).get("end") or item.get("deadline")
        if not start and item.get("deadline"):
            start = item["deadline"]
            end = item["deadline"]
        activities.append(
            _activity(
                identity=identity,
                lane_id=lane_id,
                title=item["name"],
                link_type="initiative",
                link_id=item["id"],
                source="record",
                confirmed=False,
                start=start,
                end=end,
                deadline=item.get("deadline"),
                status=_map_initiative_status(item.get("status") or ""),
                priority=item.get("priority") or "Medium",
                owner=item.get("owner") or "",
                overlay=_overlay_public(overlay) if overlay else None,
                hours=hours.get(identity),
                running=running.get(identity),
                color=next((lane["color"] for lane in lanes if lane["id"] == lane_id), "#6B1635"),
                href=f"/initiatives?open={item['id']}",
                paid=None,
                tasks=task_by_link.get(("initiative", item["id"]), []),
                today=today,
            )
        )

    for row in paid:
        if str(row.get("_id")) in used_paid:
            continue
        platform = str(row.get("platform") or "")
        lane_id = PLATFORM_LANE.get(platform)
        if not lane_id or lane_id not in lane_ids:
            continue
        identity = f"paid:{platform}:{row.get('campaign_id')}"
        overlay = overlay_by_link.get(("paid", str(row.get("_id")))) or overlay_by_id.get(identity)
        activities.append(
            _activity(
                identity=str((overlay or {}).get("_id") or identity),
                lane_id=lane_id,
                title=str(row.get("name") or row.get("campaign_id") or platform),
                link_type="paid",
                link_id=str(row.get("_id")),
                source="paid_api",
                confirmed=True,
                start=row.get("start_date"),
                end=row.get("end_date"),
                deadline=row.get("end_date"),
                status=_paid_status(row.get("status")),
                priority="Medium",
                owner="",
                overlay=_overlay_public(overlay) if overlay else None,
                hours=hours.get(identity) or hours.get(str((overlay or {}).get("_id") or "")),
                running=running.get(identity) or running.get(str((overlay or {}).get("_id") or "")),
                color=next((lane["color"] for lane in lanes if lane["id"] == lane_id), "#1877F2"),
                href="/paid",
                paid=_paid_public(row, platform),
                tasks=[],
                today=today,
            )
        )

    for doc in overlays:
        identity = str(doc["_id"])
        if any(item["id"] == identity for item in activities):
            continue
        if doc.get("link_type"):
            continue
        lane_id = str(doc.get("lane_id") or "")
        if lane_id not in lane_ids:
            continue
        activities.append(
            _activity(
                identity=identity,
                lane_id=lane_id,
                title=str(doc.get("title") or "Untitled"),
                link_type=None,
                link_id=None,
                source="manual",
                confirmed=False,
                start=doc.get("start"),
                end=doc.get("end"),
                deadline=doc.get("deadline"),
                status=str(doc.get("status") or "Planned"),
                priority=str(doc.get("priority") or "Medium"),
                owner=str(doc.get("owner") or ""),
                overlay=_overlay_public(doc),
                hours=hours.get(identity),
                running=running.get(identity),
                color=str(doc.get("color") or next((lane["color"] for lane in lanes if lane["id"] == lane_id), "#6B1635")),
                href=None,
                paid=None,
                tasks=[],
                today=today,
            )
        )

    for lane in lanes:
        add_person(str(lane.get("owner") or ""))
    for item in activities:
        for name in item.get("people") or []:
            add_person(name)

    scheduled = [item for item in activities if item.get("start")]
    unscheduled = [item for item in activities if not item.get("start")]
    campaigns_index = [{"id": str(doc["_id"]), "name": str(doc.get("name") or "")} for doc in campaigns]
    projects = [{"id": str(doc["_id"]), "name": str(doc.get("name") or ""), "kind": "initiative"} for doc in initiatives]
    return {
        "today": today,
        "lanes": lanes,
        "activities": scheduled,
        "unscheduled": unscheduled,
        "people": sorted(people.values(), key=str.casefold),
        "campaigns": campaigns_index,
        "projects": projects,
        "paid_errors": paid_errors,
        "groups": [
            {"id": "paid", "name": "Paid Advertising"},
            {"id": "work", "name": "Operations"},
        ],
    }


async def _load(database) -> tuple:
    return await asyncio.gather(
        database["marketing_os_activities"].find({}).to_list(length=2000),
        database["marketing_campaigns"].find({}).to_list(length=1000),
        database["content_calendar"].find({}).to_list(length=2000),
        database["marketing_os_initiatives"].find({}).to_list(length=500),
        database["marketing_os_work"].find({"open": {"$ne": False}}).to_list(length=500),
        database["marketing_os_time_logs"].find({}).to_list(length=5000),
        list_paid_campaigns(),
        list_paid_errors(),
    )


def _match_paid(rows: list[dict[str, Any]] | None, name: str) -> dict[str, Any] | None:
    if not rows:
        return None
    needle = _norm(name)
    if not needle:
        return None
    for row in rows:
        if _norm(str(row.get("name") or "")) == needle:
            return row
    return None


def _paid_status(raw: Any) -> str:
    text = str(raw or "").upper()
    if text in {"PAUSED", "PAUSED_CAMPAIGN"}:
        return "Paused"
    if text in {"DELETED", "ARCHIVED", "REMOVED", "CANCELLED", "CANCELED"}:
        return "Cancelled"
    if text in {"ACTIVE", "ENABLED", "CAMPAIGN_STATUS_ENABLE", "DELIVERING", "RUNNING"}:
        return "Live"
    if text in {"COMPLETED", "ENDED"}:
        return "Done"
    if text:
        return "Planned"
    return "Live"


def _paid_public(row: dict[str, Any] | None, platform: str) -> dict[str, Any] | None:
    if not row and not platform:
        return None
    if not row:
        return {
            "platform": platform,
            "campaign_id": None,
            "spend": None,
            "budget": None,
            "impressions": None,
            "clicks": None,
            "leads": None,
            "status": None,
            "confirmed": False,
        }
    return {
        "platform": platform or str(row.get("platform") or ""),
        "campaign_id": str(row.get("campaign_id") or ""),
        "spend": row.get("spend"),
        "budget": row.get("budget"),
        "impressions": row.get("impressions"),
        "clicks": row.get("clicks"),
        "leads": row.get("leads"),
        "status": row.get("status"),
        "confirmed": True,
    }


async def create_lane(body: dict[str, Any], user_id: str) -> dict[str, Any]:
    database = require_db()
    await ensure_lanes()
    name = _text(body.get("name"), 80, "name")
    if not name:
        raise HTTPException(status_code=400, detail="NAME_REQUIRED")
    last = await database["marketing_os_lanes"].find({}, {"order": 1}).sort("order", -1).to_list(length=1)
    stamp = now_iso()
    key = f"custom-{uuid4().hex[:10]}"
    doc = {
        "_id": key,
        "key": key,
        "name": name,
        "group": body.get("group") if body.get("group") in LANE_GROUPS else "work",
        "platform": None,
        "owner": _text(body.get("owner"), 80, "owner"),
        "color": _color(body.get("color")) or "#6B1635",
        "locked": False,
        "order": (int(last[0].get("order") or 0) + 1) if last else len(DEFAULT_LANES),
        "created_at": stamp,
        "updated_at": stamp,
        "updated_by": user_id,
    }
    await database["marketing_os_lanes"].insert_one(doc)
    notify()
    return lane_public(doc)


async def update_lane(lane_id: str, body: dict[str, Any], user_id: str) -> dict[str, Any]:
    database = require_db()
    current = await database["marketing_os_lanes"].find_one({"$or": [{"_id": lane_id}, {"key": lane_id}]})
    if current is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    patch: dict[str, Any] = {"updated_at": now_iso(), "updated_by": user_id}
    if "name" in body:
        name = _text(body.get("name"), 80, "name")
        if not name:
            raise HTTPException(status_code=400, detail="NAME_REQUIRED")
        if current.get("locked") and name != current.get("name"):
            patch["name"] = name
        else:
            patch["name"] = name
    if "owner" in body:
        patch["owner"] = _text(body.get("owner"), 80, "owner")
    if "color" in body:
        patch["color"] = _color(body.get("color")) or current.get("color")
    if "group" in body and not current.get("locked"):
        group = body.get("group")
        if group not in LANE_GROUPS:
            raise HTTPException(status_code=400, detail="INVALID_GROUP")
        patch["group"] = group
    await database["marketing_os_lanes"].update_one({"_id": current["_id"]}, {"$set": patch})
    notify()
    return lane_public({**current, **patch})


async def reorder_lanes(ids: list[str]) -> dict[str, Any]:
    database = require_db()
    await ensure_lanes()
    existing = await database["marketing_os_lanes"].find({}).to_list(length=100)
    known = {str(doc["_id"]): doc for doc in existing}
    if set(ids) != set(known):
        raise HTTPException(status_code=400, detail="INVALID_LANE_ORDER")
    for index, lane_id in enumerate(ids):
        await database["marketing_os_lanes"].update_one({"_id": lane_id}, {"$set": {"order": index, "updated_at": now_iso()}})
    notify()
    return await get_timeline()


async def delete_lane(lane_id: str) -> dict[str, Any]:
    database = require_db()
    current = await database["marketing_os_lanes"].find_one({"$or": [{"_id": lane_id}, {"key": lane_id}]})
    if current is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    if current.get("locked"):
        raise HTTPException(status_code=400, detail="LANE_LOCKED")
    used = await database["marketing_os_activities"].count_documents({"lane_id": str(current["_id"])})
    if used:
        raise HTTPException(status_code=400, detail="LANE_IN_USE")
    await database["marketing_os_lanes"].delete_one({"_id": current["_id"]})
    notify()
    return {"ok": True}


async def _get_overlay(activity_id: str) -> dict[str, Any] | None:
    database = require_db()
    return await database["marketing_os_activities"].find_one({"_id": activity_id})


async def _ensure_overlay(activity_id: str, user_id: str) -> dict[str, Any]:
    database = require_db()
    current = await _get_overlay(activity_id)
    if current:
        return current
    timeline = await get_timeline()
    match = next((item for item in [*timeline["activities"], *timeline["unscheduled"]] if item["id"] == activity_id), None)
    if match is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    stamp = now_iso()
    doc = {
        "_id": activity_id,
        "lane_id": match["lane_id"],
        "title": match["title"],
        "start": match.get("start"),
        "end": match.get("end"),
        "deadline": match.get("deadline"),
        "status": match.get("status"),
        "priority": match.get("priority"),
        "progress": match.get("progress"),
        "owner": match.get("owner") or "",
        "reviewer": match.get("reviewer") or "",
        "contributors": match.get("contributors") or [],
        "link_type": match.get("link_type"),
        "link_id": match.get("link_id"),
        "color": match.get("color"),
        "created_at": stamp,
        "updated_at": stamp,
        "updated_by": user_id,
    }
    await database["marketing_os_activities"].replace_one({"_id": activity_id}, doc, upsert=True)
    return doc


def _progress(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="INVALID_PROGRESS")
    if number < 0 or number > 100:
        raise HTTPException(status_code=400, detail="INVALID_PROGRESS")
    return round(number, 1)


async def create_activity(body: dict[str, Any], user_id: str) -> dict[str, Any]:
    database = require_db()
    await ensure_lanes()
    lane_id = _text(body.get("lane_id"), 40, "lane_id")
    if not await database["marketing_os_lanes"].find_one({"$or": [{"_id": lane_id}, {"key": lane_id}]}):
        raise HTTPException(status_code=400, detail="LANE_NOT_FOUND")
    title = _text(body.get("title"), 160, "title")
    if not title:
        raise HTTPException(status_code=400, detail="TITLE_REQUIRED")
    start = _day(body.get("start"), "start")
    end = _day(body.get("end"), "end")
    if start and end and end < start:
        raise HTTPException(status_code=400, detail="END_DATE_BEFORE_START")
    status = body.get("status") or "Planned"
    priority = body.get("priority") or "Medium"
    if status not in ACTIVITY_STATUSES or priority not in PRIORITIES:
        raise HTTPException(status_code=400, detail="INVALID_ACTIVITY")
    link_type = body.get("link_type") or None
    link_id = str(body.get("link_id") or "").strip() or None
    if (link_type is None) != (link_id is None) or (link_type is not None and link_type not in LINK_TYPES):
        raise HTTPException(status_code=400, detail="INVALID_LINK")
    stamp = now_iso()
    identity = f"{link_type}:{link_id}" if link_type and link_id else uuid4().hex
    doc = {
        "_id": identity,
        "lane_id": lane_id,
        "title": title,
        "start": start,
        "end": end,
        "deadline": _day(body.get("deadline"), "deadline"),
        "status": status,
        "priority": priority,
        "progress": _progress(body.get("progress")),
        "owner": _text(body.get("owner"), 80, "owner"),
        "reviewer": _text(body.get("reviewer"), 80, "reviewer"),
        "contributors": _contributors(body.get("contributors")),
        "link_type": link_type,
        "link_id": link_id,
        "color": _color(body.get("color")),
        "created_at": stamp,
        "updated_at": stamp,
        "updated_by": user_id,
    }
    await database["marketing_os_activities"].replace_one({"_id": identity}, doc, upsert=True)
    if link_type in ("campaign", "content", "initiative") and link_id:
        await _sync_canonical(link_type, link_id, doc, user_id, set(body))
    notify()
    return (await _find_activity(identity)) or _overlay_public(doc)


async def update_activity(activity_id: str, body: dict[str, Any], user_id: str) -> dict[str, Any]:
    current = await _ensure_overlay(activity_id, user_id)
    expected = body.get("expected_updated_at")
    if expected and current.get("updated_at") and expected != current.get("updated_at"):
        raise HTTPException(status_code=409, detail="CONFLICT")
    patch: dict[str, Any] = {"updated_at": now_iso(), "updated_by": user_id}
    if "title" in body:
        title = _text(body.get("title"), 160, "title")
        if not title:
            raise HTTPException(status_code=400, detail="TITLE_REQUIRED")
        patch["title"] = title
    if "lane_id" in body:
        lane_id = _text(body.get("lane_id"), 40, "lane_id")
        database = require_db()
        if not await database["marketing_os_lanes"].find_one({"$or": [{"_id": lane_id}, {"key": lane_id}]}):
            raise HTTPException(status_code=400, detail="LANE_NOT_FOUND")
        if current.get("link_type") == "campaign":
            raise HTTPException(status_code=400, detail="LANE_LOCKED")
        patch["lane_id"] = lane_id
    if "start" in body:
        start_value = _day(body.get("start"), "start")
        if current.get("link_type") == "campaign" and not start_value:
            raise HTTPException(status_code=400, detail="START_DATE_REQUIRED")
        patch["start"] = start_value
    if "end" in body:
        patch["end"] = _day(body.get("end"), "end")
    start = patch.get("start", current.get("start"))
    end = patch.get("end", current.get("end"))
    if start and end and end < start:
        raise HTTPException(status_code=400, detail="END_DATE_BEFORE_START")
    if "deadline" in body:
        patch["deadline"] = _day(body.get("deadline"), "deadline")
    if "status" in body:
        status = body.get("status") or "Planned"
        if status not in ACTIVITY_STATUSES:
            raise HTTPException(status_code=400, detail="INVALID_STATUS")
        patch["status"] = status
    if "priority" in body:
        priority = body.get("priority") or "Medium"
        if priority not in PRIORITIES:
            raise HTTPException(status_code=400, detail="INVALID_PRIORITY")
        patch["priority"] = priority
    if "progress" in body:
        patch["progress"] = _progress(body.get("progress"))
    if "owner" in body:
        patch["owner"] = _text(body.get("owner"), 80, "owner")
    if "reviewer" in body:
        patch["reviewer"] = _text(body.get("reviewer"), 80, "reviewer")
    if "contributors" in body:
        incoming = _contributors(body.get("contributors"))
        patch["contributors"] = _merge_contributors(current.get("contributors") or [], incoming)
    if "color" in body:
        patch["color"] = _color(body.get("color"))
    database = require_db()
    await database["marketing_os_activities"].update_one({"_id": current["_id"]}, {"$set": patch})
    merged = {**current, **patch}
    if merged.get("link_type") in ("campaign", "content", "initiative") and merged.get("link_id"):
        await _sync_canonical(str(merged["link_type"]), str(merged["link_id"]), merged, user_id, set(body))
    notify()
    return (await _find_activity(str(current["_id"]))) or _overlay_public(merged)


def _merge_contributors(previous: list[dict[str, Any]], incoming: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep historical participation when someone is removed from the live assignment."""
    today = date.today().isoformat()
    live = {_norm(str(item.get("person") or "")): item for item in incoming}
    out = []
    seen: set[str] = set()
    for item in previous:
        key = _norm(str(item.get("person") or ""))
        if not key:
            continue
        if key in live:
            nxt = live[key]
            out.append({**item, **nxt, "active": nxt.get("active", True) and not nxt.get("end")})
            seen.add(key)
        elif item.get("active") is not False and not item.get("end"):
            out.append({**item, "end": today, "active": False})
        else:
            out.append(item)
            seen.add(key)
    for key, item in live.items():
        if key not in seen:
            out.append(item)
    return out


async def _sync_canonical(link_type: str, link_id: str, overlay: dict[str, Any], user_id: str, keys: set[str]) -> None:
    if link_type == "campaign":
        body: dict[str, Any] = {}
        if "title" in keys and overlay.get("title"):
            body["name"] = overlay["title"]
        if "start" in keys and overlay.get("start"):
            body["start_date"] = overlay["start"]
        if "end" in keys:
            body["end_date"] = overlay.get("end")
        if "owner" in keys:
            body["owner"] = overlay.get("owner") or ""
        if "status" in keys:
            state = {"Paused": "Paused", "Cancelled": "Cancelled"}.get(str(overlay.get("status") or ""))
            if state:
                body["state"] = state
            elif overlay.get("status") in ("Live", "Planned", "Done"):
                body["state"] = "Active"
        if body:
            await update_campaign(link_id, body, user_id)
    elif link_type == "content":
        body = {}
        if "title" in keys and overlay.get("title"):
            body["title"] = overlay["title"]
        if "start" in keys and overlay.get("start"):
            body["publish_date"] = overlay["start"]
        if "deadline" in keys or "end" in keys:
            body["due_date"] = overlay.get("deadline") or overlay.get("end")
        if "owner" in keys:
            body["owner"] = overlay.get("owner") or ""
        if "status" in keys:
            mapped = {"Review": "Review", "Done": "Published", "Live": "Production", "Blocked": "Production"}.get(str(overlay.get("status") or ""))
            if mapped:
                body["status"] = mapped
        if body:
            await update_content(link_id, body, user_id)
    elif link_type == "initiative":
        body = {}
        if "title" in keys and overlay.get("title"):
            body["name"] = overlay["title"]
        if "deadline" in keys or "end" in keys:
            body["deadline"] = overlay.get("deadline") or overlay.get("end")
        if "owner" in keys:
            body["owner"] = overlay.get("owner") or ""
        if "status" in keys:
            mapped = {
                "Planned": "Not started",
                "Live": "Active",
                "Blocked": "Blocked",
                "Paused": "On hold",
                "Done": "Done",
            }.get(str(overlay.get("status") or ""))
            if mapped:
                body["status"] = mapped
        if "priority" in keys and overlay.get("priority") in PRIORITIES:
            body["priority"] = overlay["priority"]
        if body:
            await update_initiative(link_id, body, user_id)


async def _find_activity(activity_id: str) -> dict[str, Any] | None:
    payload = await get_timeline()
    return next((item for item in [*payload["activities"], *payload["unscheduled"]] if item["id"] == activity_id), None)


async def get_activity(activity_id: str) -> dict[str, Any]:
    item = await _find_activity(activity_id)
    if item is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    database = require_db()
    logs = await database["marketing_os_time_logs"].find({"activity_id": activity_id}).sort("started_at", -1).to_list(length=200)
    item["logs"] = [_log_public(row) for row in logs]
    return item


async def delete_activity(activity_id: str) -> dict[str, Any]:
    database = require_db()
    current = await database["marketing_os_activities"].find_one({"_id": activity_id})
    if current is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    if current.get("link_type"):
        raise HTTPException(status_code=400, detail="LINKED_ACTIVITY")
    await database["marketing_os_activities"].delete_one({"_id": activity_id})
    await database["marketing_os_time_logs"].delete_many({"activity_id": activity_id, "running": True})
    notify()
    return {"ok": True}


def _log_public(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc.get("_id")),
        "activity_id": str(doc.get("activity_id") or ""),
        "person": str(doc.get("person") or ""),
        "started_at": doc.get("started_at"),
        "ended_at": doc.get("ended_at"),
        "minutes": doc.get("minutes"),
        "note": str(doc.get("note") or ""),
        "source": doc.get("source") if doc.get("source") in ("timer", "manual") else "manual",
        "running": bool(doc.get("running")),
        "history": doc.get("history") or [],
        "updated_at": doc.get("updated_at"),
    }


def _parse_moment(value: Any, field: str) -> str:
    if value in (None, ""):
        raise HTTPException(status_code=400, detail=f"INVALID_{field.upper()}")
    text = str(value).strip().replace("Z", "+00:00")
    try:
        moment = datetime.fromisoformat(text)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"INVALID_{field.upper()}")
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _minutes_between(start: str, end: str) -> float:
    a = datetime.fromisoformat(start.replace("Z", "+00:00"))
    b = datetime.fromisoformat(end.replace("Z", "+00:00"))
    minutes = (b - a).total_seconds() / 60.0
    if minutes < 0:
        raise HTTPException(status_code=400, detail="END_BEFORE_START")
    return round(minutes, 1)


async def add_time_log(activity_id: str, body: dict[str, Any], user_id: str) -> dict[str, Any]:
    await _ensure_overlay(activity_id, user_id)
    person = _text(body.get("person"), 80, "person")
    if not person:
        raise HTTPException(status_code=400, detail="PERSON_REQUIRED")
    started = _parse_moment(body.get("started_at"), "started_at")
    ended = _parse_moment(body.get("ended_at"), "ended_at") if body.get("ended_at") not in (None, "") else None
    minutes = body.get("minutes")
    if minutes in (None, "") and ended:
        minutes = _minutes_between(started, ended)
    elif minutes not in (None, ""):
        try:
            minutes = float(minutes)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="INVALID_MINUTES")
        if minutes < 0 or minutes > 24 * 60 * 14:
            raise HTTPException(status_code=400, detail="INVALID_MINUTES")
        minutes = round(minutes, 1)
    else:
        raise HTTPException(status_code=400, detail="MINUTES_REQUIRED")
    stamp = now_iso()
    doc = {
        "_id": uuid4().hex,
        "activity_id": activity_id,
        "person": person,
        "started_at": started,
        "ended_at": ended or started,
        "minutes": minutes,
        "note": _text(body.get("note"), 500, "note"),
        "source": "manual",
        "running": False,
        "history": [{"at": stamp, "by": user_id, "action": "created"}],
        "created_at": stamp,
        "updated_at": stamp,
        "updated_by": user_id,
    }
    database = require_db()
    await database["marketing_os_time_logs"].insert_one(doc)
    notify()
    return _log_public(doc)


async def update_time_log(log_id: str, body: dict[str, Any], user_id: str) -> dict[str, Any]:
    database = require_db()
    current = await database["marketing_os_time_logs"].find_one({"_id": log_id})
    if current is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    if current.get("running"):
        raise HTTPException(status_code=400, detail="TIMER_RUNNING")
    patch: dict[str, Any] = {"updated_at": now_iso(), "updated_by": user_id}
    previous = {key: current.get(key) for key in ("started_at", "ended_at", "minutes", "note", "person")}
    if "person" in body:
        person = _text(body.get("person"), 80, "person")
        if not person:
            raise HTTPException(status_code=400, detail="PERSON_REQUIRED")
        patch["person"] = person
    if "started_at" in body:
        patch["started_at"] = _parse_moment(body.get("started_at"), "started_at")
    if "ended_at" in body:
        patch["ended_at"] = _parse_moment(body.get("ended_at"), "ended_at")
    started = patch.get("started_at", current.get("started_at"))
    ended = patch.get("ended_at", current.get("ended_at"))
    if "minutes" in body and body.get("minutes") not in (None, ""):
        try:
            minutes = float(body.get("minutes"))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="INVALID_MINUTES")
        if minutes < 0 or minutes > 24 * 60 * 14:
            raise HTTPException(status_code=400, detail="INVALID_MINUTES")
        patch["minutes"] = round(minutes, 1)
    elif "started_at" in body or "ended_at" in body:
        patch["minutes"] = _minutes_between(str(started), str(ended))
    if "note" in body:
        patch["note"] = _text(body.get("note"), 500, "note")
    history = list(current.get("history") or [])
    history.append({"at": patch["updated_at"], "by": user_id, "action": "updated", "previous": previous})
    patch["history"] = history[-40:]
    await database["marketing_os_time_logs"].update_one({"_id": log_id}, {"$set": patch})
    notify()
    return _log_public({**current, **patch})


async def timer(activity_id: str, action: str, person: str, user_id: str) -> dict[str, Any]:
    person = _text(person, 80, "person")
    if not person:
        raise HTTPException(status_code=400, detail="PERSON_REQUIRED")
    if action not in ("start", "stop"):
        raise HTTPException(status_code=400, detail="INVALID_TIMER")
    await _ensure_overlay(activity_id, user_id)
    database = require_db()
    stamp = now_iso()
    if action == "start":
        open_row = await database["marketing_os_time_logs"].find_one({"person": person, "running": True})
        if open_row:
            await _stop_log(open_row, stamp, user_id)
        doc = {
            "_id": uuid4().hex,
            "activity_id": activity_id,
            "person": person,
            "started_at": stamp,
            "ended_at": None,
            "minutes": None,
            "note": "",
            "source": "timer",
            "running": True,
            "history": [{"at": stamp, "by": user_id, "action": "started"}],
            "created_at": stamp,
            "updated_at": stamp,
            "updated_by": user_id,
        }
        await database["marketing_os_time_logs"].insert_one(doc)
        notify()
        return _log_public(doc)
    current = await database["marketing_os_time_logs"].find_one({"activity_id": activity_id, "person": person, "running": True})
    if current is None:
        raise HTTPException(status_code=404, detail="TIMER_NOT_FOUND")
    stopped = await _stop_log(current, stamp, user_id)
    notify()
    return stopped


async def _stop_log(doc: dict[str, Any], stamp: str, user_id: str) -> dict[str, Any]:
    minutes = _minutes_between(str(doc.get("started_at")), stamp)
    history = list(doc.get("history") or [])
    history.append({"at": stamp, "by": user_id, "action": "stopped", "minutes": minutes})
    patch = {
        "ended_at": stamp,
        "minutes": minutes,
        "running": False,
        "updated_at": stamp,
        "updated_by": user_id,
        "history": history[-40:],
    }
    database = require_db()
    await database["marketing_os_time_logs"].update_one({"_id": doc["_id"]}, {"$set": patch})
    return _log_public({**doc, **patch})
