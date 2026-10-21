from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timezone

from .audience import sync_audience
from .config import get_settings
from .connectors import run_connectors
from .db import db
from .odoo import pull_odoo
from .store import current_month, rebuild, settings_doc

log = logging.getLogger("uvicorn.error")

_running = asyncio.Lock()
AUTOMATIC_SYNC_SECONDS = 12 * 60 * 60


def _interval_seconds(settings) -> int:
    configured = int(settings.sync_interval_seconds or AUTOMATIC_SYNC_SECONDS)
    return max(AUTOMATIC_SYNC_SECONDS, configured)


def seconds_until_next(elapsed: float | None, interval: int) -> float:
    """How long to wait before the next pull. Due now when there has never been one."""
    if elapsed is None or elapsed >= interval:
        return 0
    return interval - elapsed


def _seconds_since(raw: object) -> float | None:
    if not raw:
        return None
    try:
        moment = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - moment).total_seconds()


def latest_monthly_snapshots(rows: list[dict]) -> list[dict]:
    latest: dict[tuple, dict] = {}
    for row in rows:
        key = (row.get("channel"), str(row.get("period_start") or "")[:7])
        if key not in latest or str(row.get("snapshot_date") or "") > str(latest[key].get("snapshot_date") or ""):
            latest[key] = row
    return list(latest.values())


def months_to_publish(selected: object, cached: list[object], today: str) -> list[str]:
    """The open month is always rebuilt. A saved September selection must not hide October."""
    months = {today}
    if isinstance(selected, str) and len(selected) >= 7:
        months.add(selected[:7])
    for key in cached:
        text = str(key or "")
        if len(text) >= 7 and text[4] == "-":
            months.add(text[:7])
    return sorted(months)


async def _months_to_publish(database) -> list[str]:
    selected = (await settings_doc()).get("selected_month")
    cached = []
    async for doc in database["marketing_os_cache"].find({}, {"_id": 1}):
        cached.append(doc.get("_id"))
    return months_to_publish(selected, cached, current_month())


async def run_sync() -> dict:
    async with _running:
        database = db()
        if database is None:
            return {"started": False, "detail": "MongoDB is not configured."}
        settings = get_settings()
        doc = await settings_doc()
        fx = float(doc.get("fx_usd_aed") or 3.6725)
        outcome = await run_connectors(settings, date.today(), fx=fx)
        for record in outcome["records"]:
            await database["marketing_os_records"].replace_one({"_id": record["_id"]}, record, upsert=True)
        for connector in outcome["connectors"]:
            await database["marketing_os_connectors"].replace_one({"_id": connector["_id"]}, connector, upsert=True)
            if connector.get("name") and connector.get("checked_on"):
                await database["marketing_os_status"].update_one(
                    {"_id": connector["name"]},
                    {"$set": {"checked_on": connector["checked_on"]}},
                )
        # Older error states used lower-case IDs and otherwise remain as duplicate sources.
        await database["marketing_os_connectors"].delete_many(
            {"_id": {"$in": ["meta", "google_ads", "linkedin", "pinterest", "tiktok", "snapchat"]}}
        )

        try:
            odoo = await asyncio.to_thread(
                pull_odoo,
                settings,
                doc.get("mappings") or [],
                doc.get("qualified_stages") or [],
            )
        except Exception as exc:  # noqa: BLE001
            odoo = {"state": "error", "detail": str(exc), "rows": [], "unmapped": 0}
        for row in odoo.get("rows") or []:
            await database["marketing_os_crm"].replace_one({"_id": row["_id"]}, row, upsert=True)
        site = await database["marketing_os_site"].find_one({"_id": "current"}) or {"_id": "current"}
        site.update(outcome["site"])
        site["unmapped_leads"] = odoo.get("unmapped") or 0
        site["odoo"] = {"state": odoo.get("state"), "detail": odoo.get("detail")}
        await database["marketing_os_site"].replace_one({"_id": "current"}, site, upsert=True)

        for row in await sync_audience(settings, date.today()):
            await database["marketing_os_audience"].replace_one({"_id": row["_id"]}, row, upsert=True)

        try:
            from .paid_campaigns import sync_paid_campaigns

            await sync_paid_campaigns(date.today())
        except Exception:
            log.exception("campaign-level paid sync failed")

        # Recompute the combined monthly trend from channel MTD rows so the chart stays consistent.
        mtd = await database["marketing_os_records"].find({"record_type": "Monthly MTD", "source": "live"}).to_list(5000)
        by_month: dict[str, dict] = {}
        # MTD snapshots are cumulative. Only the latest per channel/month counts.
        for row in latest_monthly_snapshots(mtd):
            month = str(row.get("period_start") or "")[:7]
            if not month:
                continue
            slot = by_month.setdefault(month, {"spend": 0.0, "impressions": 0.0, "clicks": 0.0, "raw_results": 0.0, "seen": False})
            if row.get("spend") is not None:
                slot["spend"] += float(row["spend"])
                slot["seen"] = True
            if row.get("impressions") is not None:
                slot["impressions"] += float(row["impressions"])
            if row.get("clicks") is not None:
                slot["clicks"] += float(row["clicks"])
            if row.get("raw_results") is not None:
                slot["raw_results"] += float(row["raw_results"])
        for month, slot in by_month.items():
            if not slot["seen"]:
                continue
            clicks = slot["clicks"] or None
            impressions = slot["impressions"] or None
            ctr = (clicks / impressions) if clicks and impressions else None
            await database["marketing_os_trend"].replace_one(
                {"_id": f"trend:{month}"},
                {
                    "_id": f"trend:{month}",
                    "month": month,
                    "spend": slot["spend"],
                    "impressions": impressions,
                    "clicks": clicks,
                    "raw_results": slot["raw_results"],
                    "ctr": ctr,
                },
                upsert=True,
            )

        for month in await _months_to_publish(database):
            await rebuild(month)
        await database["marketing_os_settings"].update_one(
            {"_id": "current"},
            {"$set": {"synced_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")}},
            upsert=True,
        )
        return {"started": True, "connectors": outcome["connectors"], "odoo": odoo.get("state")}


async def sync_loop() -> None:
    """Pull ad accounts and profile stats twice a day. A failure retries in 15 minutes."""
    while True:
        try:
            if db() is None:
                await asyncio.sleep(60)
                continue
            interval = _interval_seconds(get_settings())
            elapsed = _seconds_since((await settings_doc()).get("synced_at"))
            delay = seconds_until_next(elapsed, interval)
            if delay:
                await asyncio.sleep(delay)
                continue
            result = await run_sync()
            if not result.get("started"):
                log.warning("scheduled marketing sync skipped: %s", result.get("detail") or "not started")
                await asyncio.sleep(15 * 60)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("scheduled marketing sync failed")
            await asyncio.sleep(15 * 60)
