from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any
from urllib.parse import quote
from zoneinfo import ZoneInfo

import httpx

from .config import Settings


def _month_bounds(day: date) -> tuple[str, str, str]:
    start = day.replace(day=1)
    return start.isoformat(), day.isoformat(), start.strftime("%Y-%m")


def _mtd(channel: str, month: str, end: str, **fields: Any) -> dict[str, Any]:
    return {
        "_id": f"live:{channel}:{month}:{end}",
        "channel": channel,
        "snapshot_date": end,
        "campaign": f"Monthly Total — {month}",
        "record_type": "Monthly MTD",
        "period_start": f"{month}-01",
        "period_end": end,
        "verified_on": end,
        "source": "live",
        **fields,
    }


async def _google_token(client: httpx.AsyncClient, settings: Settings) -> str | None:
    if not (
        settings.google_oauth_client_id
        and settings.google_oauth_client_secret
        and settings.google_oauth_refresh_token
    ):
        return None
    res = await client.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": settings.google_oauth_client_id,
            "client_secret": settings.google_oauth_client_secret,
            "refresh_token": settings.google_oauth_refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=20,
    )
    if res.status_code >= 400:
        raise RuntimeError(f"Google OAuth {res.status_code}")
    token = res.json().get("access_token")
    if not token:
        raise RuntimeError("Google OAuth returned no access token")
    return str(token)


async def sync_meta(client: httpx.AsyncClient, settings: Settings, day: date) -> dict[str, Any]:
    if not settings.meta_access_token:
        return {"name": "Meta", "state": "unconfigured", "detail": "META_ACCESS_TOKEN is not set."}
    start, end, month = _month_bounds(day)
    account = settings.meta_ad_account_id.removeprefix("act_")
    url = f"https://graph.facebook.com/{settings.meta_graph_version}/act_{account}/insights"
    res = await client.get(
        url,
        params={
            "access_token": settings.meta_access_token,
            "level": "account",
            "time_range": f'{{"since":"{start}","until":"{end}"}}',
            "fields": "spend,impressions,clicks,ctr,actions",
        },
        timeout=30,
    )
    if res.status_code >= 400:
        raise RuntimeError(f"Meta {res.status_code}: {res.text[:180]}")
    rows = res.json().get("data") or []
    row = rows[0] if rows else {}
    raw = None
    for action in row.get("actions") or []:
        if action.get("action_type") in {
            "onsite_conversion.messaging_conversation_started_7d",
            "messaging_conversation_started_7d",
        }:
            raw = float(action.get("value") or 0)
            break
    record = _mtd(
        "Meta",
        month,
        end,
        status="Active",
        spend=float(row["spend"]) if row.get("spend") is not None else None,
        impressions=float(row["impressions"]) if row.get("impressions") is not None else None,
        clicks=float(row["clicks"]) if row.get("clicks") is not None else None,
        ctr=(float(row["ctr"]) / 100) if row.get("ctr") is not None else None,
        raw_results=raw,
        notes="Live account insights. Raw result is messaging conversations when the API returns them.",
    )
    return {"name": "Meta", "state": "ok", "detail": f"Updated {month}.", "records": [record]}


async def sync_google_ads(client: httpx.AsyncClient, settings: Settings, day: date, token: str | None) -> dict[str, Any]:
    if not token or not settings.google_ads_developer_token:
        return {"name": "Google Ads", "state": "unconfigured", "detail": "Google Ads credentials are not set."}
    start, end, month = _month_bounds(day)
    customer = settings.google_ads_customer_id.replace("-", "")
    query = (
        "SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr, metrics.conversions "
        "FROM customer "
        f"WHERE segments.date BETWEEN '{start}' AND '{end}'"
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "developer-token": settings.google_ads_developer_token,
    }
    if settings.google_ads_login_customer_id:
        headers["login-customer-id"] = settings.google_ads_login_customer_id.replace("-", "")
    res = await client.post(
        f"https://googleads.googleapis.com/v18/customers/{customer}/googleAds:search",
        headers=headers,
        json={"query": query},
        timeout=30,
    )
    if res.status_code >= 400:
        raise RuntimeError(f"Google Ads {res.status_code}: {res.text[:180]}")
    spend = impr = clicks = conv = None
    for item in res.json().get("results") or []:
        metrics = item.get("metrics") or {}
        if metrics.get("costMicros") is not None:
            spend = (spend or 0) + float(metrics["costMicros"]) / 1_000_000
        if metrics.get("impressions") is not None:
            impr = (impr or 0) + float(metrics["impressions"])
        if metrics.get("clicks") is not None:
            clicks = (clicks or 0) + float(metrics["clicks"])
        if metrics.get("conversions") is not None:
            conv = (conv or 0) + float(metrics["conversions"])
    ctr = (clicks / impr) if clicks is not None and impr else None
    record = _mtd(
        "Google Ads",
        month,
        end,
        status="Active",
        spend=spend,
        impressions=impr,
        clicks=clicks,
        ctr=ctr,
        raw_results=conv,
        notes="Live account totals. Conversions are not treated as qualified leads.",
    )
    return {"name": "Google Ads", "state": "ok", "detail": f"Updated {month}.", "records": [record]}


async def sync_linkedin(client: httpx.AsyncClient, settings: Settings, day: date) -> dict[str, Any]:
    if not settings.linkedin_access_token:
        return {"name": "LinkedIn", "state": "unconfigured", "detail": "LINKEDIN_ACCESS_TOKEN is not set."}
    start, end, month = _month_bounds(day)
    start_parts = start.split("-")
    end_parts = end.split("-")
    res = await client.get(
        "https://api.linkedin.com/rest/adAnalytics",
        headers={
            "Authorization": f"Bearer {settings.linkedin_access_token}",
            "LinkedIn-Version": "202511",
            "X-Restli-Protocol-Version": "2.0.0",
        },
        params={
            "q": "analytics",
            "pivot": "ACCOUNT",
            "timeGranularity": "ALL",
            "dateRange": (
                f"(start:(year:{start_parts[0]},month:{int(start_parts[1])},day:{int(start_parts[2])}),"
                f"end:(year:{end_parts[0]},month:{int(end_parts[1])},day:{int(end_parts[2])}))"
            ),
            "accounts": f"List(urn:li:sponsoredAccount:{settings.linkedin_ad_account_id})",
            "fields": "costInLocalCurrency,impressions,clicks,externalWebsiteConversions",
        },
        timeout=30,
    )
    if res.status_code >= 400:
        raise RuntimeError(f"LinkedIn {res.status_code}: {res.text[:180]}")
    elements = res.json().get("elements") or []
    row = elements[0] if elements else {}
    record = _mtd(
        "LinkedIn",
        month,
        end,
        status="Active",
        spend=float(row["costInLocalCurrency"]) if row.get("costInLocalCurrency") is not None else None,
        impressions=float(row["impressions"]) if row.get("impressions") is not None else None,
        clicks=float(row["clicks"]) if row.get("clicks") is not None else None,
        raw_results=float(row["externalWebsiteConversions"]) if row.get("externalWebsiteConversions") is not None else None,
        notes="Live account analytics.",
    )
    return {"name": "LinkedIn", "state": "ok", "detail": f"Updated {month}.", "records": [record]}


async def sync_pinterest(client: httpx.AsyncClient, settings: Settings, day: date, fx: float) -> dict[str, Any]:
    if not settings.pinterest_access_token:
        return {"name": "Pinterest", "state": "unconfigured", "detail": "PINTEREST_ACCESS_TOKEN is not set."}
    start, end, month = _month_bounds(day)
    res = await client.get(
        f"https://api.pinterest.com/v5/ad_accounts/{settings.pinterest_ad_account_id}/analytics",
        headers={"Authorization": f"Bearer {settings.pinterest_access_token}"},
        params={
            "start_date": start,
            "end_date": end,
            "granularity": "TOTAL",
            "columns": "SPEND_IN_DOLLAR,IMPRESSION,CLICKTHROUGH,TOTAL_CONVERSIONS",
        },
        timeout=30,
    )
    if res.status_code >= 400:
        raise RuntimeError(f"Pinterest {res.status_code}: {res.text[:180]}")
    body = res.json()
    rows = body if isinstance(body, list) else []
    row = rows[0] if rows else {}
    usd = row.get("SPEND_IN_DOLLAR")
    impressions = float(row["IMPRESSION"]) if row.get("IMPRESSION") not in (None, "") else None
    delivered = usd not in (None, "", 0, "0") or (impressions or 0) > 0
    spend = round(float(usd) * fx, 2) if delivered and usd not in (None, "") else None
    record = _mtd(
        "Pinterest",
        month,
        end,
        status="Active" if delivered else "Draft",
        spend=spend,
        impressions=impressions,
        clicks=float(row["CLICKTHROUGH"]) if row.get("CLICKTHROUGH") not in (None, "") else None,
        raw_results=float(row["TOTAL_CONVERSIONS"]) if row.get("TOTAL_CONVERSIONS") not in (None, "") else None,
        notes="Live account analytics. Pinterest reports USD; spend is converted with the saved USD/AED rate. No delivery stays unknown.",
    )
    return {"name": "Pinterest", "state": "ok", "detail": f"Updated {month}.", "records": [record]}


def _num(value: Any) -> float | None:
    if value is None or value == "" or value == "-":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_aed(amount: float | None, currency: str | None, fx: float) -> tuple[float | None, str]:
    if amount is None:
        return None, ""
    code = (currency or "").strip().upper()
    if code == "AED":
        return round(amount, 2), "Spend is already in AED."
    if code == "USD":
        return round(amount * fx, 2), "Spend was USD and is converted with the saved USD/AED rate."
    if not code:
        return None, "Account currency was not returned, so spend was left blank."
    return None, f"Spend is in {code} and was left blank."


def _delivered(spend: float | None, impressions: float | None) -> bool:
    return (spend or 0) > 0 or (impressions or 0) > 0


def tiktok_report_metrics(body: dict[str, Any]) -> dict[str, Any]:
    code = body.get("code")
    if code not in (0, "0", None):
        message = body.get("message") or "TikTok report failed"
        raise RuntimeError(f"TikTok {code}: {message}")
    rows = ((body.get("data") or {}).get("list") or [])
    if not rows:
        return {}
    metrics = rows[0].get("metrics") if isinstance(rows[0], dict) else None
    return metrics if isinstance(metrics, dict) else {}


def tiktok_currency(body: dict[str, Any]) -> str | None:
    code = body.get("code")
    if code not in (0, "0", None):
        return None
    rows = ((body.get("data") or {}).get("list") or [])
    if not rows or not isinstance(rows[0], dict):
        return None
    currency = rows[0].get("currency")
    return str(currency) if currency else None


def snapchat_account(body: dict[str, Any]) -> dict[str, Any]:
    if body.get("request_status") not in (None, "SUCCESS"):
        raise RuntimeError(f"Snapchat account: {body.get('request_status') or 'ERROR'}")
    rows = body.get("adaccounts") or []
    if not rows or not isinstance(rows[0], dict):
        return {}
    account = rows[0].get("adaccount")
    return account if isinstance(account, dict) else {}


def snapchat_total_stats(body: dict[str, Any]) -> dict[str, Any]:
    if body.get("request_status") not in (None, "SUCCESS"):
        debug = body.get("debug_message") or body.get("request_status") or "ERROR"
        raise RuntimeError(f"Snapchat stats: {debug}")
    rows = body.get("total_stats") or []
    if not rows or not isinstance(rows[0], dict):
        return {}
    block = rows[0].get("total_stat") if isinstance(rows[0].get("total_stat"), dict) else rows[0]
    stats = block.get("stats") if isinstance(block, dict) else None
    return stats if isinstance(stats, dict) else {}


def _iso_offset(moment: datetime) -> str:
    raw = moment.strftime("%Y-%m-%dT%H:%M:%S.000%z")
    return raw[:-2] + ":" + raw[-2:]


def snapchat_window(day: date, timezone_name: str | None) -> tuple[str, str]:
    try:
        zone = ZoneInfo(timezone_name or "Asia/Dubai")
    except Exception:
        zone = ZoneInfo("Asia/Dubai")
    start = datetime(day.year, day.month, 1, tzinfo=zone)
    end = datetime(day.year, day.month, day.day, tzinfo=zone) + timedelta(days=1)
    return _iso_offset(start), _iso_offset(end)


async def sync_tiktok(client: httpx.AsyncClient, settings: Settings, day: date, fx: float) -> dict[str, Any]:
    if not settings.tiktok_access_token or not settings.tiktok_advertiser_id:
        return {"name": "TikTok", "state": "unconfigured", "detail": "TIKTOK_ACCESS_TOKEN is not set."}
    start, end, month = _month_bounds(day)
    headers = {"Access-Token": settings.tiktok_access_token}
    advertiser_id = settings.tiktok_advertiser_id.strip()
    info = await client.get(
        "https://business-api.tiktok.com/open_api/v1.3/advertiser/info/",
        headers=headers,
        params={"advertiser_ids": f'["{advertiser_id}"]'},
        timeout=30,
    )
    if info.status_code >= 400:
        raise RuntimeError(f"TikTok {info.status_code}: {info.text[:180]}")
    currency = tiktok_currency(info.json())
    report = await client.get(
        "https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/",
        headers=headers,
        params={
            "advertiser_id": advertiser_id,
            "service_type": "AUCTION",
            "report_type": "BASIC",
            "data_level": "AUCTION_ADVERTISER",
            "dimensions": '["advertiser_id"]',
            "metrics": '["spend","impressions","clicks","conversion"]',
            "start_date": start,
            "end_date": end,
            "page": 1,
            "page_size": 10,
        },
        timeout=30,
    )
    if report.status_code >= 400:
        raise RuntimeError(f"TikTok {report.status_code}: {report.text[:180]}")
    metrics = tiktok_report_metrics(report.json())
    impressions = _num(metrics.get("impressions"))
    clicks = _num(metrics.get("clicks"))
    raw_spend = _num(metrics.get("spend"))
    delivered = _delivered(raw_spend, impressions)
    spend, money_note = _to_aed(raw_spend if delivered else None, currency, fx)
    record = _mtd(
        "TikTok",
        month,
        end,
        status="Active" if delivered else "Draft",
        spend=spend,
        impressions=impressions if delivered else None,
        clicks=clicks if delivered else None,
        ctr=(clicks / impressions) if delivered and clicks is not None and impressions else None,
        raw_results=_num(metrics.get("conversion")) if delivered else None,
        notes=" ".join(
            part
            for part in (
                "Live advertiser report. Conversions are not treated as qualified leads.",
                money_note if delivered else "No delivery stays unknown.",
            )
            if part
        ),
    )
    return {"name": "TikTok", "state": "ok", "detail": f"Updated {month}.", "records": [record]}


async def _snapchat_token(client: httpx.AsyncClient, settings: Settings) -> str:
    res = await client.post(
        "https://accounts.snapchat.com/login/oauth2/access_token",
        data={
            "client_id": settings.snapchat_client_id,
            "client_secret": settings.snapchat_client_secret,
            "refresh_token": settings.snapchat_refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=20,
    )
    if res.status_code >= 400:
        raise RuntimeError(f"Snapchat OAuth {res.status_code}: {res.text[:180]}")
    token = res.json().get("access_token")
    if not token:
        raise RuntimeError("Snapchat OAuth returned no access token")
    return str(token)


async def sync_snapchat(client: httpx.AsyncClient, settings: Settings, day: date, fx: float) -> dict[str, Any]:
    if not (
        settings.snapchat_client_id
        and settings.snapchat_client_secret
        and settings.snapchat_refresh_token
        and settings.snapchat_ad_account_id
    ):
        return {"name": "Snapchat", "state": "unconfigured", "detail": "SNAPCHAT_REFRESH_TOKEN is not set."}
    _start, end, month = _month_bounds(day)
    token = await _snapchat_token(client, settings)
    headers = {"Authorization": f"Bearer {token}"}
    account_id = settings.snapchat_ad_account_id.strip()
    account_res = await client.get(
        f"https://adsapi.snapchat.com/v1/adaccounts/{account_id}",
        headers=headers,
        timeout=30,
    )
    if account_res.status_code >= 400:
        raise RuntimeError(f"Snapchat {account_res.status_code}: {account_res.text[:180]}")
    account = snapchat_account(account_res.json())
    window_start, window_end = snapchat_window(day, account.get("timezone") if isinstance(account.get("timezone"), str) else None)
    stats_res = await client.get(
        f"https://adsapi.snapchat.com/v1/adaccounts/{account_id}/stats",
        headers=headers,
        params={
            "granularity": "TOTAL",
            "start_time": window_start,
            "end_time": window_end,
            "fields": "impressions,swipes,spend,conversion_purchases",
        },
        timeout=30,
    )
    if stats_res.status_code >= 400:
        raise RuntimeError(f"Snapchat {stats_res.status_code}: {stats_res.text[:180]}")
    stats = snapchat_total_stats(stats_res.json())
    impressions = _num(stats.get("impressions"))
    swipes = _num(stats.get("swipes"))
    micros = _num(stats.get("spend"))
    raw_spend = (micros / 1_000_000) if micros is not None else None
    delivered = _delivered(raw_spend, impressions)
    spend, money_note = _to_aed(raw_spend if delivered else None, account.get("currency") if isinstance(account.get("currency"), str) else None, fx)
    record = _mtd(
        "Snapchat",
        month,
        end,
        status="Active" if delivered else "Draft",
        spend=spend,
        impressions=impressions if delivered else None,
        clicks=swipes if delivered else None,
        ctr=(swipes / impressions) if delivered and swipes is not None and impressions else None,
        raw_results=_num(stats.get("conversion_purchases")) if delivered else None,
        notes=" ".join(
            part
            for part in (
                "Live ad account stats. Swipes are stored as clicks. Purchases are not treated as qualified leads.",
                money_note if delivered else "No delivery stays unknown.",
            )
            if part
        ),
    )
    return {"name": "Snapchat", "state": "ok", "detail": f"Updated {month}.", "records": [record]}


async def sync_ga4(client: httpx.AsyncClient, settings: Settings, token: str | None, day: date) -> dict[str, Any]:
    if not token or not settings.ga4_property_id:
        return {"state": "unconfigured", "detail": "GA4 property or Google OAuth is not set.", "sessions": None, "users": None}
    start, end, _month = _month_bounds(day)
    res = await client.post(
        f"https://analyticsdata.googleapis.com/v1beta/properties/{settings.ga4_property_id}:runReport",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "dateRanges": [{"startDate": start, "endDate": end}],
            "metrics": [{"name": "sessions"}, {"name": "totalUsers"}],
        },
        timeout=30,
    )
    if res.status_code >= 400:
        raise RuntimeError(f"GA4 {res.status_code}: {res.text[:180]}")
    values = ((res.json().get("rows") or [{}])[0].get("metricValues") or [])
    sessions = float(values[0]["value"]) if len(values) > 0 and values[0].get("value") is not None else None
    users = float(values[1]["value"]) if len(values) > 1 and values[1].get("value") is not None else None
    return {"state": "ok", "detail": f"Updated through {end}.", "sessions": sessions, "users": users, "as_of": end}


async def sync_search(client: httpx.AsyncClient, settings: Settings, token: str | None, day: date) -> dict[str, Any]:
    if not token or not settings.gsc_site_url:
        return {"state": "unconfigured", "detail": "Search Console site or Google OAuth is not set.", "clicks": None, "impressions": None}
    start, end, _month = _month_bounds(day)
    site = quote(settings.gsc_site_url, safe="")
    res = await client.post(
        f"https://searchconsole.googleapis.com/webmasters/v3/sites/{site}/searchAnalytics/query",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "startDate": start,
            "endDate": end,
            "dimensions": ["query"],
            "dimensionFilterGroups": [
                {
                    "filters": [
                        {"dimension": "query", "operator": "contains", "expression": "lorenzo lighting"}
                    ]
                }
            ],
        },
        timeout=30,
    )
    if res.status_code >= 400:
        raise RuntimeError(f"Search Console {res.status_code}: {res.text[:180]}")
    clicks = impressions = 0.0
    found = False
    for row in res.json().get("rows") or []:
        found = True
        clicks += float(row.get("clicks") or 0)
        impressions += float(row.get("impressions") or 0)
    return {
        "state": "ok",
        "detail": f"Query contains “lorenzo lighting” through {end}.",
        "clicks": clicks if found else None,
        "impressions": impressions if found else None,
        "query": "lorenzo lighting",
        "as_of": end,
    }


async def sync_gtm(client: httpx.AsyncClient, settings: Settings, token: str | None) -> dict[str, Any]:
    if not token or not settings.gtm_container_path:
        return {"state": "unconfigured", "detail": "GTM container path or Google OAuth is not set."}
    res = await client.get(
        f"https://tagmanager.googleapis.com/tagmanager/v2/{settings.gtm_container_path}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    if res.status_code >= 400:
        raise RuntimeError(f"GTM {res.status_code}: {res.text[:180]}")
    body = res.json()
    name = body.get("name") or settings.gtm_container_path
    return {"state": "ok", "detail": f"Container {name} is reachable. GTM is a tag check, not a metrics source.", "as_of": date.today().isoformat()}


async def sync_reviews(client: httpx.AsyncClient, settings: Settings, token: str | None) -> dict[str, Any]:
    if not token or not settings.gbp_location_name:
        return {"state": "unconfigured", "detail": "Google Business location or OAuth is not set.", "rating": None, "count": None}
    res = await client.get(
        f"https://mybusiness.googleapis.com/v4/{settings.gbp_location_name}/reviews",
        headers={"Authorization": f"Bearer {token}"},
        params={"pageSize": 1},
        timeout=20,
    )
    if res.status_code >= 400:
        raise RuntimeError(f"Reviews {res.status_code}: {res.text[:180]}")
    body = res.json()
    return {
        "state": "ok",
        "detail": "Latest Google Business review summary.",
        "rating": body.get("averageRating"),
        "count": body.get("totalReviewCount"),
        "as_of": date.today().isoformat(),
    }


async def run_connectors(settings: Settings, day: date | None = None, fx: float = 3.6725) -> dict[str, Any]:
    day = day or date.today()
    records: list[dict] = []
    connectors: list[dict] = []
    site_patch: dict[str, Any] = {}

    async with httpx.AsyncClient() as client:
        token: str | None = None
        token_error: str | None = None
        try:
            token = await _google_token(client, settings)
        except Exception as exc:  # noqa: BLE001
            token_error = str(exc)

        jobs = [
            ("meta", sync_meta(client, settings, day)),
            ("google_ads", sync_google_ads(client, settings, day, token if not token_error else None)),
            ("linkedin", sync_linkedin(client, settings, day)),
            ("pinterest", sync_pinterest(client, settings, day, fx)),
            ("tiktok", sync_tiktok(client, settings, day, fx)),
            ("snapchat", sync_snapchat(client, settings, day, fx)),
        ]
        for _key, coro in jobs:
            try:
                result = await coro
            except Exception as exc:  # noqa: BLE001
                result = {"name": _key, "state": "error", "detail": str(exc)}
            records.extend(result.pop("records", []) or [])
            connectors.append(
                {
                    "_id": result.get("name") or _key,
                    "name": result.get("name") or _key,
                    "state": result.get("state"),
                    "detail": result.get("detail"),
                    "checked_on": day.isoformat(),
                }
            )

        for key, coro in (
            ("ga4", sync_ga4(client, settings, token, day)),
            ("search", sync_search(client, settings, token, day)),
            ("gtm", sync_gtm(client, settings, token)),
            ("reviews", sync_reviews(client, settings, token)),
        ):
            try:
                site_patch[key] = await coro
            except Exception as exc:  # noqa: BLE001
                site_patch[key] = {"state": "error", "detail": str(exc)}
            if token_error and site_patch[key].get("state") != "ok":
                site_patch[key]["detail"] = token_error

    if token_error:
        for item in connectors:
            if item["name"] == "Google Ads" and item["state"] != "ok":
                item["state"] = "error"
                item["detail"] = token_error

    return {"records": records, "connectors": connectors, "site": site_patch}
