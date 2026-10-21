"""Campaign-level paid media rows. Account MTD totals stay in connectors.py."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any

import httpx

from .config import Settings, get_settings
from .connectors import (
    _google_token,
    _month_bounds,
    _num,
    _snapchat_token,
    _to_aed,
    snapchat_account,
    snapchat_window,
    tiktok_credentials,
    tiktok_currency,
    tiktok_report_metrics,
)
from .db import require_db
from .store import settings_doc

log = logging.getLogger("uvicorn.error")

PLATFORMS = ("Meta", "Google Ads", "LinkedIn", "Pinterest", "TikTok", "Snapchat")


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _day(raw: Any) -> str | None:
    if raw in (None, ""):
        return None
    text = str(raw).strip()
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return text[:10]
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return None


def _row(
    platform: str,
    campaign_id: str,
    *,
    name: str,
    status: str | None = None,
    start: str | None = None,
    end: str | None = None,
    spend: float | None = None,
    budget: float | None = None,
    impressions: float | None = None,
    clicks: float | None = None,
    leads: float | None = None,
    period: str | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    return {
        "_id": f"{platform}:{campaign_id}",
        "platform": platform,
        "campaign_id": str(campaign_id),
        "name": name,
        "status": status,
        "start_date": start,
        "end_date": end,
        "spend": spend,
        "budget": budget,
        "impressions": impressions,
        "clicks": clicks,
        "leads": leads,
        "period": period,
        "error": error,
        "synced_at": _iso(),
    }


async def _meta(client: httpx.AsyncClient, settings: Settings, day: date) -> list[dict[str, Any]]:
    if not settings.meta_access_token:
        return []
    start, end, month = _month_bounds(day)
    account = settings.meta_ad_account_id.removeprefix("act_")
    token = settings.meta_access_token
    version = settings.meta_graph_version
    campaigns: dict[str, dict[str, Any]] = {}
    url = f"https://graph.facebook.com/{version}/act_{account}/campaigns"
    params: dict[str, Any] = {
        "access_token": token,
        "fields": "id,name,status,effective_status,start_time,stop_time,daily_budget,lifetime_budget",
        "limit": 200,
    }
    while url:
        res = await client.get(url, params=params, timeout=30)
        if res.status_code >= 400:
            raise RuntimeError(f"Meta campaigns {res.status_code}: {res.text[:180]}")
        body = res.json()
        for item in body.get("data") or []:
            cid = str(item.get("id") or "")
            if not cid:
                continue
            daily = _num(item.get("daily_budget"))
            life = _num(item.get("lifetime_budget"))
            budget = (life / 100 if life is not None else None) or (daily / 100 if daily is not None else None)
            campaigns[cid] = _row(
                "Meta",
                cid,
                name=str(item.get("name") or cid),
                status=str(item.get("effective_status") or item.get("status") or "") or None,
                start=_day(item.get("start_time")),
                end=_day(item.get("stop_time")),
                budget=budget,
                period=month,
            )
        url = ((body.get("paging") or {}).get("next")) or ""
        params = {}
    insights = await client.get(
        f"https://graph.facebook.com/{version}/act_{account}/insights",
        params={
            "access_token": token,
            "level": "campaign",
            "time_range": f'{{"since":"{start}","until":"{end}"}}',
            "fields": "campaign_id,campaign_name,spend,impressions,clicks,actions",
            "limit": 200,
        },
        timeout=30,
    )
    if insights.status_code >= 400:
        raise RuntimeError(f"Meta campaign insights {insights.status_code}: {insights.text[:180]}")
    for item in insights.json().get("data") or []:
        cid = str(item.get("campaign_id") or "")
        if not cid:
            continue
        row = campaigns.get(cid) or _row("Meta", cid, name=str(item.get("campaign_name") or cid), period=month)
        row["spend"] = _num(item.get("spend"))
        row["impressions"] = _num(item.get("impressions"))
        row["clicks"] = _num(item.get("clicks"))
        leads = None
        for action in item.get("actions") or []:
            if action.get("action_type") in {
                "onsite_conversion.messaging_conversation_started_7d",
                "messaging_conversation_started_7d",
                "lead",
            }:
                leads = _num(action.get("value"))
                break
        row["leads"] = leads
        campaigns[cid] = row
    return list(campaigns.values())


async def _google(client: httpx.AsyncClient, settings: Settings, day: date, token: str | None) -> list[dict[str, Any]]:
    if not token:
        return []
    start, end, month = _month_bounds(day)
    customer = settings.google_ads_customer_id.replace("-", "")
    query = (
        "SELECT campaign.id, campaign.name, campaign.status, campaign.start_date, campaign.end_date, "
        "metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions "
        "FROM campaign "
        f"WHERE segments.date BETWEEN '{start}' AND '{end}'"
    )
    headers = {"Authorization": f"Bearer {token}"}
    if settings.google_ads_developer_token:
        headers["developer-token"] = settings.google_ads_developer_token
    if settings.google_ads_login_customer_id:
        headers["login-customer-id"] = settings.google_ads_login_customer_id.replace("-", "")
    res = await client.post(
        f"https://googleads.googleapis.com/v25/customers/{customer}/googleAds:search",
        headers=headers,
        json={"query": query},
        timeout=30,
    )
    if res.status_code >= 400:
        raise RuntimeError(f"Google Ads campaigns {res.status_code}: {res.text[:180]}")
    out: dict[str, dict[str, Any]] = {}
    for item in res.json().get("results") or []:
        campaign = item.get("campaign") or {}
        metrics = item.get("metrics") or {}
        cid = str(campaign.get("id") or "")
        if not cid:
            continue
        row = out.get(cid) or _row(
            "Google Ads",
            cid,
            name=str(campaign.get("name") or cid),
            status=str(campaign.get("status") or "") or None,
            start=_day(campaign.get("startDate") or campaign.get("start_date")),
            end=_day(campaign.get("endDate") or campaign.get("end_date")),
            period=month,
        )
        cost = _num(metrics.get("costMicros") or metrics.get("cost_micros"))
        if cost is not None:
            row["spend"] = (row.get("spend") or 0) + cost / 1_000_000
        for key, field in (("impressions", "impressions"), ("clicks", "clicks"), ("conversions", "leads")):
            value = _num(metrics.get(key))
            if value is not None:
                row[field] = (row.get(field) or 0) + value
        out[cid] = row
    return list(out.values())


async def _linkedin(client: httpx.AsyncClient, settings: Settings, day: date) -> list[dict[str, Any]]:
    if not settings.linkedin_access_token:
        return []
    start, end, month = _month_bounds(day)
    start_parts = start.split("-")
    end_parts = end.split("-")
    headers = {
        "Authorization": f"Bearer {settings.linkedin_access_token}",
        "LinkedIn-Version": "202511",
        "X-Restli-Protocol-Version": "2.0.0",
    }
    res = await client.get(
        (
            "https://api.linkedin.com/rest/adAnalytics?q=analytics&pivot=CAMPAIGN&timeGranularity=ALL"
            f"&dateRange=(start:(year:{start_parts[0]},month:{int(start_parts[1])},day:{int(start_parts[2])}),"
            f"end:(year:{end_parts[0]},month:{int(end_parts[1])},day:{int(end_parts[2])}))"
            f"&accounts=List(urn%3Ali%3AsponsoredAccount%3A{settings.linkedin_ad_account_id})"
            "&fields=pivotValues,costInLocalCurrency,impressions,clicks,externalWebsiteConversions"
        ),
        headers=headers,
        timeout=30,
    )
    if res.status_code >= 400:
        raise RuntimeError(f"LinkedIn campaigns {res.status_code}: {res.text[:180]}")
    rows = []
    for item in res.json().get("elements") or []:
        pivots = item.get("pivotValues") or []
        urn = str(pivots[0] if pivots else "")
        cid = urn.rsplit(":", 1)[-1] or urn
        if not cid:
            continue
        rows.append(
            _row(
                "LinkedIn",
                cid,
                name=cid,
                spend=_num(item.get("costInLocalCurrency")),
                impressions=_num(item.get("impressions")),
                clicks=_num(item.get("clicks")),
                leads=_num(item.get("externalWebsiteConversions")),
                period=month,
            )
        )
    return rows


async def _pinterest(client: httpx.AsyncClient, settings: Settings, day: date, fx: float) -> list[dict[str, Any]]:
    if not settings.pinterest_access_token:
        return []
    start, end, month = _month_bounds(day)
    headers = {"Authorization": f"Bearer {settings.pinterest_access_token}"}
    listed = await client.get(
        f"https://api.pinterest.com/v5/ad_accounts/{settings.pinterest_ad_account_id}/campaigns",
        headers=headers,
        params={"page_size": 100},
        timeout=30,
    )
    if listed.status_code >= 400:
        raise RuntimeError(f"Pinterest campaigns {listed.status_code}: {listed.text[:180]}")
    campaigns: dict[str, dict[str, Any]] = {}
    for item in listed.json().get("items") or []:
        cid = str(item.get("id") or "")
        if not cid:
            continue
        campaigns[cid] = _row(
            "Pinterest",
            cid,
            name=str(item.get("name") or cid),
            status=str(item.get("status") or "") or None,
            start=_day(item.get("start_time")),
            end=_day(item.get("end_time")),
            period=month,
        )
    analytics = await client.get(
        f"https://api.pinterest.com/v5/ad_accounts/{settings.pinterest_ad_account_id}/campaigns/analytics",
        headers=headers,
        params={
            "start_date": start,
            "end_date": end,
            "granularity": "TOTAL",
            "columns": "SPEND_IN_DOLLAR,PAID_IMPRESSION,CLICKTHROUGH_1,TOTAL_CONVERSIONS",
            "campaign_ids": ",".join(list(campaigns)[:100]),
        },
        timeout=30,
    )
    if analytics.status_code < 400:
        body = analytics.json()
        for item in body if isinstance(body, list) else []:
            cid = str(item.get("CAMPAIGN_ID") or item.get("campaign_id") or "")
            if not cid:
                continue
            row = campaigns.get(cid) or _row("Pinterest", cid, name=cid, period=month)
            usd = _num(item.get("SPEND_IN_DOLLAR"))
            spend, _note = _to_aed(usd, "USD", fx)
            row["spend"] = spend
            row["impressions"] = _num(item.get("PAID_IMPRESSION"))
            row["clicks"] = _num(item.get("CLICKTHROUGH_1"))
            row["leads"] = _num(item.get("TOTAL_CONVERSIONS"))
            campaigns[cid] = row
    return list(campaigns.values())


async def _tiktok(client: httpx.AsyncClient, settings: Settings, day: date, fx: float) -> list[dict[str, Any]]:
    token, advertiser_id = await tiktok_credentials(settings)
    if not token or not advertiser_id:
        return []
    start, end, month = _month_bounds(day)
    headers = {"Access-Token": token}
    listed = await client.get(
        "https://business-api.tiktok.com/open_api/v1.3/campaign/get/",
        headers=headers,
        params={"advertiser_id": advertiser_id, "page_size": 100},
        timeout=30,
    )
    if listed.status_code >= 400:
        raise RuntimeError(f"TikTok campaigns {listed.status_code}: {listed.text[:180]}")
    listed_body = listed.json()
    if listed_body.get("code") not in (0, "0", None):
        raise RuntimeError(f"TikTok campaigns: {listed_body.get('message') or listed_body.get('code')}")
    campaigns: dict[str, dict[str, Any]] = {}
    for item in ((listed_body.get("data") or {}).get("list") or []):
        cid = str(item.get("campaign_id") or "")
        if not cid:
            continue
        campaigns[cid] = _row(
            "TikTok",
            cid,
            name=str(item.get("campaign_name") or cid),
            status=str(item.get("status") or item.get("operation_status") or "") or None,
            start=_day(item.get("create_time")),
            period=month,
        )
    report = await client.get(
        "https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/",
        headers=headers,
        params={
            "advertiser_id": advertiser_id,
            "service_type": "AUCTION",
            "report_type": "BASIC",
            "data_level": "AUCTION_CAMPAIGN",
            "dimensions": '["campaign_id"]',
            "metrics": '["campaign_name","spend","impressions","clicks","conversion"]',
            "start_date": start,
            "end_date": end,
            "page": 1,
            "page_size": 100,
        },
        timeout=30,
    )
    if report.status_code >= 400:
        raise RuntimeError(f"TikTok campaign report {report.status_code}: {report.text[:180]}")
    info = await client.get(
        "https://business-api.tiktok.com/open_api/v1.3/advertiser/info/",
        headers=headers,
        params={"advertiser_ids": f'["{advertiser_id}"]'},
        timeout=30,
    )
    currency = tiktok_currency(info.json()) if info.status_code < 400 else None
    for item in ((report.json().get("data") or {}).get("list") or []):
        dims = item.get("dimensions") or {}
        metrics = tiktok_report_metrics({"data": {"list": [item]}}) or (item.get("metrics") or {})
        cid = str(dims.get("campaign_id") or "")
        if not cid:
            continue
        row = campaigns.get(cid) or _row("TikTok", cid, name=str(metrics.get("campaign_name") or cid), period=month)
        if metrics.get("campaign_name"):
            row["name"] = str(metrics["campaign_name"])
        spend, _note = _to_aed(_num(metrics.get("spend")), currency, fx)
        row["spend"] = spend
        row["impressions"] = _num(metrics.get("impressions"))
        row["clicks"] = _num(metrics.get("clicks"))
        row["leads"] = _num(metrics.get("conversion"))
        campaigns[cid] = row
    return list(campaigns.values())


async def _snapchat(client: httpx.AsyncClient, settings: Settings, day: date, fx: float) -> list[dict[str, Any]]:
    if not (
        settings.snapchat_client_id
        and settings.snapchat_client_secret
        and settings.snapchat_refresh_token
        and settings.snapchat_ad_account_id
    ):
        return []
    _start, _end, month = _month_bounds(day)
    token = await _snapchat_token(client, settings)
    headers = {"Authorization": f"Bearer {token}"}
    account_id = settings.snapchat_ad_account_id.strip()
    listed = await client.get(
        f"https://adsapi.snapchat.com/v1/adaccounts/{account_id}/campaigns",
        headers=headers,
        timeout=30,
    )
    if listed.status_code >= 400:
        raise RuntimeError(f"Snapchat campaigns {listed.status_code}: {listed.text[:180]}")
    campaigns: dict[str, dict[str, Any]] = {}
    for item in listed.json().get("campaigns") or []:
        block = item.get("campaign") if isinstance(item.get("campaign"), dict) else item
        cid = str(block.get("id") or "")
        if not cid:
            continue
        campaigns[cid] = _row(
            "Snapchat",
            cid,
            name=str(block.get("name") or cid),
            status=str(block.get("status") or "") or None,
            start=_day(block.get("start_time")),
            end=_day(block.get("end_time")),
            period=month,
        )
    account_res = await client.get(f"https://adsapi.snapchat.com/v1/adaccounts/{account_id}", headers=headers, timeout=30)
    account = snapchat_account(account_res.json()) if account_res.status_code < 400 else {}
    window_start, window_end = snapchat_window(day, account.get("timezone") if isinstance(account.get("timezone"), str) else None)
    stats_res = await client.get(
        f"https://adsapi.snapchat.com/v1/adaccounts/{account_id}/stats",
        headers=headers,
        params={
            "granularity": "TOTAL",
            "start_time": window_start,
            "end_time": window_end,
            "fields": "impressions,swipes,spend,conversion_purchases",
            "breakdown": "campaign",
        },
        timeout=30,
    )
    if stats_res.status_code >= 400:
        raise RuntimeError(f"Snapchat campaign stats {stats_res.status_code}: {stats_res.text[:180]}")
    body = stats_res.json()
    rows = body.get("total_stats") or []
    block = rows[0].get("total_stat") if rows and isinstance(rows[0], dict) else {}
    currency = account.get("currency") if isinstance(account.get("currency"), str) else None
    for campaign in ((block.get("breakdown_stats") or {}).get("campaign") or []):
        cid = str(campaign.get("id") or campaign.get("campaign_id") or "")
        stats = campaign.get("stats") or {}
        if not cid:
            continue
        row = campaigns.get(cid) or _row("Snapchat", cid, name=cid, period=month)
        micros = _num(stats.get("spend"))
        spend, _note = _to_aed((micros / 1_000_000) if micros is not None else None, currency, fx)
        row["spend"] = spend
        row["impressions"] = _num(stats.get("impressions"))
        row["clicks"] = _num(stats.get("swipes"))
        row["leads"] = _num(stats.get("conversion_purchases"))
        campaigns[cid] = row
    return list(campaigns.values())


async def sync_paid_campaigns(day: date | None = None) -> dict[str, Any]:
    """Write campaign-level rows. Failures are stored per platform and never invent totals."""
    database = require_db()
    settings = get_settings()
    day = day or date.today()
    fx = float((await settings_doc()).get("fx_usd_aed") or 3.6725)
    errors: list[dict[str, str]] = []
    written = 0
    async with httpx.AsyncClient() as client:
        token = None
        try:
            token = await _google_token(client, settings)
        except Exception as exc:  # noqa: BLE001
            errors.append({"platform": "Google Ads", "detail": str(exc)})
        jobs = (
            ("Meta", _meta(client, settings, day)),
            ("Google Ads", _google(client, settings, day, token)),
            ("LinkedIn", _linkedin(client, settings, day)),
            ("Pinterest", _pinterest(client, settings, day, fx)),
            ("TikTok", _tiktok(client, settings, day, fx)),
            ("Snapchat", _snapchat(client, settings, day, fx)),
        )
        for platform, coro in jobs:
            try:
                rows = await coro
            except Exception as exc:  # noqa: BLE001
                log.warning("paid campaign sync failed for %s: %s", platform, exc)
                errors.append({"platform": platform, "detail": str(exc)[:240]})
                await database["marketing_os_paid_errors"].replace_one(
                    {"_id": platform},
                    {"_id": platform, "platform": platform, "detail": str(exc)[:240], "synced_at": _iso()},
                    upsert=True,
                )
                continue
            await database["marketing_os_paid_errors"].delete_one({"_id": platform})
            for row in rows:
                await database["marketing_os_paid_campaigns"].replace_one({"_id": row["_id"]}, row, upsert=True)
                written += 1
    return {"written": written, "errors": errors}


async def list_paid_campaigns() -> list[dict[str, Any]]:
    database = require_db()
    rows = await database["marketing_os_paid_campaigns"].find({}).to_list(length=2000)
    for row in rows:
        row["id"] = str(row.get("_id"))
    return rows


async def list_paid_errors() -> list[dict[str, str]]:
    database = require_db()
    rows = await database["marketing_os_paid_errors"].find({}).to_list(length=20)
    return [{"platform": str(row.get("platform") or row.get("_id")), "detail": str(row.get("detail") or "")} for row in rows]
