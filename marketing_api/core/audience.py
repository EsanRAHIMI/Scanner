from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

from .config import Settings
from .connectors import tiktok_credentials
from .db import db

AUDIENCE_ORDER = (
    ("instagram", "Instagram"),
    ("facebook", "Facebook"),
    ("pinterest", "Pinterest"),
    ("tiktok", "TikTok"),
    ("linkedin", "LinkedIn"),
    ("snapchat", "Snapchat"),
)


def _row(channel_id: str, name: str, state: str, detail: str, **fields: Any) -> dict[str, Any]:
    return {
        "_id": channel_id,
        "channel": name,
        "state": state,
        "detail": detail,
        "followers": fields.get("followers"),
        "growth": fields.get("growth"),
        "views": fields.get("views"),
        "likes": fields.get("likes"),
        "comments": fields.get("comments"),
        "checked_on": date.today().isoformat(),
    }


def _count(value: Any) -> int | None:
    if value is None or value == "" or isinstance(value, bool):
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    if number < 0:
        return None
    return number


def _month_start(day: date) -> tuple[int, int]:
    start = datetime(day.year, day.month, 1, tzinfo=timezone.utc)
    end = datetime(day.year, day.month, day.day, tzinfo=timezone.utc) + timedelta(days=1)
    return int(start.timestamp()), int(end.timestamp())


async def _growth(channel_id: str, day: date, followers: int | None) -> int | None:
    if followers is None:
        return None
    database = db()
    if database is None:
        return None
    await database["marketing_os_audience_log"].update_one(
        {"_id": f"{channel_id}:{day.isoformat()}"},
        {"$set": {"channel": channel_id, "day": day.isoformat(), "followers": followers}},
        upsert=True,
    )
    since = (day - timedelta(days=30)).isoformat()
    earlier = (
        await database["marketing_os_audience_log"]
        .find({"channel": channel_id, "day": {"$gte": since, "$lt": day.isoformat()}})
        .sort("day", 1)
        .to_list(length=1)
    )
    if not earlier or earlier[0].get("followers") is None:
        return None
    return followers - int(earlier[0]["followers"])


async def _insight_total(
    client: httpx.AsyncClient,
    url: str,
    token: str,
    metric: str,
    since: int,
    until: int,
) -> int | None:
    res = await client.get(
        url,
        params={
            "access_token": token,
            "metric": metric,
            "period": "day",
            "metric_type": "total_value",
            "since": since,
            "until": until,
        },
        timeout=30,
    )
    if res.status_code >= 400:
        return None
    for item in res.json().get("data") or []:
        if item.get("name") != metric:
            continue
        total = (item.get("total_value") or {}).get("value")
        if total is None:
            values = [entry.get("value") for entry in item.get("values") or [] if isinstance(entry.get("value"), (int, float))]
            total = sum(values) if values else None
        return _count(total)
    return None


async def _meta_profiles(client: httpx.AsyncClient, settings: Settings) -> dict[str, str | None]:
    found: dict[str, str | None] = {"page_id": None, "ig_id": None}
    token = (settings.meta_access_token or "").strip()
    if not token:
        return found
    version = settings.meta_graph_version or "v22.0"
    page_id = (settings.meta_page_id or "").strip() or None
    ig_id = (settings.instagram_business_id or "").strip() or None
    fields = "id,name,instagram_business_account{id,username}"
    if not page_id:
        accounts = await client.get(
            f"https://graph.facebook.com/{version}/me/accounts",
            params={"access_token": token, "fields": fields},
            timeout=30,
        )
        if accounts.status_code < 400:
            rows = accounts.json().get("data") or []
            if rows:
                page_id = str(rows[0].get("id") or "") or None
                ig = (rows[0].get("instagram_business_account") or {}).get("id")
                if ig and not ig_id:
                    ig_id = str(ig)
    if not page_id:
        account = settings.meta_ad_account_id.removeprefix("act_")
        pages = await client.get(
            f"https://graph.facebook.com/{version}/act_{account}/promote_pages",
            params={"access_token": token, "fields": fields},
            timeout=30,
        )
        if pages.status_code < 400:
            rows = pages.json().get("data") or []
            if rows:
                page_id = str(rows[0].get("id") or "") or None
                ig = (rows[0].get("instagram_business_account") or {}).get("id")
                if ig and not ig_id:
                    ig_id = str(ig)
    if page_id and not ig_id:
        page = await client.get(
            f"https://graph.facebook.com/{version}/{page_id}",
            params={"access_token": token, "fields": "instagram_business_account{id,username}"},
            timeout=30,
        )
        if page.status_code < 400:
            ig = (page.json().get("instagram_business_account") or {}).get("id")
            if ig:
                ig_id = str(ig)
    found["page_id"] = page_id
    found["ig_id"] = ig_id
    return found


async def _instagram(client: httpx.AsyncClient, settings: Settings, day: date, profiles: dict[str, str | None]) -> dict[str, Any]:
    token = (settings.meta_access_token or "").strip()
    ig_id = profiles.get("ig_id")
    if not token:
        return _row("instagram", "Instagram", "unconfigured", "META_ACCESS_TOKEN is not set.")
    if not ig_id:
        return _row(
            "instagram",
            "Instagram",
            "unconfigured",
            "The Meta token can read ads, not the Instagram profile. Page access is required.",
        )
    version = settings.meta_graph_version or "v22.0"
    profile = await client.get(
        f"https://graph.facebook.com/{version}/{ig_id}",
        params={"access_token": token, "fields": "username,followers_count"},
        timeout=30,
    )
    if profile.status_code >= 400:
        raise RuntimeError(f"Instagram {profile.status_code}: {profile.text[:160]}")
    body = profile.json()
    since, until = _month_start(day)
    url = f"https://graph.facebook.com/{version}/{ig_id}/insights"
    views = await _insight_total(client, url, token, "views", since, until)
    likes = await _insight_total(client, url, token, "likes", since, until)
    comments = await _insight_total(client, url, token, "comments", since, until)
    username = body.get("username") or ig_id
    return _row(
        "instagram",
        "Instagram",
        "ok",
        f"@{username}. Views, likes, and comments are this month. A blank figure was not returned.",
        followers=_count(body.get("followers_count")),
        views=views,
        likes=likes,
        comments=comments,
    )


async def _facebook(client: httpx.AsyncClient, settings: Settings, day: date, profiles: dict[str, str | None]) -> dict[str, Any]:
    token = (settings.meta_access_token or "").strip()
    page_id = profiles.get("page_id")
    if not token:
        return _row("facebook", "Facebook", "unconfigured", "META_ACCESS_TOKEN is not set.")
    if not page_id:
        return _row(
            "facebook",
            "Facebook",
            "unconfigured",
            "The Meta token can read ads, not the Facebook Page. Page access is required.",
        )
    version = settings.meta_graph_version or "v22.0"
    profile = await client.get(
        f"https://graph.facebook.com/{version}/{page_id}",
        params={"access_token": token, "fields": "name,followers_count,fan_count"},
        timeout=30,
    )
    if profile.status_code >= 400:
        raise RuntimeError(f"Facebook {profile.status_code}: {profile.text[:160]}")
    body = profile.json()
    followers = _count(body.get("followers_count"))
    if followers is None:
        followers = _count(body.get("fan_count"))
    since, until = _month_start(day)
    url = f"https://graph.facebook.com/{version}/{page_id}/insights"
    views = await _insight_total(client, url, token, "page_views_total", since, until)
    if views is None:
        views = await _insight_total(client, url, token, "page_media_view", since, until)
    likes = await _insight_total(client, url, token, "page_actions_post_reactions_like_total", since, until)
    return _row(
        "facebook",
        "Facebook",
        "ok",
        f"{body.get('name') or page_id}. Comments are not returned by the Page total.",
        followers=followers,
        views=views,
        likes=likes,
    )


def _pinterest_views(body: dict[str, Any]) -> int | None:
    daily = ((body.get("all") or {}).get("daily_metrics")) or []
    usable = [
        item
        for item in daily
        if item.get("data_status") not in {"BEFORE_BUSINESS_CREATED", "PROCESSING", "BEFORE_PIN_CREATED"}
    ]
    if not usable:
        return None
    total = 0
    seen = False
    for item in usable:
        value = _count(((item.get("metrics") or {}).get("IMPRESSION")))
        if value is None:
            continue
        total += value
        seen = True
    return total if seen else None


async def _pinterest(client: httpx.AsyncClient, settings: Settings, day: date) -> dict[str, Any]:
    token = (settings.pinterest_access_token or "").strip()
    if not token:
        return _row("pinterest", "Pinterest", "unconfigured", "PINTEREST_ACCESS_TOKEN is not set.")
    headers = {"Authorization": f"Bearer {token}"}
    profile = await client.get("https://api.pinterest.com/v5/user_account", headers=headers, timeout=30)
    if profile.status_code >= 400:
        raise RuntimeError(f"Pinterest {profile.status_code}: {profile.text[:160]}")
    body = profile.json()
    start = day.replace(day=1).isoformat()
    analytics = await client.get(
        "https://api.pinterest.com/v5/user_account/analytics",
        headers=headers,
        params={"start_date": start, "end_date": day.isoformat(), "metric_types": "IMPRESSION"},
        timeout=30,
    )
    views = _pinterest_views(analytics.json()) if analytics.status_code < 400 else None
    username = body.get("username") or "Pinterest"
    detail = f"@{username}. Pinterest does not return likes or comments."
    if views is None:
        detail = f"@{username}. Views are not available for this period. Likes and comments are not returned."
    return _row(
        "pinterest",
        "Pinterest",
        "ok",
        detail,
        followers=_count(body.get("follower_count")),
        views=views,
    )


async def _tiktok(settings: Settings) -> dict[str, Any]:
    token, advertiser = await tiktok_credentials(settings)
    if not token or not advertiser:
        return _row("tiktok", "TikTok", "unconfigured", "TikTok is not connected. Use Connect TikTok on the Connections page.")
    return _row(
        "tiktok",
        "TikTok",
        "unconfigured",
        "TikTok ads are connected. Profile followers, views, likes, and comments need a profile connection.",
    )


async def _linkedin(client: httpx.AsyncClient, settings: Settings) -> dict[str, Any]:
    token = (settings.linkedin_access_token or "").strip()
    if not token:
        return _row("linkedin", "LinkedIn", "unconfigured", "LINKEDIN_ACCESS_TOKEN is not set.")
    org = (settings.linkedin_organization_id or "").strip()
    if not org:
        return _row(
            "linkedin",
            "LinkedIn",
            "unconfigured",
            "LinkedIn ads are connected. The organization id is required for followers.",
        )
    res = await client.get(
        "https://api.linkedin.com/rest/organizationalEntityFollowerStatistics",
        headers={
            "Authorization": f"Bearer {token}",
            "LinkedIn-Version": "202511",
            "X-Restli-Protocol-Version": "2.0.0",
        },
        params={"q": "organizationalEntity", "organizationalEntity": f"urn:li:organization:{org}"},
        timeout=30,
    )
    if res.status_code >= 400:
        raise RuntimeError("LinkedIn organization permission is required for followers.")
    elements = res.json().get("elements") or []
    counts = (elements[0].get("followerCounts") if elements else {}) or {}
    organic = _count(counts.get("organicFollowerCount"))
    paid = _count(counts.get("paidFollowerCount"))
    followers = None if organic is None and paid is None else (organic or 0) + (paid or 0)
    return _row(
        "linkedin",
        "LinkedIn",
        "ok",
        "Organization followers. Views, likes, and comments are not on this token.",
        followers=followers,
    )


async def _snapchat(settings: Settings) -> dict[str, Any]:
    if not (settings.snapchat_refresh_token and settings.snapchat_client_id and settings.snapchat_client_secret):
        return _row("snapchat", "Snapchat", "unconfigured", "SNAPCHAT_REFRESH_TOKEN is not set.")
    return _row(
        "snapchat",
        "Snapchat",
        "unconfigured",
        "Snapchat ads are connected. Profile followers, views, likes, and comments are not on the ads token.",
    )


async def sync_audience(settings: Settings, day: date | None = None) -> list[dict[str, Any]]:
    day = day or date.today()
    async with httpx.AsyncClient() as client:
        profiles = await _meta_profiles(client, settings)
        jobs = (
            ("instagram", "Instagram", _instagram(client, settings, day, profiles)),
            ("facebook", "Facebook", _facebook(client, settings, day, profiles)),
            ("pinterest", "Pinterest", _pinterest(client, settings, day)),
            ("tiktok", "TikTok", _tiktok(settings)),
            ("linkedin", "LinkedIn", _linkedin(client, settings)),
            ("snapchat", "Snapchat", _snapchat(settings)),
        )
        rows: list[dict[str, Any]] = []
        for channel_id, name, coro in jobs:
            try:
                row = await coro
            except Exception as exc:  # noqa: BLE001
                row = _row(channel_id, name, "error", str(exc)[:180])
            row["growth"] = await _growth(channel_id, day, row.get("followers"))
            rows.append(row)
        return rows
