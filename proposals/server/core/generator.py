from __future__ import annotations

import uuid
from typing import Any


def _pid() -> str:
    return uuid.uuid4().hex[:12]


def compute_pricing(items: list[dict[str, Any]], pricing: dict[str, Any]) -> dict[str, Any]:
    """Recompute totals from items + discount/VAT percentages."""
    subtotal = 0.0
    for item in items:
        price = item.get("price")
        qty = item.get("qty") or 1
        if isinstance(price, (int, float)):
            subtotal += float(price) * float(qty)
    discount_pct = float(pricing.get("discount_pct") or 0)
    vat_pct = float(pricing.get("vat_pct") or 0)
    discount_amount = round(subtotal * discount_pct / 100.0, 2)
    after_discount = subtotal - discount_amount
    vat_amount = round(after_discount * vat_pct / 100.0, 2)
    total = round(after_discount + vat_amount, 2)
    out = dict(pricing)
    out.update(
        subtotal=round(subtotal, 2),
        discount_pct=discount_pct,
        discount_amount=discount_amount,
        vat_pct=vat_pct,
        vat_amount=vat_amount,
        total=total,
    )
    out.setdefault("currency", "AED")
    return out


def spec_rows_for_item(item: dict[str, Any], currency: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []

    def add(label: str, value: Any) -> None:
        v = str(value).strip() if value is not None else ""
        if v:
            rows.append({"label": label, "value": v})

    add("Design", item.get("design") or item.get("name"))
    add("Size", item.get("size"))
    add("Material", item.get("material"))
    add("Pieces", item.get("pieces"))
    add("Light", item.get("light"))
    add("Color", item.get("color"))
    price = item.get("price")
    if isinstance(price, (int, float)):
        qty = item.get("qty") or 1
        label = "Price" if qty in (1, 1.0) else f"Price (x{int(qty)})"
        add(label, f"{price:,.0f} {currency}")
    elif item.get("price_raw"):
        add("Price", item.get("price_raw"))
    return rows


def generate_pages(
    template: dict[str, Any],
    proposal: dict[str, Any],
) -> list[dict[str, Any]]:
    """Build the ordered page list from the template + selected products.

    Structure (matches the approved Lorenzo sample):
      cover -> intro -> per room: [room_title, per product: visual + spec]
            -> pricing_summary -> closing
    """
    fixed = template.get("fixed_pages") or {}
    pricing_defaults = template.get("pricing_defaults") or {}
    currency = (proposal.get("pricing") or {}).get("currency") or pricing_defaults.get("currency", "AED")
    items: list[dict[str, Any]] = proposal.get("items") or []

    pages: list[dict[str, Any]] = []

    cover = dict(fixed.get("cover") or {})
    cover.setdefault("tag", "CUSTOMER INQUIRY")
    pages.append({"id": _pid(), "type": "cover", "data": cover})

    intro = fixed.get("intro")
    if intro:
        pages.append({"id": _pid(), "type": "intro", "data": dict(intro)})

    # Group items by room, preserving first-seen room order.
    rooms: dict[str, list[dict[str, Any]]] = {}
    for item in items:
        room = (item.get("room") or "Proposal").strip() or "Proposal"
        rooms.setdefault(room, []).append(item)

    proposal_kind = (proposal.get("project") or {}).get("kind") or "Lighting Proposal"
    for room, room_items in rooms.items():
        first = room_items[0]
        pages.append({
            "id": _pid(),
            "type": "room_title",
            "data": {
                "title": f"{proposal_kind} : {room}",
                "image_url": first.get("room_image_url") or first.get("image_url") or "",
            },
        })
        for item in room_items:
            images = item.get("image_urls") or ([item["image_url"]] if item.get("image_url") else [])
            pages.append({
                "id": _pid(),
                "type": "product_visual",
                "data": {
                    "item_id": item.get("id"),
                    "image_url": images[0] if images else "",
                    "drawing_url": item.get("drawing_url") or (images[1] if len(images) > 1 else ""),
                },
            })
            pages.append({
                "id": _pid(),
                "type": "product_spec",
                "data": {
                    "item_id": item.get("id"),
                    "title": item.get("spec_title")
                    or (
                        "Customized Chandelier"
                        if "chandelier" in (item.get("category") or "").lower()
                        else (item.get("name") or "Product Specification")
                    ),
                    "rows": spec_rows_for_item(item, currency),
                },
            })

    pages.append({
        "id": _pid(),
        "type": "pricing_summary",
        "data": {
            "included_title": "The price includes the following:",
            "services": list(pricing_defaults.get("included_services") or []),
            "notes": "",
        },
    })

    closing = dict(fixed.get("closing") or {})
    closing.setdefault("tag", cover.get("tag", ""))
    pages.append({"id": _pid(), "type": "closing", "data": closing})
    return pages
