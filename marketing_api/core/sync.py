from __future__ import annotations

import asyncio
from datetime import date

from .config import get_settings
from .connectors import run_connectors
from .db import db
from .odoo import pull_odoo
from .store import rebuild, settings_doc

_running = asyncio.Lock()


async def run_sync() -> dict:
    if _running.locked():
        return {"started": False, "detail": "A sync is already running."}
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

        # Recompute the combined monthly trend from channel MTD rows so the chart stays consistent.
        mtd = await database["marketing_os_records"].find({"record_type": "Monthly MTD", "source": "live"}).to_list(5000)
        by_month: dict[str, dict] = {}
        for row in mtd:
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

        selected = (await settings_doc()).get("selected_month")
        await rebuild(selected)
        return {"started": True, "connectors": outcome["connectors"], "odoo": odoo.get("state")}


async def sync_loop() -> None:
    settings = get_settings()
    interval = max(300, int(settings.sync_interval_seconds or 3600))
    first = True
    while True:
        try:
            await asyncio.sleep(8 if first else interval)
            first = False
            if db() is not None:
                await run_sync()
        except asyncio.CancelledError:
            raise
        except Exception:
            continue
