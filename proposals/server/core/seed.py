from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

INTRO_TEXT_EN = (
    "Founded in 2004, Lorenzo Home has established itself as a beacon of luxury in home "
    "furnishings within the heart of Dubai. Located at Unit 12, First Floor, Art of Living "
    "Mall, our showroom is a testament to our commitment to excellence and elegance in home "
    "decor. Our carefully curated collection includes a wide array of high-quality "
    "chandeliers, lusters, sofas, and home decorations, each piece selected with an eye for "
    "timeless design and enduring quality."
)

INTRO_TEXT_AR = (
    "تأسست لورنزوهوم في عام 2004 وقد أثبتت نفسها كمعلم من معالم الفخامة في عالم الأثاث "
    "المنزلي في قلب دبي. تقع في الوحدة 12، الطابق الأول، مول فن العيش، وتعتبر صالة العرض "
    "لدينا شهادة على التزامنا بالتميز والأناقة في ديكور المنزل. تشتمل مجموعتنا المنتقاة "
    "بعناية على مجموعة واسعة من الثريات واللوسترات والأرائك وزينة المنزل عالية الجودة، "
    "وقد تم اختيار كل قطعة بعين تقدر التصميم الخالد والجودة المتينة."
)

INCLUDED_SERVICES = [
    "Site visit to take all necessary measurements and determine the suitable designs "
    "according to the space and project requirements.",
    "3D design preparation, including several design options through which the final design "
    "will be approved before starting the production phase.",
    "Installation (excluding scaffolding): Scaffolding is not included, as such equipment is "
    "not part of the company's services; however, all other required tools and materials "
    "will be provided by our team.",
    "10-year warranty covering the chandelier pieces themselves, as well as any potential "
    "defects or malfunctions in the electrical wiring during the warranty period.",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def lorenzo_classic_template() -> dict[str, Any]:
    """Default template matching the approved Lorenzo sample proposal PDF."""
    return {
        "_id": uuid.uuid4().hex,
        "name": "Lorenzo Classic",
        "slug": "lorenzo-classic",
        "scope": "global",
        "assigned_user_ids": [],
        "active": True,
        "branding": {
            "company_name": "Lorenzo Home",
            "logo_url": "/api/proposals/brand/logo.png",
            "pattern_url": "/api/proposals/brand/pattern-1.png",
            "pattern2_url": "/api/proposals/brand/pattern-2.png",
            "background": "#F1F2F4",
            "text_color": "#161616",
            "address": "FF12, Art Of Living Mall, Dubai",
            "phone": "+9714585 98 16",
            "website": "https://lorenzohome.ae",
        },
        "fixed_pages": {
            "cover": {"tag": "CUSTOMER INQUIRY"},
            "intro": {
                "heading": "LORENZO HOME",
                "heading_ar": "لورنزوهوم",
                "text_en": INTRO_TEXT_EN,
                "text_ar": INTRO_TEXT_AR,
                "image_url": "/api/proposals/brand/intro.jpg",
            },
            "closing": {"tag": "CUSTOMER INQUIRY"},
        },
        "pricing_defaults": {
            "currency": "AED",
            "discount_pct": 20,
            "vat_pct": 5,
            "included_services": INCLUDED_SERVICES,
        },
        "created_at": _now(),
        "updated_at": _now(),
    }


async def seed_default_template(db: Any) -> None:
    """Insert the Lorenzo Classic template once (slug-keyed, never duplicated)."""
    if db is None:
        return
    existing = await db["proposal_templates"].find_one({"slug": "lorenzo-classic"})
    if existing:
        return
    await db["proposal_templates"].insert_one(lorenzo_classic_template())
    print("[proposals] ✓ Seeded default 'Lorenzo Classic' template", flush=True)
