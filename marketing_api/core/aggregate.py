from __future__ import annotations

from datetime import date, datetime
from typing import Any

from .seed import CHANNELS


def _num(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


def sum_known(values: list[float | None]) -> float | None:
    known = [v for v in values if v is not None]
    if not known:
        return None
    return float(sum(known))


def _age_days(iso: str | None, today: date) -> int | None:
    if not iso:
        return None
    try:
        day = datetime.strptime(iso[:10], "%Y-%m-%d").date()
    except ValueError:
        return None
    return (today - day).days


def _latest_mtd(records: list[dict], month: str, channel: str) -> dict | None:
    rows = [
        r
        for r in records
        if r.get("channel") == channel
        and r.get("record_type") == "Monthly MTD"
        and str(r.get("period_start") or "").startswith(month)
    ]
    if not rows:
        return None
    rows.sort(key=lambda r: (str(r.get("snapshot_date") or ""), str(r.get("verified_on") or "")))
    return rows[-1]


def build_dashboard(
    *,
    month: str,
    records: list[dict],
    budgets: list[dict],
    statuses: list[dict],
    targets: list[dict],
    crm_rows: list[dict],
    trend: list[dict],
    site: dict,
    connectors: list[dict],
    fx: float,
    today: date | None = None,
) -> dict[str, Any]:
    today = today or date.today()
    budget_by = {(b["month"], b["channel"]): b for b in budgets}
    status_by = {s["channel"]: s for s in statuses}
    crm_by = {(c["month"], c["channel"]): c for c in crm_rows}

    channels = []
    for channel in CHANNELS:
        mtd = _latest_mtd(records, month, channel) or {}
        budget = budget_by.get((month, channel)) or {}
        status = status_by.get(channel) or {}
        crm = crm_by.get((month, channel)) or {}
        spend = _num(mtd.get("spend"))
        budget_aed = _num(budget.get("budget_aed"))
        remaining = None
        utilization = None
        if spend is not None and budget_aed is not None:
            remaining = budget_aed - spend
            if budget_aed > 0:
                utilization = spend / budget_aed
        checked = status.get("checked_on") or mtd.get("verified_on")
        channels.append(
            {
                "channel": channel,
                "status": status.get("status") or mtd.get("status") or "Unknown",
                "delivery": status.get("delivery"),
                "issue": status.get("issue") or mtd.get("notes"),
                "next_action": status.get("next_action"),
                "spend": spend,
                "budget": budget_aed,
                "remaining": remaining,
                "utilization": utilization,
                "approval": budget.get("approval"),
                "impressions": _num(mtd.get("impressions")),
                "clicks": _num(mtd.get("clicks")),
                "raw_results": _num(mtd.get("raw_results")),
                "ctr": _num(mtd.get("ctr")),
                "qualified": _num(crm.get("qualified")),
                "whatsapp": _num(crm.get("whatsapp")),
                "quotes": _num(crm.get("quotes")),
                "orders_90d": _num(crm.get("orders_90d")),
                "revenue_90d": _num(crm.get("revenue_90d")),
                "checked_on": checked,
                "age_days": _age_days(checked, today),
                "partial": mtd.get("notes"),
            }
        )

    alerts: list[dict[str, str]] = []
    for row in channels:
        if row["utilization"] is not None and row["utilization"] > 1:
            alerts.append(
                {
                    "level": "high",
                    "text": f"{row['channel']} is over budget ({round(row['utilization'] * 100)}%).",
                }
            )
        if row["age_days"] is not None and row["age_days"] > 7:
            alerts.append(
                {
                    "level": "medium",
                    "text": f"{row['channel']} was last checked {row['age_days']} days ago.",
                }
            )
        if row["status"] == "Draft":
            alerts.append({"level": "medium", "text": f"{row['channel']} is still a draft. Spend is unknown."})
        if row["qualified"] is None and row["status"] == "Active":
            alerts.append(
                {
                    "level": "medium",
                    "text": f"{row['channel']} has no qualified-lead count. Do not raise the budget on raw results.",
                }
            )
    for connector in connectors:
        if connector.get("state") == "error":
            alerts.append(
                {"level": "high", "text": f"{connector['name']} sync failed: {connector.get('detail') or 'error'}"}
            )
    unmapped = int((site or {}).get("unmapped_leads") or 0)
    if unmapped:
        alerts.append(
            {
                "level": "medium",
                "text": f"{unmapped} Odoo leads have no channel mapping and are excluded from channel KPIs.",
            }
        )

    months = sorted({str(t.get("month")) for t in trend if t.get("month")})
    for row in records:
        start = str(row.get("period_start") or "")
        if len(start) >= 7 and row.get("record_type") == "Monthly MTD":
            months.append(start[:7])
    months = sorted(set(months))

    return {
        "month": month,
        "currency": "AED",
        "fx_usd_aed": fx,
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "spend": sum_known([c["spend"] for c in channels]),
        "budget": sum_known([c["budget"] for c in channels]),
        "qualified": sum_known([c["qualified"] for c in channels]),
        "quotes": sum_known([c["quotes"] for c in channels]),
        "orders_90d": sum_known([c["orders_90d"] for c in channels]),
        "revenue_90d": sum_known([c["revenue_90d"] for c in channels]),
        "channels": channels,
        "trend": [
            {
                "month": t.get("month"),
                "spend": _num(t.get("spend")),
                "impressions": _num(t.get("impressions")),
                "clicks": _num(t.get("clicks")),
                "raw_results": _num(t.get("raw_results")),
                "ctr": _num(t.get("ctr")),
            }
            for t in sorted(trend, key=lambda item: str(item.get("month") or ""))
        ],
        "months": months,
        "targets": [
            {
                "channel": t.get("channel"),
                "metric": t.get("metric"),
                "target": t.get("target"),
                "direction": t.get("direction"),
                "unit": t.get("unit"),
            }
            for t in targets
        ],
        "site": site or {},
        "connectors": connectors,
        "alerts": alerts,
    }
