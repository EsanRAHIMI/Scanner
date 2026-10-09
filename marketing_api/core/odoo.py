from __future__ import annotations

import xmlrpc.client
from datetime import datetime
from typing import Any

from .config import Settings


def _channel_for(text: str, mappings: list[dict[str, str]]) -> str | None:
    lowered = text.lower()
    for mapping in mappings:
        needle = str(mapping.get("contains") or "").lower()
        if needle and needle in lowered:
            return mapping.get("channel")
    return None


def _label(value: Any) -> str:
    if isinstance(value, (list, tuple)) and len(value) > 1:
        return str(value[1])
    return str(value or "")


def pull_odoo(settings: Settings, mappings: list[dict[str, str]], stages: list[str]) -> dict[str, Any]:
    if not (settings.odoo_url and settings.odoo_db and settings.odoo_username and settings.odoo_api_key):
        return {"state": "unconfigured", "detail": "Odoo credentials are not set.", "rows": [], "unmapped": 0}

    base = settings.odoo_url.rstrip("/")
    common = xmlrpc.client.ServerProxy(f"{base}/xmlrpc/2/common", allow_none=True)
    uid = common.authenticate(settings.odoo_db, settings.odoo_username, settings.odoo_api_key, {})
    if not uid:
        raise RuntimeError("Odoo authentication failed")
    models = xmlrpc.client.ServerProxy(f"{base}/xmlrpc/2/object", allow_none=True)

    def read(model: str, domain: list, fields: list[str]) -> list[dict]:
        return models.execute_kw(
            settings.odoo_db,
            uid,
            settings.odoo_api_key,
            model,
            "search_read",
            [domain],
            {"fields": fields, "limit": 2000},
        )

    leads = read(
        "crm.lead",
        [],
        ["name", "create_date", "stage_id", "source_id", "medium_id", "campaign_id", "type"],
    )
    orders = read(
        "sale.order",
        [["state", "in", ["draft", "sent", "sale", "done"]]],
        ["state", "amount_total", "date_order", "opportunity_id"],
    )
    orders_by_lead: dict[int, list[dict]] = {}
    for order in orders:
        opp = order.get("opportunity_id")
        if isinstance(opp, (list, tuple)) and opp:
            orders_by_lead.setdefault(int(opp[0]), []).append(order)

    wanted = {stage.lower() for stage in stages}
    buckets: dict[tuple[str, str], dict[str, float]] = {}
    unmapped = 0

    for lead in leads:
        created = str(lead.get("create_date") or "")[:10]
        if len(created) < 7:
            continue
        month = created[:7]
        blob = " ".join(
            _label(lead.get(key)) for key in ("source_id", "medium_id", "campaign_id", "name")
        )
        channel = _channel_for(blob, mappings)
        if not channel:
            unmapped += 1
            continue
        slot = buckets.setdefault(
            (month, channel),
            {"qualified": 0, "whatsapp": 0, "quotes": 0, "orders_90d": 0, "revenue_90d": 0},
        )
        stage = _label(lead.get("stage_id")).lower()
        if stage in wanted or "qualified" in stage:
            slot["qualified"] += 1
        if "whatsapp" in blob.lower():
            slot["whatsapp"] += 1
        created_dt = datetime.strptime(created, "%Y-%m-%d")
        for order in orders_by_lead.get(int(lead["id"]), []):
            state = order.get("state")
            if state in {"draft", "sent"}:
                slot["quotes"] += 1
            if state in {"sale", "done"}:
                ordered = str(order.get("date_order") or "")[:10]
                if ordered:
                    ordered_dt = datetime.strptime(ordered, "%Y-%m-%d")
                    if 0 <= (ordered_dt - created_dt).days <= 90:
                        slot["orders_90d"] += 1
                        slot["revenue_90d"] += float(order.get("amount_total") or 0)

    rows = [
        {
            "_id": f"{month}:{channel}",
            "month": month,
            "channel": channel,
            **values,
            "source": "odoo",
        }
        for (month, channel), values in buckets.items()
    ]
    return {
        "state": "ok",
        "detail": f"{len(leads)} leads read. {unmapped} unmapped.",
        "rows": rows,
        "unmapped": unmapped,
    }
