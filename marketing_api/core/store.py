from __future__ import annotations

import asyncio
from typing import Any

from .aggregate import build_dashboard
from .db import db, require_db
from .seed import (
    CHANNELS,
    DEFAULT_SETTINGS,
    budget_rows,
    empty_site,
    mtd_records,
    status_rows,
    target_rows,
    trend_rows,
)

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

    for row in budget_rows():
        await database["marketing_os_budgets"].update_one({"_id": row["_id"]}, {"$setOnInsert": row}, upsert=True)
    for row in status_rows():
        await database["marketing_os_status"].update_one({"_id": row["_id"]}, {"$setOnInsert": row}, upsert=True)
    for row in target_rows():
        await database["marketing_os_targets"].update_one({"_id": row["_id"]}, {"$setOnInsert": row}, upsert=True)

    months = {"2026-09", "2026-10"}
    async for doc in database["marketing_os_crm"].find({}, {"month": 1}):
        if doc.get("month"):
            months.add(doc["month"])
    for month in months:
        for channel in CHANNELS:
            row = {
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
            await database["marketing_os_crm"].update_one({"_id": row["_id"]}, {"$setOnInsert": row}, upsert=True)

    for name, detail in (
        ("TikTok", "TIKTOK_ACCESS_TOKEN is not set."),
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


async def settings_doc() -> dict[str, Any]:
    database = require_db()
    doc = await database["marketing_os_settings"].find_one({"_id": "current"})
    return doc or dict(DEFAULT_SETTINGS)


async def rebuild(month: str | None = None) -> dict[str, Any]:
    global _version
    database = require_db()
    settings = await settings_doc()
    month = month or settings.get("selected_month") or "2026-09"
    records = await database["marketing_os_records"].find({}).to_list(length=5000)
    budgets = await database["marketing_os_budgets"].find({}).to_list(length=200)
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


async def dashboard(month: str | None = None) -> dict[str, Any]:
    database = require_db()
    settings = await settings_doc()
    month = month or settings.get("selected_month") or "2026-09"
    cached = await database["marketing_os_cache"].find_one({"_id": month})
    if cached and cached.get("version"):
        cached.pop("_id", None)
        return cached
    return await rebuild(month)


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
