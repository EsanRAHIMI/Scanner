"""Numbers taken from the October 2026 workbook. Empty stays null — never zero."""

from __future__ import annotations

CHANNELS = ["Meta", "Google Ads", "LinkedIn", "Pinterest", "TikTok", "Snapchat"]

DEFAULT_SETTINGS = {
    "_id": "current",
    "fx_usd_aed": 3.6725,
    "fx_source": "https://centralbank.ae/en/our-operations/monetary-policy-and-domestic-markets/domestic-market-operations/",
    "selected_month": "2026-09",
    "mappings": [
        {"contains": "meta", "channel": "Meta"},
        {"contains": "facebook", "channel": "Meta"},
        {"contains": "instagram", "channel": "Meta"},
        {"contains": "whatsapp", "channel": "Meta"},
        {"contains": "google", "channel": "Google Ads"},
        {"contains": "linkedin", "channel": "LinkedIn"},
        {"contains": "pinterest", "channel": "Pinterest"},
        {"contains": "tiktok", "channel": "TikTok"},
        {"contains": "snapchat", "channel": "Snapchat"},
    ],
    "qualified_stages": ["Qualified", "Proposition", "Won"],
    "workbook_imported": False,
}

# month, channel, budget_aed, approval
_BUDGET_PATTERN = [
    ("Meta", 1836.25),
    ("Google Ads", 734.50),
    ("LinkedIn", 2938.00),
    ("Pinterest", 1836.25),
    ("TikTok", None),
    ("Snapchat", None),
]


def budget_rows() -> list[dict]:
    rows = []
    for month_i in range(1, 13):
        month = f"2026-{month_i:02d}"
        for channel, amount in _BUDGET_PATTERN:
            approval = "Draft" if amount is None else "Proposed"
            note = "No budget set yet." if amount is None else "Default monthly budget copied from Aug 2026."
            value = amount
            if month == "2026-10" and channel == "LinkedIn":
                approval = "Approved"
                value = 3000.0
                note = "Approved about AED 3000 for October. Delivery start was not confirmed on 2 Oct 2026."
            elif month == "2026-10" and channel == "Pinterest":
                approval = "Approved"
                note = "Approved range AED 1836–2000. Draft only — billing and geography were not finished."
            rows.append(
                {
                    "_id": f"{month}:{channel}",
                    "month": month,
                    "channel": channel,
                    "budget_aed": value,
                    "approval": approval,
                    "note": note,
                }
            )
    return rows


def mtd_records() -> list[dict]:
    """Latest monthly totals the dashboard is allowed to sum."""
    specs = [
        ("2026-09", "Meta", "2026-09-30", 806.31, 176907, 2926, 24, 0.01653976383, "Active", "2026-10-01", "Latest MTD. Conversations, not unique qualified leads."),
        ("2026-09", "Google Ads", "2026-09-30", 1057.61, 20318, 718, 19, 0.03533812383, "Active", "2026-10-01", "Google tag missing. 19 tracked conversions are not CRM-verified."),
        ("2026-09", "LinkedIn", "2026-09-30", 190.03, 6213, 30, 0, 0.004828585225, "Active", "2026-10-01", "0 form leads after a full-month check."),
        ("2026-10", "Meta", "2026-10-01", 33.31, 627, 1, 0, 0.001595, "Active", "2026-10-01", "Partial day."),
        ("2026-10", "Google Ads", "2026-10-01", 22.81, 53, 4, 0, 0.0755, "Active", "2026-10-01", "Partial day."),
        ("2026-10", "LinkedIn", "2026-10-01", 0, 0, 0, 0, None, "Active", "2026-10-02", "Checked. Delivery had not started."),
    ]
    rows = []
    for month, channel, snap, spend, impr, clicks, raw, ctr, status, verified, notes in specs:
        rows.append(
            {
                "_id": f"mtd:{channel}:{month}",
                "channel": channel,
                "snapshot_date": snap,
                "campaign": f"Monthly Total — {month}",
                "status": status,
                "spend": spend,
                "impressions": impr,
                "clicks": clicks,
                "raw_results": raw,
                "ctr": ctr,
                "record_type": "Monthly MTD",
                "period_start": f"{month}-01",
                "period_end": snap,
                "verified_on": verified,
                "notes": notes,
                "source": "workbook-seed",
            }
        )
    return rows


def trend_rows() -> list[dict]:
    specs = [
        ("2026-04", 1767.23, 513985, None, 134, None),
        ("2026-05", 2153.30, 431212, 6791, 73, 0.0157),
        ("2026-06", 429.54, 29276, 639, 0, 0.0218),
        ("2026-07", 1665.43, 386548, 3644, 9, 0.0094),
        ("2026-08", 5237.50, 830341, 5475, 3, 0.0066),
        ("2026-09", 2053.95, 203438, 3674, 43, 0.0181),
        ("2026-10", 56.12, 680, 5, 0, 0.0074),
    ]
    rows = []
    for month, spend, impr, clicks, raw, ctr in specs:
        rows.append(
            {
                "_id": f"trend:{month}",
                "month": month,
                "spend": spend,
                "impressions": impr,
                "clicks": clicks,
                "raw_results": raw,
                "ctr": ctr,
            }
        )
    return rows


def status_rows() -> list[dict]:
    return [
        {
            "_id": "Meta",
            "channel": "Meta",
            "checked_on": "2026-10-01",
            "status": "Active",
            "delivery": "Delivery recorded",
            "issue": "Conversation quality is not confirmed in CRM.",
            "next_action": "Record B2B role, project, and quotation.",
        },
        {
            "_id": "Google Ads",
            "channel": "Google Ads",
            "checked_on": "2026-10-01",
            "status": "Active",
            "delivery": "Delivery recorded",
            "issue": "Google tag is incomplete. Conversion quality is unknown.",
            "next_action": "Test tracking and review Search.",
        },
        {
            "_id": "LinkedIn",
            "channel": "LinkedIn",
            "checked_on": "2026-10-02",
            "status": "Active",
            "delivery": "Delivery start not confirmed",
            "issue": "Lead objective is saved. Form quality still needs a check.",
            "next_action": "Confirm the first delivery, then call to verify the project.",
        },
        {
            "_id": "Pinterest",
            "channel": "Pinterest",
            "checked_on": "2026-10-01",
            "status": "Draft",
            "delivery": "Not published",
            "issue": "Billing, market, and tracking are not ready.",
            "next_action": "Finish setup, then start the test.",
        },
        {
            "_id": "TikTok",
            "channel": "TikTok",
            "checked_on": None,
            "status": "Draft",
            "delivery": "Not connected",
            "issue": "The TikTok ad account is not connected yet.",
            "next_action": "Add the TikTok ads token, then record the first delivery.",
        },
        {
            "_id": "Snapchat",
            "channel": "Snapchat",
            "checked_on": None,
            "status": "Draft",
            "delivery": "Not connected",
            "issue": "The Snapchat ad account is not connected yet.",
            "next_action": "Add the Snapchat ads token, then record the first delivery.",
        },
    ]


def target_rows() -> list[dict]:
    specs = [
        ("Meta", "Qualified CPL", 100, "lte", "AED"),
        ("Meta", "WhatsApp / 30d", 60, "gte", "count"),
        ("Meta", "Quotes / 30d", 6, "gte", "count"),
        ("Meta", "Paid orders / 90d", 2, "gte", "count"),
        ("Google Ads", "Qualified CPL", 125, "lte", "AED"),
        ("Google Ads", "WhatsApp / 30d", 6, "gte", "count"),
        ("Google Ads", "Quotes / 30d", 3, "gte", "count"),
        ("Google Ads", "Paid orders / 90d", 1, "gte", "count"),
        ("Google Ads", "Search CPC", 5, "lte", "AED"),
        ("LinkedIn", "Qualified CPL", 500, "lte", "AED"),
        ("LinkedIn", "WhatsApp / 30d", 3, "gte", "count"),
        ("LinkedIn", "Quotes / 30d", 3, "gte", "count"),
        ("LinkedIn", "Paid orders / 90d", 1, "gte", "count"),
        ("Pinterest", "Qualified CPL", 650, "lte", "AED"),
        ("Pinterest", "WhatsApp / 30d", 3, "gte", "count"),
        ("Pinterest", "Quotes / 30d", 1, "gte", "count"),
        ("Pinterest", "Paid orders / 90d", 1, "gte", "count"),
        ("TikTok", "Qualified CPL", None, "lte", "AED"),
        ("TikTok", "WhatsApp / 30d", None, "gte", "count"),
        ("TikTok", "Quotes / 30d", None, "gte", "count"),
        ("TikTok", "Paid orders / 90d", None, "gte", "count"),
        ("Snapchat", "Qualified CPL", None, "lte", "AED"),
        ("Snapchat", "WhatsApp / 30d", None, "gte", "count"),
        ("Snapchat", "Quotes / 30d", None, "gte", "count"),
        ("Snapchat", "Paid orders / 90d", None, "gte", "count"),
        ("All", "First response", 15, "lte", "minutes"),
        ("All", "Source attribution", 0.9, "gte", "ratio"),
        ("All", "Review cadence", 7, "lte", "days"),
    ]
    rows = []
    for channel, metric, target, direction, unit in specs:
        rows.append(
            {
                "_id": f"{channel}:{metric}",
                "channel": channel,
                "metric": metric,
                "target": target,
                "direction": direction,
                "unit": unit,
                "status": "Proposed" if target is None else "Approved",
            }
        )
    return rows


def empty_site() -> dict:
    unknown = {"state": "unconfigured", "detail": "Credentials are not set.", "as_of": None}
    return {
        "_id": "current",
        "ga4": {**unknown, "sessions": None, "users": None},
        "search": {**unknown, "clicks": None, "impressions": None, "query": "lorenzo lighting"},
        "reviews": {**unknown, "rating": None, "count": None},
        "gtm": {**unknown},
    }
