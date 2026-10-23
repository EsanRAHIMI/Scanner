"""Admin follow-ups for sources that are down. Wording stays plain; raw API bodies never leave here."""

from __future__ import annotations

import asyncio
from typing import Any

from .db import require_db

_SITE = {
    "odoo": "Odoo CRM",
    "reviews": "Google Reviews",
    "search": "Search Console",
    "ga4": "GA4",
    "gtm": "Tag Manager",
}


def human_notice(source: str, detail: str, state: str = "error") -> str:
    name = source.strip() or "This source"
    text = (detail or "").lower()
    if name == "Odoo CRM" and state in ("unconfigured", "error"):
        return "Odoo is disconnected. Quotes and paid orders stay empty until it is connected."
    if "pinterest" in name.lower() and ("authentication failed" in text or "rejected this token" in text or "401" in text):
        return "Pinterest rejected the token. Create a new one from the user that owns the ad account."
    if "tiktok" in name.lower() and ("scope" in text or "reauthorize" in text):
        return "TikTok cannot read campaigns. Reconnect TikTok so the token includes campaign access."
    if "google ads" in name.lower() and ("invalid argument" in text or "invalid_argument" in text):
        return "Google Ads refused the campaign request. Check the customer id and developer token."
    if "insufficient authentication scopes" in text or "lacks the required scope" in text or "access_token_scope" in text:
        return f"{name} is missing permission. Reconnect it, or enable the API if Google asks for that."
    if "has not been used" in text or "service_disabled" in text or "it is disabled" in text:
        return f"{name} API is turned off in Google Cloud. Enable it, then sync again."
    if state == "unconfigured" or "not set" in text or "not connected" in text:
        return f"{name} is not connected."
    if "authentication failed" in text or "rejected" in text or " 401" in text or text.startswith("401"):
        return f"{name} rejected the token. Create it again from the account that owns this source."
    return f"{name} could not be read. Open Connections and fix this source."


def _item(kind: str, source: str, detail: str, state: str) -> dict[str, str]:
    return {
        "id": f"{kind}:{source}",
        "source": source,
        "message": human_notice(source, detail, state),
        "href": "/connections",
    }


async def list_notices() -> list[dict[str, str]]:
    database = require_db()
    connectors, site, paid = await asyncio.gather(
        database["marketing_os_connectors"].find({}).to_list(30),
        database["marketing_os_site"].find_one({"_id": "current"}),
        database["marketing_os_paid_errors"].find({}).to_list(20),
    )
    items: list[dict[str, str]] = []
    seen: set[str] = set()

    def add(kind: str, source: str, detail: str, state: str) -> None:
        key = source.casefold()
        if not source or key in seen:
            return
        seen.add(key)
        items.append(_item(kind, source, detail, state))

    for row in connectors:
        state = str(row.get("state") or "")
        if state not in ("error", "unconfigured"):
            continue
        add("connector", str(row.get("name") or row.get("_id") or ""), str(row.get("detail") or ""), state)

    site = site or {}
    for key, label in _SITE.items():
        block: Any = site.get(key) or {}
        if not isinstance(block, dict):
            continue
        state = str(block.get("state") or "")
        if state not in ("error", "unconfigured"):
            continue
        add("site", label, str(block.get("detail") or ""), state)

    for row in paid:
        platform = str(row.get("platform") or row.get("_id") or "")
        add("campaigns", f"{platform} campaigns", str(row.get("detail") or ""), "error")

    return items
