"""Catalog rules derived from CODE NUMBER — single source of truth for enrichment.

All sizes encoded in CODE NUMBER suffixes are in **millimetres**.
Stored catalog fields (DIMENSION (mm), h, l, w) use **centimetres** (legacy column name).

Dimension column is the base for h/l/w when present; CODE NUMBER fills gaps and
sets collection / variant / category / colour.
"""

from __future__ import annotations

import re

# Colour letter immediately after collection digits (before '/').
COLOR_LETTER_MAP: dict[str, str] = {
    "a": "Cream",
    "b": "Black",
}

# Leading shape letter in variant fragment (L1000, D800, …).
SHAPE_CATEGORY_MAP: dict[str, str] = {
    "L": "Long Chandeliers",
    "D": "Ring Chandeliers",
    "W": "Wall Light",
    "P": "Pendant",
    "C": "Chandeliers",
    "S": "Cascade Light",
    "F": "Floor Lamps",
    "T": "Table Lamps",
}

# Arm-count suffix threshold on D{collection}-{n} codes (n ≤ value → Pieces, else mm diameter).
D_RING_ARM_COUNT_MAX = 40

TEMPLATE_NAME_FIELD = "product_tmpl_id/name"
VARIANT_VALUE_IDS_FIELD = "product_template_variant_value_ids"

_COLOR_VALUE_RE = re.compile(
    r"(?:^|,)\s*colou?r\s*:\s*([^,]+)",
    re.IGNORECASE,
)

# Folded aliases → canonical catalog Color labels.
_COLOR_ALIASES: dict[str, str] = {
    "black": "Black",
    "mattblack": "Black",
    "pearlblack": "Black",
    "bl": "Black",
    "white": "White",
    "gold": "Gold",
    "mattgold": "Gold",
    "chrome": "Chrome",
    "chromium": "Chrome",
    "clear": "Transparent",
    "transparent": "Transparent",
    "bronze": "Bronze",
    "antiquebrass": "Bronze",
    "blue": "Blue",
    "pink": "Pink",
    "coffe": "Bronze",
    "coffee": "Bronze",
    "diamondcoffee": "Bronze",
    "blacknickel": "Chrome",
    "rgb": "RGB",
}


def _normalize_color_token(raw: str) -> str:
    text = raw.strip()
    if not text:
        return ""
    text = re.sub(r"\s+belt\s*$", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"[-_]\d+$", "", text).strip()
    text = re.sub(r"^L/", "", text, flags=re.IGNORECASE).strip()

    folded = re.sub(r"[^a-z]+", "", text.casefold())
    if folded in _COLOR_ALIASES:
        return _COLOR_ALIASES[folded]

    if text.isupper():
        return text.title()
    return text


def colors_from_variant_value_ids(text: str) -> list[str]:
    """Parse `color: …` segments from Odoo variant attribute string."""
    if not text.strip():
        return []

    seen: set[str] = set()
    colors: list[str] = []
    for match in _COLOR_VALUE_RE.finditer(text):
        chunk = match.group(1).strip()
        for part in re.split(r"\+", chunk):
            normalized = _normalize_color_token(part.strip())
            if not normalized:
                continue
            key = normalized.casefold()
            if key in seen:
                continue
            seen.add(key)
            colors.append(normalized)
    return colors

# Order matters: more specific patterns first.
TEMPLATE_NAME_CATEGORY_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bring\s+chandelier", re.IGNORECASE), "Ring Chandeliers"),
    (re.compile(r"\blong\s+(?:chandelier|chandeliers|lamp|lamps)\b", re.IGNORECASE), "Long Chandeliers"),
    (re.compile(r"\bwall\s+(?:light|lights|lamp|lamps)\b", re.IGNORECASE), "Wall Light"),
    (re.compile(r"\bcascade\s+(?:light|lights|lamp|lamps)?\b", re.IGNORECASE), "Cascade Light"),
    (re.compile(r"\btable\s+(?:lamp|lamps)\b", re.IGNORECASE), "Table Lamps"),
    (re.compile(r"\bfloor\s+(?:lamp|lamps)\b", re.IGNORECASE), "Floor Lamps"),
    (re.compile(r"\bpendant\b", re.IGNORECASE), "Pendant"),
    (re.compile(r"\bchandelier\b", re.IGNORECASE), "Chandeliers"),
    (re.compile(r"\bsofa\b", re.IGNORECASE), "Sofa & Seating"),
    (re.compile(r"\bwall\s+decoration\b", re.IGNORECASE), "Wall Decoration"),
]


def category_from_template_name(name: str) -> str | None:
    text = (name or "").strip()
    if not text:
        return None
    for pattern, category in TEMPLATE_NAME_CATEGORY_PATTERNS:
        if pattern.search(text):
            return category
    return None


RULES_DOC = """
CODE NUMBER patterns
------------------

Structure: {collectionCode}{optionalColorLetter}/{variant}
  Alternate separator: {collectionCode}-{variant} (e.g. 8108-D600, 8108-L1000).

Collection code
  Leading digits only → Colecction Code (e.g. 9538a/L1000 → 9538, 4406/600 → 4406).

Colour letter (optional, before '/')
  a → Cream
  b → Black

Variant — ring (single diameter, mm in code)
  Plain number after '/' → Ring Chandeliers; diameter mm ÷ 10 = l and w (cm).
  Examples: 4408/600, 4406/800, 9538a/500, 9538b/D800

Variant — long
  L prefix (L1000) or trailing l (900l) → Long Chandeliers; length mm ÷ 10 = l (cm).
  Examples: 9538a/L1000, 4408/900l

Variant — multi-ring chandelier
  Two or more diameters joined with '+' → Chandeliers; largest ring sets l and w (cm).
  Overall bounding box (h, l, w) comes from DIMENSION column when available.
  Example: 4406/1000+600 → rings Ø1000 mm + Ø600 mm; l=w=100 cm from largest ring.

Variant — explicit shape prefix
  D800 → Ring (diameter), L1000 → Long, etc.

Variant — wall light (shape only)
  Trailing w or W with no size digits → Wall Light (e.g. 86020/w).
  Dimensions often use l*w in the DIMENSION column (e.g. 30*28 cm).

Variant — D-prefix ring (classic ring chandelier)
  D{collection}-{n} when n ≤ 40 → Ring Chandeliers, n = arm count (Pieces).
  Examples: D9260-12 (12 arms), D9260-8 (8 arms).
  When n > 40 the suffix is ring diameter in mm (e.g. D9162-650 → Ø65 cm).

Category from product_tmpl_id/name
  Odoo export name often starts with the product type (may include collection name).
  Matched phrases map to the canonical Category column (longest / most specific first).

Color from product_template_variant_value_ids
  Odoo variant string may include `color: VALUE` (comma-separated with Size, Model, …).
  Multiple colours use `+` (e.g. `color: Silver+Black belt` → Silver, Black).
  CODE NUMBER colour letters (a/b) take priority over variant colour.

MD long chandelier codes
  MD{collection}{variant}-{pieces} when variant starts with L (LG, LC, LB, …).
  Example: MD20118LG-5 → Long Chandeliers, 5 pendants, collection 20118.

Dimensions
  DIMENSION (mm) column stores centimetres (display label: Dimension (cm)).
  Format l*w*h (e.g. 100*100*70). Parsed into h, l, w when those cells are empty.
  l*w*Hh → length × width/depth × height (e.g. 100*10*H120 → l=100, w=10, h=120 cm).
  Values ≥500 (or H…mm suffix) are treated as millimetres and ÷10.
  CODE NUMBER ring/long diameters fill l/w; Dimension column is the base when present.
  Bulk fill: `apply_code_number_enrichment.py --fill-dimensions --apply`
  Corrects mm values stored in cm columns (e.g. 600 → 60) when Dimension is present.

Category
  Always corrected from CODE NUMBER when the stored value differs
  (e.g. generic "Chandeliers" → "Ring Chandeliers" for 4406/800).
"""
