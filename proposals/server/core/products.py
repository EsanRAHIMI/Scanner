from __future__ import annotations

import re
from typing import Any

# Mirrors products/app/products/lib/product-utils.tsx (incl. legacy misspellings).
_NAME_KEYS = ["Collection Name", "Colecction Name", "Name"]
_CODE_KEYS = ["Collection Code", "Colecction Code", "Code", "Code Number", "Code No"]
_PRICE_KEYS = ["Price"]
_CATEGORY_KEYS = ["Category"]
_MATERIAL_KEYS = ["Material"]
_COLOR_KEYS = ["Color"]
_SPACE_KEYS = ["Space"]
_SIZE_KEYS = ["Size", "Dimensions", "Dimension"]
_PIECES_KEYS = ["Pieces", "Piece"]
_LIGHT_KEYS = ["Light", "Light Type"]
_DESC_KEYS = ["Description", "Notes"]
_DRAWING_KEYS = ["Technical Drawing", "Drawing", "Technical"]


def _scalar(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list) and value:
        return _scalar(value[0])
    return ""


def _first(fields: dict[str, Any], keys: list[str]) -> str:
    lower = {k.strip().lower(): k for k in fields.keys()}
    for key in keys:
        actual = lower.get(key.lower())
        if actual is not None:
            v = _scalar(fields.get(actual))
            if v:
                return v
    return ""


def extract_urls(value: Any) -> list[str]:
    urls: list[str] = []
    if value is None:
        return urls
    if isinstance(value, str):
        for part in re.split(r"[\n,\s]+", value.strip()):
            p = part.strip()
            if p.startswith("http://") or p.startswith("https://"):
                urls.append(p)
        return urls
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict) and isinstance(item.get("url"), str):
                urls.append(item["url"])
            else:
                urls.extend(extract_urls(item))
        return urls
    if isinstance(value, dict) and isinstance(value.get("url"), str):
        urls.append(value["url"])
    return urls


def media_urls(fields: dict[str, Any]) -> list[str]:
    """URL / Image / DAM / *url columns, deduped, order-preserving."""
    seen: set[str] = set()
    out: list[str] = []

    def add_field(key: str) -> None:
        for url in extract_urls(fields.get(key)):
            if url not in seen:
                seen.add(url)
                out.append(url)

    lower_map = {k.strip().lower(): k for k in fields.keys()}
    for canonical in ("url", "image", "dam", "video"):
        if canonical in lower_map:
            add_field(lower_map[canonical])
    for k in fields.keys():
        kl = k.strip().lower()
        if kl.endswith(" url") or kl.endswith("_url") or kl.endswith("-url"):
            add_field(k)
        if re.match(r"^image\d+$", kl):
            add_field(k)
    return out


def parse_price(raw: str) -> float | None:
    if not raw:
        return None
    cleaned = re.sub(r"[^\d.,]", "", raw)
    if not cleaned:
        return None
    # "39.400" (thousands dot) vs "39,400" vs "39400.50"
    cleaned = cleaned.replace(",", "")
    parts = cleaned.split(".")
    if len(parts) == 2 and len(parts[1]) == 3:
        cleaned = cleaned.replace(".", "")  # thousands separator
    try:
        return float(cleaned)
    except ValueError:
        return None


def _drawing_url(fields: dict[str, Any]) -> str | None:
    lower_map = {k.strip().lower(): k for k in fields.keys()}
    for key in _DRAWING_KEYS:
        actual = lower_map.get(key.lower())
        if actual:
            urls = extract_urls(fields.get(actual))
            if urls:
                return urls[0]
    return None


def normalize_product(doc: dict[str, Any]) -> dict[str, Any]:
    """Catalog record -> normalized product summary for the proposal UI."""
    fields = doc.get("fields") or {}
    images = media_urls(fields)
    price_raw = _first(fields, _PRICE_KEYS)
    return {
        "id": doc.get("_id"),
        "name": _first(fields, _NAME_KEYS),
        "code": _first(fields, _CODE_KEYS),
        "category": _first(fields, _CATEGORY_KEYS),
        "material": _first(fields, _MATERIAL_KEYS),
        "color": _first(fields, _COLOR_KEYS),
        "space": _first(fields, _SPACE_KEYS),
        "size": _first(fields, _SIZE_KEYS),
        "pieces": _first(fields, _PIECES_KEYS),
        "light": _first(fields, _LIGHT_KEYS),
        "description": _first(fields, _DESC_KEYS),
        "drawing_url": _drawing_url(fields),
        "price_raw": price_raw,
        "price": parse_price(price_raw),
        "image_urls": images,
        "image_url": images[0] if images else None,
        "created_at": doc.get("created_at"),
    }


async def catalog_page(
    db: Any,
    *,
    search: str = "",
    category: str = "",
    material: str = "",
    color: str = "",
    limit: int = 60,
    skip: int = 0,
) -> dict[str, Any]:
    """Read-only view over the shared `products` collection."""
    query: dict[str, Any] = {}
    clauses: list[dict[str, Any]] = []
    if search:
        rx = re.compile(re.escape(search.strip()), re.IGNORECASE)
        clauses.append({
            "$or": [
                {f"fields.{k}": rx}
                for k in _NAME_KEYS + _CODE_KEYS + _CATEGORY_KEYS
            ]
        })
    if category:
        clauses.append({"fields.Category": re.compile(f"^{re.escape(category)}$", re.IGNORECASE)})
    if material:
        clauses.append({"fields.Material": re.compile(f"^{re.escape(material)}$", re.IGNORECASE)})
    if color:
        clauses.append({"fields.Color": re.compile(f"^{re.escape(color)}$", re.IGNORECASE)})
    if clauses:
        query = {"$and": clauses} if len(clauses) > 1 else clauses[0]

    safe_limit = max(1, min(limit, 200))
    cursor = (
        db["products"].find(query).sort([("created_at", -1), ("_id", -1)]).skip(max(0, skip)).limit(safe_limit + 1)
    )
    docs = await cursor.to_list(length=safe_limit + 1)
    has_more = len(docs) > safe_limit
    records = [normalize_product(d) for d in docs[:safe_limit]]
    return {"records": records, "count": len(records), "has_more": has_more, "skip": skip, "limit": safe_limit}
