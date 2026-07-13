"""Default marketing performance snapshot (H1 2026). Seeded on first admin read."""

from __future__ import annotations

from typing import Any

DEFAULT_MARKETING_PERFORMANCE: dict[str, Any] = {
    "_id": "current",
    "title": "Marketing Performance Report",
    "brand": "Lorenzo Home UAE",
    "period": {
        "label": "H1 2026",
        "from": "2026-01-01",
        "to": "2026-07-01",
        "note": "January 2026 through July 2026",
    },
    "overview": {
        "subtitle": "Digital marketing activity summary — Lorenzo",
        "pillars": [
            {
                "key": "content",
                "title": "Content Production",
                "items": [
                    "تولید محتوای ویدیو و عکس از محصولات",
                    "تهیه محتوا از شوروم با تیم بهنام",
                    "عکس و ویدیو از پروژه‌ها با تیم سعید خرسندی",
                    "تهیه تصاویر روزانه برای تیم فروش",
                ],
            },
            {
                "key": "strategy",
                "title": "Strategy & Analytics",
                "items": [
                    "آنالیز رقبا",
                    "تدوین استراتژی‌های مارکتینگ",
                    "برنامه‌ریزی و طراحی کمپین‌ها",
                ],
            },
            {
                "key": "publishing",
                "title": "Content Publishing",
                "items": [
                    "فعالیت روزانه در اینستاگرام",
                    "انتشار در فیسبوک",
                    "انتشار در یوتیوب",
                ],
            },
            {
                "key": "paid",
                "title": "Paid Campaigns",
                "items": [
                    "اجرا و مدیریت کمپین‌های Meta Ads",
                    "اجرا و مدیریت کمپین‌های Google Ads",
                ],
            },
            {
                "key": "infrastructure",
                "title": "Digital Infrastructure",
                "items": [
                    "راه‌اندازی سرویس محصولات products.lorenzohome.ae",
                    "ساخت لندینگ‌پیج جذب لید landing.lorenzohome.ae",
                    "راه‌اندازی Google Analytics و Google Tag Manager",
                ],
            },
            {
                "key": "team",
                "title": "Team Collaboration",
                "items": [
                    "پشتیبانی روزانه تیم فروش با تصاویر محصول",
                    "هماهنگی محتوای شوروم با تیم بهنام",
                    "هماهنگی تصویربرداری پروژه‌ها با تیم سعید خرسندی",
                ],
            },
        ],
    },
    "instagram": {
        "period": {"from": "2026-04-02", "to": "2026-06-30", "label": "Last 90 days"},
        "metrics": [
            {"key": "views", "label": "Views", "value": 144903, "change": None},
            {"key": "reach", "label": "Reach", "value": 73410, "change": "+67.1%"},
            {"key": "followers", "label": "Followers gained", "value": 2092, "change": "+30%"},
            {"key": "interactions", "label": "Interactions", "value": 3304, "change": None},
            {"key": "profile_visits", "label": "Profile visits", "value": 2413, "change": "+52%"},
        ],
        "h1_note": "~700 followers gained over the past 6 months; daily Stories and weekly posts.",
        "format_mix": [
            {"label": "Reels", "share": 65.5, "value": 1194},
            {"label": "Stories", "share": 29.3, "value": 329},
            {"label": "Posts", "share": 5.2, "value": 211},
        ],
        "engagement_breakdown": [
            {"label": "Likes", "value": 1194},
            {"label": "Shares", "value": 329},
            {"label": "Saves", "value": 211},
            {"label": "Comments", "value": 105},
        ],
        "top_reels": [
            {"date": "20 May", "views": 47173, "note": "Top performer"},
            {"date": "7 Apr", "views": 37254, "note": "Primary age 25–44 (76.7%)"},
            {"date": "23 Apr", "views": 28664, "note": "Peak: Sun 9 PM"},
            {"date": "20 Apr", "views": 20642, "note": "Dubai & Tehran"},
        ],
        "insight": "Reels are the primary growth and engagement driver — keep as the core content format.",
        "report_note": "Based on Last 90 days (not full H1).",
    },
    "google_ads": {
        "period": {"from": "2026-04-20", "to": "2026-07-01", "label": "Apr 20 – Jul 1"},
        "totals": {
            "spend_aed": 2594,
            "impressions": 819438,
            "clicks": 14640,
            "ctr_pct": 1.79,
            "avg_cpc_aed": 0.18,
            "mobile_click_share_pct": 94.9,
            "mobile_clicks": 13893,
            "mobile_avg_cpc_aed": 0.15,
        },
        "campaigns": [
            {
                "name": "Luxury Chandeliers Dubai",
                "clicks": 14493,
                "spend_aed": 2200.65,
                "ctr_pct": 1.77,
                "avg_cpc_aed": 0.15,
            },
            {
                "name": "Search | Leads | Landing",
                "clicks": 147,
                "spend_aed": 393.68,
                "ctr_pct": 5.52,
                "avg_cpc_aed": 2.68,
            },
        ],
        "insight": "Mobile is the primary high-performing channel (~95% of clicks, lower CPC).",
        "report_note": "Conversion column not available at campaign level in source exports.",
    },
    "meta_ads": {
        "period": {"from": "2026-01-01", "to": "2026-07-01", "label": "Jan 1 – Jul 1"},
        "totals": {
            "ads_reviewed": 23,
            "spend_aed": 2187.26,
            "impressions": 327012,
            "reach_rows_sum": 230270,
            "whatsapp_conversations": 207,
            "avg_cost_per_whatsapp_aed": 6.78,
            "link_clicks": 1110,
            "avg_cpc_aed": 0.41,
            "post_engagement": 6865,
            "profile_visits": 276,
            "awareness_reach": 24383,
            "spend_without_result_aed": 19.17,
        },
        "highlights": [
            {"label": "WhatsApp spend share", "value": "64.1%", "detail": "AED 1,402.94 — primary lead channel"},
            {"label": "Best CPC ad", "value": "Real 30/04", "detail": "739 clicks @ AED 0.20"},
            {"label": "Top WhatsApp volume", "value": "Eid Al-Adha 2026 - WhatsApp 2", "detail": "73 conversations"},
            {"label": "Best cost / conversation", "value": "WA | Starlight", "detail": "AED 2.51 per conversation"},
        ],
        "report_note": "Reach row sum overlaps across ads; not unique account reach.",
        "active_campaign": {
            "status": "active",
            "platform": "Meta Ads",
            "headline_fa": "کمپین جدید Meta Ads این هفته فعال شد.",
            "summary_fa": (
                "این کمپین برای تبلیغ سه ریل اخیر اینستاگرام Lorenzo Home UAE با هدف افزایش "
                "Reach، Engagement و جذب Lead از طریق WhatsApp راه‌اندازی شده است."
            ),
            "content_note": "3 recent Instagram Reels",
            "period": {
                "from": "2026-07-01",
                "to": "2026-07-06",
                "label": "1 Jul – 6 Jul 2026",
            },
            "budget": {
                "daily_aed": 40,
                "total_estimate_aed": 200,
            },
            "audience": {
                "location": "United Arab Emirates",
                "age": "23 – 65+",
                "languages": ["English", "Arabic"],
                "interests": [
                    "Interior Design",
                    "Home Decor",
                    "Architecture",
                    "Furniture",
                    "Luxury Goods",
                    "Real Estate",
                    "Lighting",
                    "Chandelier",
                    "Villa",
                ],
            },
            "objectives": ["Reach", "Engagement", "WhatsApp Leads"],
            "goal_fa": (
                "افزایش دیده‌شدن ریل‌های جدید، سنجش عملکرد محتوای اخیر، جذب مخاطبان علاقه‌مند "
                "به لوستر و دکوراسیون داخلی، و تبدیل آن‌ها به مکالمه مستقیم فروش از طریق WhatsApp."
            ),
        },
    },
    "services": [
        {
            "name": "products.lorenzohome.ae",
            "title": "Products service",
            "description": "Dedicated product catalog for sales team and clients",
            "status": "live",
        },
        {
            "name": "landing.lorenzohome.ae",
            "title": "Lead landing page",
            "description": "Landing page for Google Ads and Meta Ads lead capture",
            "status": "live",
        },
        {
            "name": "Google Analytics & GTM",
            "title": "Analytics & tagging",
            "description": "User behaviour and campaign performance tracking",
            "status": "live",
        },
        {
            "name": "Periodic reporting",
            "title": "Report templates",
            "description": "Instagram, Meta Ads and Google Ads performance templates",
            "status": "active",
        },
    ],
    "live_sources": {
        "content_calendar": True,
        "instagram_post_stats": True,
        "meta_ads_api": False,
        "google_ads_api": False,
        "instagram_insights_api": False,
    },
}
