from __future__ import annotations

import asyncio
from datetime import date
from typing import Any

from pymongo import UpdateOne

from .aggregate import build_dashboard
from .audience import AUDIENCE_ORDER
from .db import db, require_db
from .seed import (
    CHANNELS,
    DEFAULT_SETTINGS,
    calendar_months,
    budget_rows,
    empty_site,
    mtd_records,
    status_rows,
    target_rows,
    trend_rows,
)

def current_month() -> str:
    return date.today().strftime("%Y-%m")


def cache_is_current(payload: dict[str, Any]) -> bool:
    names = [row.get("channel") for row in payload.get("channels") or []]
    return names == CHANNELS and payload.get("horizon_end") == f"{date.today().year}-12"


def complete_budget_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Every catalog channel appears in every month of each planned year."""
    stored: dict[tuple[str, str], dict[str, Any]] = {}
    years: set[int] = {date.today().year}
    for row in rows:
        month = str(row.get("month") or "")[:7]
        channel = str(row.get("channel") or "")
        if len(month) == 7 and month[:4].isdigit() and channel:
            stored[(month, channel)] = row
            years.add(int(month[:4]))
    items: list[dict[str, Any]] = []
    for year in sorted(years):
        for month in calendar_months(year):
            for channel in CHANNELS:
                row = stored.get((month, channel)) or {
                    "month": month,
                    "channel": channel,
                    "budget_aed": None,
                    "approval": "Draft",
                    "note": "",
                }
                items.append({key: value for key, value in row.items() if key != "_id"})
    return items


_version = 0
_lock = asyncio.Lock()
_listeners: list[asyncio.Event] = []


def subscribe() -> asyncio.Event:
    event = asyncio.Event()
    _listeners.append(event)
    return event


def unsubscribe(event: asyncio.Event) -> None:
    if event in _listeners:
        _listeners.remove(event)


def _publish() -> None:
    for event in list(_listeners):
        event.set()


def notify() -> None:
    """Wake live listeners without rebuilding the paid dashboard cache."""
    _publish()


async def seed_if_empty() -> None:
    database = db()
    if database is None:
        return
    if await database["marketing_os_settings"].count_documents({}) == 0:
        await database["marketing_os_settings"].insert_one(dict(DEFAULT_SETTINGS))
    if await database["marketing_os_records"].count_documents({"record_type": "Monthly MTD"}) == 0:
        await database["marketing_os_records"].insert_many(mtd_records())
    if await database["marketing_os_budgets"].count_documents({}) == 0:
        await database["marketing_os_budgets"].insert_many(budget_rows())
    if await database["marketing_os_targets"].count_documents({}) == 0:
        await database["marketing_os_targets"].insert_many(target_rows())
    if await database["marketing_os_status"].count_documents({}) == 0:
        await database["marketing_os_status"].insert_many(status_rows())
    if await database["marketing_os_trend"].count_documents({}) == 0:
        await database["marketing_os_trend"].insert_many(trend_rows())
    if await database["marketing_os_site"].count_documents({}) == 0:
        await database["marketing_os_site"].insert_one(empty_site())
    if await database["marketing_os_crm"].count_documents({}) == 0:
        rows = []
        for month in ("2026-09", "2026-10"):
            for channel in CHANNELS:
                rows.append(
                    {
                        "_id": f"{month}:{channel}",
                        "month": month,
                        "channel": channel,
                        "qualified": None,
                        "whatsapp": None,
                        "quotes": None,
                        "orders_90d": None,
                        "revenue_90d": None,
                        "source": "pending",
                    }
                )
        await database["marketing_os_crm"].insert_many(rows)
    await ensure_channels()


async def _fill_missing(collection, rows: list[dict[str, Any]]) -> None:
    """Insert catalog rows that are not stored yet, in one round trip."""
    if not rows:
        return
    await collection.bulk_write(
        [UpdateOne({"_id": row["_id"]}, {"$setOnInsert": row}, upsert=True) for row in rows],
        ordered=False,
    )


async def ensure_channels() -> None:
    """Add channels that were introduced after the first seed, without overwriting saved numbers."""
    database = db()
    if database is None:
        return

    settings = await database["marketing_os_settings"].find_one({"_id": "current"})
    if settings:
        have = {item.get("contains") for item in (settings.get("mappings") or [])}
        missing = [item for item in DEFAULT_SETTINGS["mappings"] if item["contains"] not in have]
        if missing:
            await database["marketing_os_settings"].update_one(
                {"_id": "current"},
                {"$push": {"mappings": {"$each": missing}}},
            )

    months = set(calendar_months(date.today().year))
    async for doc in database["marketing_os_crm"].find({}, {"month": 1}):
        if doc.get("month"):
            months.add(str(doc["month"]))
    crm_rows = [
        {
            "_id": f"{month}:{channel}",
            "month": month,
            "channel": channel,
            "qualified": None,
            "whatsapp": None,
            "quotes": None,
            "orders_90d": None,
            "revenue_90d": None,
            "source": "pending",
        }
        for month in months
        for channel in CHANNELS
    ]
    await asyncio.gather(
        _fill_missing(database["marketing_os_budgets"], budget_rows()),
        _fill_missing(database["marketing_os_status"], status_rows()),
        _fill_missing(database["marketing_os_targets"], target_rows()),
        _fill_missing(database["marketing_os_crm"], crm_rows),
    )

    for name, detail in (
        ("TikTok", "TikTok is not connected. Use Connect TikTok on the Connections page."),
        ("Snapchat", "SNAPCHAT_REFRESH_TOKEN is not set."),
    ):
        await database["marketing_os_connectors"].update_one(
            {"_id": name},
            {"$setOnInsert": {"_id": name, "name": name, "state": "unconfigured", "detail": detail}},
            upsert=True,
        )
        await database["marketing_os_connectors"].update_one(
            {"_id": name, "state": "unconfigured"},
            {"$set": {"detail": detail}},
        )

    async for doc in database["marketing_os_cache"].find({}, {"channels.channel": 1, "horizon_end": 1}):
        if not cache_is_current(doc):
            await database["marketing_os_cache"].delete_one({"_id": doc["_id"]})


async def settings_doc() -> dict[str, Any]:
    database = require_db()
    doc = await database["marketing_os_settings"].find_one({"_id": "current"})
    return doc or dict(DEFAULT_SETTINGS)


async def rebuild(month: str | None = None) -> dict[str, Any]:
    global _version
    database = require_db()
    settings = await settings_doc()
    month = month or current_month()
    records = await database["marketing_os_records"].find({}).to_list(length=5000)
    budgets = await database["marketing_os_budgets"].find({}).to_list(length=1000)
    statuses = await database["marketing_os_status"].find({}).to_list(length=20)
    targets = await database["marketing_os_targets"].find({}).to_list(length=100)
    crm_rows = await database["marketing_os_crm"].find({}).to_list(length=500)
    trend = await database["marketing_os_trend"].find({}).to_list(length=48)
    site = await database["marketing_os_site"].find_one({"_id": "current"}) or empty_site()
    connectors = await database["marketing_os_connectors"].find({}).to_list(length=20)
    payload = build_dashboard(
        month=month,
        records=records,
        budgets=budgets,
        statuses=statuses,
        targets=targets,
        crm_rows=crm_rows,
        trend=trend,
        site=site,
        connectors=sorted(connectors, key=lambda item: item.get("name") or ""),
        fx=float(settings.get("fx_usd_aed") or 3.6725),
    )
    async with _lock:
        _version += 1
        payload["version"] = _version
        await database["marketing_os_cache"].replace_one({"_id": month}, {"_id": month, **payload}, upsert=True)
    _publish()
    return payload


async def rebuild_if_stale(month: str | None = None) -> dict[str, Any] | None:
    """Skip the startup rebuild when this month's dashboard cache is already usable."""
    database = db()
    if database is None:
        return None
    month = month or current_month()
    cached = await database["marketing_os_cache"].find_one({"_id": month})
    if cached and cached.get("version") and cache_is_current(cached):
        return None
    return await rebuild(month)


async def dashboard(month: str | None = None) -> dict[str, Any]:
    database = require_db()
    month = month or current_month()
    cached, connectors, site, audience_rows = await asyncio.gather(
        database["marketing_os_cache"].find_one({"_id": month}),
        database["marketing_os_connectors"].find({}).to_list(length=30),
        database["marketing_os_site"].find_one({"_id": "current"}),
        database["marketing_os_audience"].find({}).to_list(length=20),
    )
    if cached and cached.get("version") and cache_is_current(cached):
        cached.pop("_id", None)
        payload = cached
    else:
        payload = await rebuild(month)
    payload["connectors"] = [{key: value for key, value in row.items() if key != "_id"} for row in connectors]
    if site:
        payload["site"] = {key: value for key, value in site.items() if key != "_id"}
    by_id = {row.get("_id"): row for row in audience_rows}
    audience = []
    for channel_id, name in AUDIENCE_ORDER:
        row = by_id.get(channel_id) or {
            "channel": name,
            "state": "waiting",
            "detail": "Waiting for the first snapshot.",
            "followers": None,
            "growth": None,
            "views": None,
            "likes": None,
            "comments": None,
        }
        audience.append({key: value for key, value in row.items() if key != "_id"})
    payload["audience"] = audience
    payload["month"] = month
    return payload


async def save_settings(patch: dict[str, Any]) -> dict[str, Any]:
    database = require_db()
    allowed = {"fx_usd_aed", "selected_month", "mappings", "qualified_stages"}
    clean = {k: v for k, v in patch.items() if k in allowed}
    if clean:
        await database["marketing_os_settings"].update_one({"_id": "current"}, {"$set": clean}, upsert=True)
    await rebuild(clean.get("selected_month"))
    return await settings_doc()


async def replace_targets(rows: list[dict[str, Any]]) -> None:
    database = require_db()
    for row in rows:
        channel = str(row.get("channel") or "").strip()
        metric = str(row.get("metric") or "").strip()
        if not channel or not metric:
            continue
        await database["marketing_os_targets"].update_one(
            {"_id": f"{channel}:{metric}"},
            {
                "$set": {
                    "channel": channel,
                    "metric": metric,
                    "target": row.get("target"),
                    "direction": row.get("direction") or "lte",
                    "unit": row.get("unit") or "",
                    "status": "Approved",
                }
            },
            upsert=True,
        )
    await rebuild()


async def replace_budgets(rows: list[dict[str, Any]]) -> None:
    database = require_db()
    last_month: str | None = None
    for row in rows:
        month = str(row.get("month") or "")[:7]
        channel = str(row.get("channel") or "").strip()
        if not month or not channel:
            continue
        last_month = month
        await database["marketing_os_budgets"].update_one(
            {"_id": f"{month}:{channel}"},
            {
                "$set": {
                    "month": month,
                    "channel": channel,
                    "budget_aed": row.get("budget_aed"),
                    "approval": row.get("approval") or "Proposed",
                    "note": row.get("note") or "",
                }
            },
            upsert=True,
        )
    await rebuild(last_month)
