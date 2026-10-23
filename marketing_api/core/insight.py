"""Overview and management report.

Paid figures for an arbitrary range come from the daily month-to-date snapshots
the connectors store. A range total is the end snapshot minus the snapshot of the
day before the range, per month. When either snapshot is missing the channel is
unknown for that range and is listed as missing — it is never treated as zero.
"""

from __future__ import annotations

import asyncio
from datetime import date, timedelta
from typing import Any

from fastapi import HTTPException

from .aggregate import sum_known
from .connectors import newest_reviews
from .db import require_db
from .operating import (
    campaign_public,
    content_public,
    initiative_public,
    is_planning_placeholder,
)
from .seed import CHANNELS
from .store import current_month, dashboard, settings_doc

METRICS = ("spend", "impressions", "clicks", "raw_results")
_CLOSED_CONTENT = ("Scheduled", "Published")


def _num(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def snapshot_index(records: list[dict[str, Any]]) -> dict[tuple[str, str], dict[str, dict[str, Any]]]:
    """(channel, YYYY-MM) → {snapshot day → latest row for that day}."""
    index: dict[tuple[str, str], dict[str, dict[str, Any]]] = {}
    for row in records:
        if row.get("record_type") != "Monthly MTD":
            continue
        month = str(row.get("period_start") or "")[:7]
        day = str(row.get("snapshot_date") or row.get("period_end") or "")[:10]
        if len(month) != 7 or len(day) != 10 or not day.startswith(month):
            continue
        slot = index.setdefault((str(row.get("channel")), month), {})
        slot[day] = row
    return index


def _segment(days: dict[str, dict[str, Any]], start: date, end: date) -> dict[str, float | None] | None:
    """Values for start..end inside one month, or None when the snapshots do not cover it."""
    eligible = [day for day in days if start.isoformat() <= day <= end.isoformat()]
    if not eligible:
        return None
    last = days[max(eligible)]
    if start.day == 1:
        base: dict[str, Any] | None = {}
    else:
        base = days.get((start - timedelta(days=1)).isoformat())
        if base is None:
            return None
    out: dict[str, float | None] = {}
    for metric in METRICS:
        top = _num(last.get(metric))
        bottom = 0.0 if start.day == 1 else _num(base.get(metric))
        out[metric] = None if top is None or bottom is None else max(0.0, top - bottom)
    out["as_of"] = max(eligible)  # type: ignore[assignment]
    return out


def _months(start: date, end: date) -> list[tuple[date, date]]:
    parts = []
    cursor = start
    while cursor <= end:
        nxt = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
        parts.append((cursor, min(end, nxt - timedelta(days=1))))
        cursor = nxt
    return parts


def paid_range(index: dict[tuple[str, str], dict[str, dict[str, Any]]], start: date, end: date) -> dict[str, Any]:
    channels = []
    missing = []
    for channel in CHANNELS:
        totals: dict[str, float | None] = {metric: 0.0 for metric in METRICS}
        known = True
        spends = False
        for a, b in _months(start, end):
            days = index.get((channel, a.strftime("%Y-%m")), {})
            if any(_num(row.get("spend")) is not None for row in days.values()):
                spends = True
            part = _segment(days, a, b)
            if part is None:
                known = False
                continue
            for metric in METRICS:
                value = part[metric]
                totals[metric] = None if value is None or totals[metric] is None else totals[metric] + value
        if not spends:
            continue
        if not known:
            missing.append(channel)
            channels.append({"channel": channel, **{metric: None for metric in METRICS}})
            continue
        channels.append({"channel": channel, **totals})
    totals = {metric: sum_known([row[metric] for row in channels]) for metric in METRICS}
    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        **totals,
        "channels": channels,
        "missing": missing,
    }


def _overlaps(start: str | None, end: str | None, a: str, b: str) -> bool:
    if not start:
        return False
    stop = end or start
    return start <= b and stop >= a


async def _content() -> list[dict[str, Any]]:
    database = require_db()
    rows, names = await asyncio.gather(
        database["content_calendar"].find({}).to_list(length=3000),
        database["marketing_campaigns"].find({}, {"name": 1}).to_list(1000),
    )
    campaigns = {str(c["_id"]): str(c.get("name") or "") for c in names}
    return [content_public(doc, campaigns) for doc in rows if not is_planning_placeholder(doc)]


async def _tasks() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    database = require_db()
    open_rows, log = await asyncio.gather(
        database["marketing_os_work"].find({"open": {"$ne": False}}).to_list(length=2000),
        database["marketing_os_work_log"].find({}).sort("closed_on", -1).to_list(length=2000),
    )

    def public(doc: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": str(doc.get("_id")),
            "title": doc.get("title") or "",
            "owner": doc.get("owner") or "",
            "stage": doc.get("stage") or "Queued",
            "deadline": doc.get("deadline"),
            "priority": doc.get("priority") or "Medium",
            "blocker": doc.get("blocker") or "",
            "link_type": doc.get("link_type"),
            "link_id": doc.get("link_id"),
            "stage_on": doc.get("stage_on"),
            "closed_on": doc.get("closed_on"),
            "hours": doc.get("hours"),
            "cost_aed": doc.get("cost_aed"),
        }

    return [public(doc) for doc in open_rows], [public(doc) for doc in log]


def _content_brief(item: dict[str, Any]) -> dict[str, Any]:
    return {
        key: item[key]
        for key in ("id", "title", "status", "publish_date", "due_date", "channels", "owner", "campaign_name", "format", "kpi")
    }


def _due(item: dict[str, Any]) -> str | None:
    return item.get("due_date") or item.get("publish_date")


async def overview(today: date | None = None) -> dict[str, Any]:
    database = require_db()
    today = today or date.today()
    iso = today.isoformat()
    start = today - timedelta(days=6)
    prior_end = start - timedelta(days=1)
    prior_start = prior_end - timedelta(days=6)

    records, board, content, (open_tasks, _), campaign_docs, initiative_docs, settings, site, owner_docs = await asyncio.gather(
        database["marketing_os_records"].find({"record_type": "Monthly MTD"}).to_list(length=20000),
        dashboard(current_month()),
        _content(),
        _tasks(),
        database["marketing_campaigns"].find({}).to_list(1000),
        database["marketing_os_initiatives"].find({}).to_list(500),
        settings_doc(),
        database["marketing_os_site"].find_one({"_id": "current"}),
        database["marketing_os_review_owners"].find({}).to_list(500),
    )
    index = snapshot_index(records)
    current = paid_range(index, start, today)
    prior = paid_range(index, prior_start, prior_end)

    week = (start.isoformat(), iso)
    prior_week = (prior_start.isoformat(), prior_end.isoformat())
    published = [c for c in content if c["status"] == "Published" and c["publish_date"] and week[0] <= c["publish_date"] <= week[1]]
    published_prior = [c for c in content if c["status"] == "Published" and c["publish_date"] and prior_week[0] <= c["publish_date"] <= prior_week[1]]
    horizon = (today + timedelta(days=14)).isoformat()
    upcoming = sorted(
        (c for c in content if c["status"] != "Published" and c["publish_date"] and iso <= c["publish_date"] <= horizon),
        key=lambda c: c["publish_date"],
    )
    late = sorted(
        (c for c in content if c["status"] not in _CLOSED_CONTENT and _due(c) and _due(c) < iso),
        key=lambda c: _due(c) or "",
    )
    review = [c for c in content if c["status"] == "Review"]

    active = [t for t in open_tasks if t["stage"] != "Done"]
    overdue = sorted((t for t in active if t["deadline"] and t["deadline"] < iso), key=lambda t: t["deadline"])
    due_soon = sorted(
        (t for t in active if t["deadline"] and iso <= t["deadline"] <= (today + timedelta(days=7)).isoformat()),
        key=lambda t: t["deadline"],
    )
    blocked = [t for t in active if t["stage"] == "Blocked" or t["blocker"]]
    approvals = [t for t in active if t["stage"] == "Review"]

    campaigns = [campaign_public(doc, today) for doc in campaign_docs]
    counts: dict[str, dict[str, int]] = {}
    for item in content:
        if item["campaign_id"]:
            slot = counts.setdefault(item["campaign_id"], {"total": 0, "published": 0})
            slot["total"] += 1
            slot["published"] += int(item["status"] == "Published")
    for item in campaigns:
        item["content"] = counts.get(item["id"], {"total": 0, "published": 0})
    live = sorted((c for c in campaigns if c["status"] == "Live"), key=lambda c: c["end_date"] or c["start_date"] or "")
    soon = sorted(
        (c for c in campaigns if c["status"] == "Planned" and (c["start_date"] or "") <= (today + timedelta(days=30)).isoformat()),
        key=lambda c: c["start_date"] or "",
    )

    initiatives = [initiative_public(doc) for doc in initiative_docs]
    rank = {"High": 0, "Medium": 1, "Low": 2}
    focus = sorted(
        (i for i in initiatives if i["status"] != "Done"),
        key=lambda i: (rank.get(i["priority"], 1), i["deadline"] or "9999"),
    )

    month_spend = board.get("spend")
    qualified = board.get("qualified")
    return {
        "today": iso,
        "range": {"from": start.isoformat(), "to": iso},
        "prior": {"from": prior_start.isoformat(), "to": prior_end.isoformat()},
        "synced_at": settings.get("synced_at"),
        "paid": {
            "current": current,
            "prior": prior,
            "month": {
                "month": board.get("month"),
                "spend": month_spend,
                "budget": board.get("budget"),
                "qualified": qualified,
                "quotes": board.get("quotes"),
                "orders_90d": board.get("orders_90d"),
                "revenue_90d": board.get("revenue_90d"),
                "cpl": month_spend / qualified if month_spend is not None and qualified else None,
            },
            "channels": board.get("channels") or [],
            "connectors": board.get("connectors") or [],
            "targets": board.get("targets") or [],
            "alerts": board.get("alerts") or [],
            "odoo": ((board.get("site") or {}).get("odoo") or {}),
        },
        "content": {
            "published": len(published),
            "published_prior": len(published_prior),
            "upcoming": [_content_brief(c) for c in upcoming[:8]],
            "upcoming_count": len(upcoming),
            "late": [_content_brief(c) for c in late[:6]],
            "late_count": len(late),
            "review": [_content_brief(c) for c in review[:6]],
        },
        "tasks": {
            "open": len(active),
            "overdue": overdue[:6],
            "overdue_count": len(overdue),
            "due_soon": due_soon[:6],
            "blocked": blocked[:6],
            "blocked_count": len(blocked),
            "approvals": approvals[:6],
        },
        "campaigns": {"live": live[:6], "upcoming": soon[:6]},
        "initiatives": {
            "focus": focus[:6],
            "blocked": len([i for i in initiatives if i["status"] == "Blocked" or i["blockers"]]),
            "overdue": len([i for i in initiatives if i["status"] != "Done" and i["deadline"] and i["deadline"] < iso]),
            "total": len(initiatives),
        },
        "discovery": _discovery(site, owner_docs),
    }


def _discovery(site: dict[str, Any] | None, owners: list[dict[str, Any]]) -> dict[str, Any]:
    site = site or {}
    search = site.get("search") if isinstance(site.get("search"), dict) else {}
    reviews = site.get("reviews") if isinstance(site.get("reviews"), dict) else {}
    by_id = {str(doc.get("_id")): str(doc.get("owner") or "") for doc in owners}
    items = []
    for row in reviews.get("items") or []:
        if not isinstance(row, dict) or not row.get("id"):
            continue
        review_id = str(row["id"])
        items.append(
            {
                "id": review_id,
                "reviewer": row.get("reviewer") or "",
                "stars": row.get("stars"),
                "text": row.get("text") or "",
                "created": row.get("created") or "",
                "replied": bool(row.get("replied")),
                "owner": by_id.get(review_id, ""),
            }
        )
    items = newest_reviews(items)
    queries = [row for row in (search.get("queries") or []) if isinstance(row, dict) and row.get("query")]
    return {
        "search": {
            "state": search.get("state"),
            "detail": search.get("detail"),
            "clicks": search.get("clicks"),
            "impressions": search.get("impressions"),
            "as_of": search.get("as_of"),
            "queries": queries[:40],
        },
        "reviews": {
            "state": reviews.get("state"),
            "detail": reviews.get("detail"),
            "rating": reviews.get("rating"),
            "count": reviews.get("count"),
            "items": items[:200],
        },
    }


async def save_review_owner(review_id: str, owner: str) -> dict[str, str]:
    text = review_id.strip()
    if not text or len(text) > 200 or any(char in text for char in "/\\?#\n\r"):
        raise HTTPException(status_code=400, detail="NOT_FOUND")
    name = owner.strip()
    if len(name) > 80:
        raise HTTPException(status_code=400, detail="Sales owner is too long.")
    database = require_db()
    if name:
        await database["marketing_os_review_owners"].replace_one({"_id": text}, {"_id": text, "owner": name}, upsert=True)
    else:
        await database["marketing_os_review_owners"].delete_one({"_id": text})
    return {"id": text, "owner": name}


def _crm_range(rows: list[dict[str, Any]], start: date, end: date) -> dict[str, float | None]:
    """CRM numbers are monthly; only months fully inside the range count."""
    months = []
    for a, b in _months(start, end):
        last = (a.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        if a.day == 1 and b == last:
            months.append(a.strftime("%Y-%m"))
    out: dict[str, float | None] = {}
    for key in ("qualified", "whatsapp", "quotes", "orders_90d", "revenue_90d"):
        if not months:
            out[key] = None
            continue
        out[key] = sum_known([_num(row.get(key)) for row in rows if row.get("month") in months])
    out["months"] = months  # type: ignore[assignment]
    return out


async def report(start_raw: str, end_raw: str) -> dict[str, Any]:
    try:
        start = date.fromisoformat(start_raw[:10])
        end = date.fromisoformat(end_raw[:10])
    except ValueError:
        raise HTTPException(status_code=400, detail="INVALID_RANGE")
    if end < start or (end - start).days > 400:
        raise HTTPException(status_code=400, detail="INVALID_RANGE")
    database = require_db()
    a, b = start.isoformat(), end.isoformat()
    today = date.today()

    records, crm_rows, content, (open_tasks, log), campaign_docs, initiative_docs, connectors, site = await asyncio.gather(
        database["marketing_os_records"].find({"record_type": "Monthly MTD"}).to_list(length=20000),
        database["marketing_os_crm"].find({}).to_list(2000),
        _content(),
        _tasks(),
        database["marketing_campaigns"].find({}).to_list(1000),
        database["marketing_os_initiatives"].find({}).to_list(500),
        database["marketing_os_connectors"].find({"state": "error"}).to_list(30),
        database["marketing_os_site"].find_one({"_id": "current"}),
    )
    paid = paid_range(snapshot_index(records), start, min(end, today))
    crm = {**_crm_range(crm_rows, start, end), "odoo": ((site or {}).get("odoo") or {})}

    delivered = sorted(
        (c for c in content if c["status"] == "Published" and c["publish_date"] and a <= c["publish_date"] <= b),
        key=lambda c: c["publish_date"],
    )
    by_channel: dict[str, int] = {}
    for item in delivered:
        for name in item["channels"] or ["Unassigned"]:
            by_channel[name] = by_channel.get(name, 0) + 1
    views = sum_known([c["kpi"]["views"] for c in delivered])

    campaigns = []
    for doc in campaign_docs:
        item = campaign_public(doc, today)
        if not _overlaps(item["start_date"], item["end_date"], a, b):
            continue
        linked = [c for c in content if c["campaign_id"] == item["id"]]
        item["content"] = {
            "total": len(linked),
            "published": len([c for c in linked if c["status"] == "Published"]),
            "views": sum_known([c["kpi"]["views"] for c in linked]),
        }
        campaigns.append(item)
    campaigns.sort(key=lambda c: c["start_date"] or "")

    done = [t for t in open_tasks if t["stage"] == "Done" and t["stage_on"] and a <= t["stage_on"] <= b]
    done += [t for t in log if t["closed_on"] and a <= t["closed_on"] <= b and t["stage"] == "Done"]
    initiatives = [initiative_public(doc) | {"done_on": doc.get("done_on")} for doc in initiative_docs]
    finished = [i for i in initiatives if i["status"] == "Done" and i.get("done_on") and a <= i["done_on"] <= b]

    ahead = (max(end, today) + timedelta(days=14)).isoformat()
    after = max(b, today.isoformat())
    upcoming_content = sorted(
        (c for c in content if c["status"] != "Published" and c["publish_date"] and after < c["publish_date"] <= ahead),
        key=lambda c: c["publish_date"],
    )
    upcoming_tasks = sorted(
        (t for t in open_tasks if t["stage"] != "Done" and t["deadline"] and after < t["deadline"] <= ahead),
        key=lambda t: t["deadline"],
    )
    blocked = [t for t in open_tasks if t["stage"] != "Done" and (t["stage"] == "Blocked" or t["blocker"])]
    blocked_initiatives = [i for i in initiatives if i["status"] != "Done" and (i["status"] == "Blocked" or i["blockers"])]

    return {
        "from": a,
        "to": b,
        "generated_on": today.isoformat(),
        "paid": paid,
        "crm": crm,
        "content": {
            "delivered": [_content_brief(c) for c in delivered],
            "by_channel": by_channel,
            "views": views,
        },
        "campaigns": campaigns,
        "completed": {
            "tasks": done[:40],
            "initiatives": finished,
        },
        "upcoming": {
            "content": [_content_brief(c) for c in upcoming_content[:12]],
            "tasks": upcoming_tasks[:12],
        },
        "blockers": {
            "tasks": blocked[:20],
            "initiatives": blocked_initiatives,
            "connectors": [{"name": c.get("name"), "detail": c.get("detail")} for c in connectors],
        },
    }
