"""Derive catalog fields from CODE NUMBER and DIMENSION columns (centimetres)."""
from __future__ import annotations

import re
from typing import Any

from code_number_rules import (
    COLOR_LETTER_MAP,
    D_RING_ARM_COUNT_MAX,
    SHAPE_CATEGORY_MAP,
    TEMPLATE_NAME_FIELD,
    VARIANT_VALUE_IDS_FIELD,
    category_from_template_name,
    colors_from_variant_value_ids,
)

_CODE_NUMBER_KEYS = ("CODE NUMBER", "Code Number", "Code No")
_COLLECTION_CODE_KEYS = ("Colecction Code", "Collection Code", "Code")
_DIMENSION_KEYS = (
    "DIMENSION (cm)",
    "Dimension (cm)",
    "DIMENSION (mm)",
    "Dimension (mm)",
    "DIMENSION",
    "Dimension",
    "Dimensions",
    "Size",
)
_DIMENSION_OUT_KEY = "DIMENSION (mm)"
_DIMENSION_DUPLICATE_KEYS = ("DIMENSION (cm)", "Dimension (cm)")

_CODE_NUMBER_RE = re.compile(
    r"^\s*(?P<collection>\d+)\s*(?P<color_letter>[a-zA-Z]?)\s*/\s*(?P<variant>.+?)\s*$"
)
_CODE_NUMBER_HYPHEN_RE = re.compile(
    r"^\s*(?P<collection>\d+)\s*-\s*(?P<variant>.+?)\s*$"
)
# D9260-12 → classic ring (D), collection 9260, 12 arms.
_CODE_NUMBER_D_PREFIX_RE = re.compile(
    r"^\s*D(?P<collection>\d+)\s*-\s*(?P<suffix>.+?)\s*$",
    re.IGNORECASE,
)
_VARIANT_SIZE_RE = re.compile(
    r"^\s*(?P<shape>[A-Za-z]*)\s*(?P<size>\d+)\s*$"
)
_VARIANT_SIZE_TRAILING_L_RE = re.compile(
    r"^\s*(?P<size>\d+)\s*[lL]\s*$"
)
_VARIANT_SHAPE_ONLY_W_RE = re.compile(r"^\s*[wW]\s*$")
_VARIANT_MULTI_RING_RE = re.compile(
    r"^\s*\d+(?:\s*\+\s*\d+)+\s*$"
)

_DIM_LABELED_RE = re.compile(
    r"(?P<l>L)\s*(?P<lv>\d+(?:\.\d+)?)\s*(?:mm)?"
    r"|(?P<w>W)\s*(?P<wv>\d+(?:\.\d+)?)\s*(?:mm)?"
    r"|(?P<h>H)\s*(?P<hv>\d+(?:\.\d+)?)\s*(?:mm)?"
    r"|(?P<d>D|φ|Ø|∅)\s*(?P<dv>\d+(?:\.\d+)?)\s*(?:mm)?",
    re.IGNORECASE,
)
_DIM_STAR_RE = re.compile(
    r"^\s*(?P<a>\d+(?:\.\d+)?)\s*[*×xX]\s*(?P<b>\d+(?:\.\d+)?)\s*[*×xX]\s*(?P<c>\d+(?:\.\d+)?)\s*(?:mm)?\s*$",
    re.IGNORECASE,
)
_DIM_TWO_STAR_RE = re.compile(
    r"^\s*(?P<a>\d+(?:\.\d+)?)\s*[*×xX]\s*(?P<b>\d+(?:\.\d+)?)\s*(?:mm)?\s*$",
    re.IGNORECASE,
)
_DIM_DIAMETER_ONLY_RE = re.compile(
    r"^\s*(?:D|φ|Ø|∅)\s*(?P<d>\d+(?:\.\d+)?)\s*(?:mm)?\s*$",
    re.IGNORECASE,
)
_DIM_L_STAR_RE = re.compile(
    r"^\s*L\s*(?P<a>\d+(?:\.\d+)?)\s*[*×xX]\s*(?P<b>\d+(?:\.\d+)?)\s*[*×xX]\s*(?P<c>\d+(?:\.\d+)?)\s*(?:mm)?\s*$",
    re.IGNORECASE,
)
_DIM_NUM_H_RE = re.compile(
    r"^\s*(?P<l>\d+(?:\.\d+)?)\s*[*×xX]\s*H\s*(?P<h>\d+(?:\.\d+)?)\s*(?:mm)?\s*$",
    re.IGNORECASE,
)
_DIM_SINGLE_NUMBER_RE = re.compile(r"^\s*(?P<n>\d+(?:\.\d+)?)\s*(?:mm)?\s*$", re.IGNORECASE)
_DIM_MULTI_PLUS_RE = re.compile(
    r"^\s*\d+(?:\s*\+\s*\d+)+\s*(?:mm)?\s*$",
    re.IGNORECASE,
)
_DIM_MM_STAR_RE = re.compile(
    r"^\s*(?P<a>\d+(?:\.\d+)?)\s*mm\s*[*×xX]\s*(?P<b>\d+(?:\.\d+)?)\s*mm\s*$",
    re.IGNORECASE,
)
# l × w × Hh — length × depth × height (e.g. MD20118 long line: 100*10*H120 cm).
_DIM_LW_H_STAR_RE = re.compile(
    r"^\s*(?P<l>\d+(?:\.\d+)?)\s*[*×xX]\s*(?P<w>\d+(?:\.\d+)?)\s*[*×xX]\s*H\s*(?P<h>\d+(?:\.\d+)?)\s*(?:mm|MM)?\s*$",
    re.IGNORECASE,
)
# MD20118LG-5 → Long Chandeliers, 5 pendants (LG = long variant, -5 = piece count).
_CODE_NUMBER_MD_LONG_RE = re.compile(
    r"^\s*(?:MD)?(?P<collection>\d+)(?P<variant>[A-Z&]+)-(?P<pieces>\d+)\s*$",
    re.IGNORECASE,
)


def _scalar(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value)
    if isinstance(value, list) and value:
        return _scalar(value[0])
    return ""


def _is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, (list, tuple, dict)):
        return len(value) == 0
    return False


def _first(fields: dict[str, Any], keys: tuple[str, ...]) -> str:
    lower = {k.strip().lower(): k for k in fields.keys()}
    for key in keys:
        actual = lower.get(key.lower())
        if actual is not None:
            text = _scalar(fields.get(actual))
            if text:
                return text
    return ""


def _code_suffix_mm_to_cm(size_token: int) -> int:
    return max(1, int(round(size_token / 10)))


def _dim_lw_h_values_to_cm(l_raw: str, w_raw: str, h_raw: str, *, h_has_mm: bool = False) -> dict[str, int]:
    """Convert l*w*Hh triple; small values are already cm, large values are mm."""
    lv = float(l_raw)
    wv = float(w_raw)
    hv = float(h_raw)
    use_mm_scale = max(lv, wv, hv) >= 500 or h_has_mm

    def to_cm(value: float) -> int:
        if use_mm_scale and value >= 100:
            return int(round(value / 10))
        return int(round(value))

    return {"l": to_cm(lv), "w": to_cm(wv), "h": to_cm(hv)}


def _token_to_cm(raw: str, *, star_component: bool = False) -> int | None:
    text = raw.strip().replace(",", "")
    if not text:
        return None
    has_mm = text.lower().endswith("mm")
    if has_mm:
        text = text[:-2].strip()
    try:
        value = float(text)
    except ValueError:
        return None
    if value <= 0:
        return None
    if has_mm or value >= 500:
        value /= 10
    elif not star_component and value >= 200:
        value /= 10
    return int(round(value))


def parse_dimension_text(text: str) -> dict[str, int]:
    raw = text.strip()
    if not raw:
        return {}

    out: dict[str, int] = {}

    l_star = _DIM_L_STAR_RE.match(raw)
    if l_star:
        a = _token_to_cm(l_star.group("a"), star_component=True)
        b = _token_to_cm(l_star.group("b"), star_component=True)
        c = _token_to_cm(l_star.group("c"), star_component=True)
        if a is not None:
            out["l"] = a
        if b is not None:
            out["w"] = b
        if c is not None:
            out["h"] = c
        return out

    num_h = _DIM_NUM_H_RE.match(raw)
    if num_h:
        l_val = _token_to_cm(num_h.group("l"), star_component=True)
        h_val = _token_to_cm(num_h.group("h"))
        if l_val is not None:
            out["l"] = l_val
            out.setdefault("w", l_val)
        if h_val is not None:
            out["h"] = h_val
        return out

    lw_h = _DIM_LW_H_STAR_RE.match(raw)
    if lw_h:
        h_token = lw_h.group("h")
        out.update(
            _dim_lw_h_values_to_cm(
                lw_h.group("l"),
                lw_h.group("w"),
                h_token,
                h_has_mm=raw.upper().rstrip().endswith("MM"),
            )
        )
        return out

    star = _DIM_STAR_RE.match(raw)
    if star:
        a = _token_to_cm(star.group("a"), star_component=True)
        b = _token_to_cm(star.group("b"), star_component=True)
        c = _token_to_cm(star.group("c"), star_component=True)
        if a is not None:
            out["l"] = a
        if b is not None:
            out["w"] = b
        if c is not None:
            out["h"] = c
        return out

    two = _DIM_TWO_STAR_RE.match(raw)
    if two:
        a = _token_to_cm(two.group("a"), star_component=True)
        b = _token_to_cm(two.group("b"), star_component=True)
        if a is not None:
            out["l"] = a
        if b is not None:
            out["w"] = b
        return out

    diam = _DIM_DIAMETER_ONLY_RE.match(raw)
    if diam:
        d = _token_to_cm(diam.group("d"))
        if d is not None:
            out["l"] = d
            out["w"] = d
        return out

    mm_star = _DIM_MM_STAR_RE.match(raw)
    if mm_star:
        a = _token_to_cm(f"{mm_star.group('a')}mm")
        b = _token_to_cm(f"{mm_star.group('b')}mm")
        if a is not None:
            out["l"] = a
        if b is not None:
            out["w"] = b
        return out

    if _DIM_MULTI_PLUS_RE.match(raw):
        parts = [int(p.strip()) for p in re.split(r"\s*\+\s*", raw.replace("mm", "")) if p.strip().isdigit()]
        if parts:
            largest = _code_suffix_mm_to_cm(max(parts)) if max(parts) >= 100 else max(parts)
            out["l"] = largest
            out["w"] = largest
        return out

    single = _DIM_SINGLE_NUMBER_RE.match(raw)
    if single:
        n = _token_to_cm(single.group("n"))
        if n is not None:
            out["l"] = n
            out["w"] = n
        return out

    labeled = {"l": None, "w": None, "h": None, "d": None}
    for match in _DIM_LABELED_RE.finditer(raw):
        if match.group("lv"):
            labeled["l"] = _token_to_cm(match.group("lv"))
        if match.group("wv"):
            labeled["w"] = _token_to_cm(match.group("wv"))
        if match.group("hv"):
            labeled["h"] = _token_to_cm(match.group("hv"))
        if match.group("dv"):
            labeled["d"] = _token_to_cm(match.group("dv"))

    if any(v is not None for v in labeled.values()):
        if labeled["l"] is not None:
            out["l"] = labeled["l"]
        if labeled["w"] is not None:
            out["w"] = labeled["w"]
        if labeled["h"] is not None:
            out["h"] = labeled["h"]
        if labeled["d"] is not None:
            out.setdefault("l", labeled["d"])
            out.setdefault("w", labeled["d"])
        return out

    return out


def format_dimension_cm(dims: dict[str, int]) -> str | None:
    l, w, h = dims.get("l"), dims.get("w"), dims.get("h")
    if l and w and h:
        return f"{l}*{w}*{h}"
    return None


def _parse_multi_ring_variant(variant_raw: str) -> dict[str, Any] | None:
    if not _VARIANT_MULTI_RING_RE.match(variant_raw):
        return None
    diameters_mm = [int(part.strip()) for part in variant_raw.split("+") if part.strip().isdigit()]
    if len(diameters_mm) < 2:
        return None
    largest_cm = _code_suffix_mm_to_cm(max(diameters_mm))
    return {
        "category": "Chandeliers",
        "l": largest_cm,
        "w": largest_cm,
        "ring_diameters_cm": [_code_suffix_mm_to_cm(d) for d in diameters_mm],
    }


def _apply_variant_size_hints(variant_raw: str, out: dict[str, Any]) -> None:
    multi = _parse_multi_ring_variant(variant_raw)
    if multi:
        out.update(multi)
        return

    trailing_l = _VARIANT_SIZE_TRAILING_L_RE.match(variant_raw)
    if trailing_l:
        out["category"] = SHAPE_CATEGORY_MAP["L"]
        out["l"] = _code_suffix_mm_to_cm(int(trailing_l.group("size")))
        return

    if _VARIANT_SHAPE_ONLY_W_RE.match(variant_raw):
        out["category"] = SHAPE_CATEGORY_MAP["W"]
        return

    size_match = _VARIANT_SIZE_RE.match(variant_raw)
    if not size_match:
        return

    shape = (size_match.group("shape") or "").upper()
    size_cm = _code_suffix_mm_to_cm(int(size_match.group("size")))

    if shape == "L":
        out["category"] = SHAPE_CATEGORY_MAP["L"]
        out["l"] = size_cm
    elif shape == "D":
        out["category"] = SHAPE_CATEGORY_MAP["D"]
        out["l"] = size_cm
        out["w"] = size_cm
    elif shape in SHAPE_CATEGORY_MAP:
        out["category"] = SHAPE_CATEGORY_MAP[shape]
        out["l"] = size_cm
    elif not shape:
        out["category"] = "Ring Chandeliers"
        out["l"] = size_cm
        out["w"] = size_cm


def _parse_md_long_code(text: str) -> dict[str, Any]:
    """MD20118LG-5 style: long chandelier variant + pendant count after hyphen."""
    match = _CODE_NUMBER_MD_LONG_RE.match(text)
    if not match:
        return {}

    variant = match.group("variant").upper()
    if not variant.startswith("L"):
        return {}

    pieces = int(match.group("pieces"))
    return {
        "collection_code": match.group("collection"),
        "variant_number": f"{variant}-{pieces}",
        "category": SHAPE_CATEGORY_MAP["L"],
        "pieces": pieces,
    }


def _parse_d_prefix_code(text: str) -> dict[str, Any]:
    match = _CODE_NUMBER_D_PREFIX_RE.match(text)
    if not match:
        return {}

    collection_code = match.group("collection")
    suffix = match.group("suffix").strip()
    out: dict[str, Any] = {
        "collection_code": collection_code,
        "category": SHAPE_CATEGORY_MAP["D"],
    }

    arm_match = re.match(r"^(?P<arms>\d+)\s*$", suffix)
    if arm_match:
        arms = int(arm_match.group("arms"))
        if arms <= D_RING_ARM_COUNT_MAX:
            out["pieces"] = arms
            out["variant_number"] = f"D-{arms}"
            return out

    size_match = re.match(r"^(?P<size>\d+)", suffix)
    if size_match:
        size_cm = _code_suffix_mm_to_cm(int(size_match.group("size")))
        out["variant_number"] = suffix
        out["l"] = size_cm
        out["w"] = size_cm
    else:
        out["variant_number"] = suffix

    return out


def parse_code_number(code_number: str) -> dict[str, Any]:
    text = _scalar(code_number)
    if not text:
        return {}

    d_parsed = _parse_d_prefix_code(text)
    if d_parsed:
        return d_parsed

    md_long = _parse_md_long_code(text)
    if md_long:
        return md_long

    color_letter = ""
    match = _CODE_NUMBER_RE.match(text)
    if match:
        color_letter = (match.group("color_letter") or "").lower()
        variant_raw = match.group("variant").strip()
        collection_code = match.group("collection")
    else:
        hyphen = _CODE_NUMBER_HYPHEN_RE.match(text)
        if not hyphen:
            return {}
        collection_code = hyphen.group("collection")
        variant_raw = hyphen.group("variant").strip()

    out: dict[str, Any] = {
        "collection_code": collection_code,
        "variant_number": variant_raw,
    }

    if color_letter in COLOR_LETTER_MAP:
        out["color"] = COLOR_LETTER_MAP[color_letter]

    _apply_variant_size_hints(variant_raw, out)
    return out


def _merge_dims(code_dims: dict[str, int], field_dims: dict[str, int]) -> dict[str, int]:
    """Dimension column is the base; CODE NUMBER fills missing primary axes only."""
    merged = dict(field_dims)
    for axis, value in code_dims.items():
        if axis not in merged or merged[axis] in (None, 0):
            merged[axis] = value
    return {k: v for k, v in merged.items() if v is not None and v > 0}


def _collection_code_wrong(fields: dict[str, Any], expected: str) -> bool:
    current = _scalar(_first(fields, _COLLECTION_CODE_KEYS) or fields.get("Colecction Code"))
    if not current:
        return True
    return current != expected


def _normalize_category(value: Any) -> str:
    return _scalar(value).casefold().strip()


def _category_should_update(current: Any, expected: str) -> bool:
    """True when CODE NUMBER implies a different category than the stored value."""
    if not expected:
        return False
    if _is_blank(current):
        return True
    return _normalize_category(current) != expected.casefold()


def _patch_if_blank(
    fields: dict[str, Any],
    patches: dict[str, Any],
    key: str,
    value: Any,
) -> None:
    if value is None or value == "":
        return
    if not _is_blank(fields.get(key)):
        return
    patches[key] = value


def _numeric_field_value(value: Any) -> int | None:
    text = _scalar(value).replace(",", "")
    if not text:
        return None
    try:
        return int(round(float(text)))
    except ValueError:
        return None


def _axis_should_update(
    fields: dict[str, Any],
    axis: str,
    merged_value: int | None,
    *,
    has_dimension: bool,
) -> bool:
    if merged_value is None:
        return False
    current = _numeric_field_value(fields.get(axis))
    if current is None:
        return True
    if current == merged_value:
        return False
    # Common data-entry mistake: mm value stored in a cm column (600 vs 60).
    if current == merged_value * 10:
        return True
    if has_dimension:
        return True
    return False


def _patch_axis(
    fields: dict[str, Any],
    patches: dict[str, Any],
    axis: str,
    merged_value: int | None,
    *,
    has_dimension: bool,
) -> None:
    if merged_value is None:
        return
    if _axis_should_update(fields, axis, merged_value, has_dimension=has_dimension):
        patches[axis] = merged_value


def enrich_color_from_variant(fields: dict[str, Any]) -> dict[str, Any]:
    """Infer Color from product_template_variant_value_ids (`color: …` segments)."""
    code_number = _first(fields, _CODE_NUMBER_KEYS)
    if code_number and parse_code_number(code_number).get("color"):
        return {}

    raw = _scalar(fields.get(VARIANT_VALUE_IDS_FIELD))
    colors = colors_from_variant_value_ids(raw)
    if not colors:
        return {}

    value = ", ".join(colors)
    if _is_blank(fields.get("Color")):
        return {"Color": value}
    return {}


def enrich_category_from_template(fields: dict[str, Any]) -> dict[str, Any]:
    """Infer Category from product_tmpl_id/name when the template label includes a type."""
    code_number = _first(fields, _CODE_NUMBER_KEYS)
    if code_number and parse_code_number(code_number).get("category"):
        return {}

    tmpl_name = _scalar(fields.get(TEMPLATE_NAME_FIELD))
    inferred = category_from_template_name(tmpl_name)
    if not inferred:
        return {}

    current_norm = _normalize_category(fields.get("Category"))
    inferred_norm = inferred.casefold()
    # Do not replace a specific chandelier type with generic "Chandeliers".
    if inferred_norm == "chandeliers" and current_norm in {
        "ring chandeliers",
        "long chandeliers",
    }:
        return {}

    if _category_should_update(fields.get("Category"), inferred):
        return {"Category": inferred}
    return {}


def _merged_dimension_axes(
    fields: dict[str, Any],
    parsed: dict[str, Any],
) -> tuple[dict[str, int], bool]:
    dimension_text = _first(fields, _DIMENSION_KEYS)
    dim_from_field = parse_dimension_text(dimension_text) if dimension_text else {}
    code_dims = {k: parsed[k] for k in ("h", "l", "w") if k in parsed}
    merged_dims = _merge_dims(code_dims, dim_from_field)
    return merged_dims, bool(dimension_text)


def enrich_dimensions(fields: dict[str, Any], *, only_fill_blank: bool = True) -> dict[str, Any]:
    """Fill h/l/w (and DIMENSION string) from CODE NUMBER + Dimension column."""
    patches: dict[str, Any] = {}

    code_number = _first(fields, _CODE_NUMBER_KEYS)
    parsed = parse_code_number(code_number) if code_number else {}
    merged_dims, has_dimension = _merged_dimension_axes(fields, parsed)

    if not merged_dims:
        return patches

    if only_fill_blank:
        for axis in ("h", "l", "w"):
            _patch_axis(fields, patches, axis, merged_dims.get(axis), has_dimension=has_dimension)
        formatted = format_dimension_cm(merged_dims)
        _patch_if_blank(fields, patches, _DIMENSION_OUT_KEY, formatted)
    else:
        for axis in ("h", "l", "w"):
            if axis in merged_dims:
                patches[axis] = merged_dims[axis]
        formatted = format_dimension_cm(merged_dims)
        if formatted:
            patches[_DIMENSION_OUT_KEY] = formatted

    return patches


def enrich_product_fields(fields: dict[str, Any], *, only_fill_blank: bool = True) -> dict[str, Any]:
    patches: dict[str, Any] = {}

    code_number = _first(fields, _CODE_NUMBER_KEYS)
    parsed = parse_code_number(code_number) if code_number else {}

    if parsed:
        expected_code = parsed.get("collection_code")
        if expected_code and (not only_fill_blank or _collection_code_wrong(fields, str(expected_code))):
            if fields.get("Colecction Code") != expected_code:
                patches["Colecction Code"] = expected_code

        if only_fill_blank:
            _patch_if_blank(fields, patches, "Variant Number", parsed.get("variant_number"))
            category_value = parsed.get("category")
            if category_value and _category_should_update(fields.get("Category"), str(category_value)):
                patches["Category"] = category_value
            _patch_if_blank(fields, patches, "Color", parsed.get("color"))
            _patch_if_blank(fields, patches, "Pieces", parsed.get("pieces"))
        else:
            if parsed.get("variant_number"):
                patches["Variant Number"] = parsed["variant_number"]
            if parsed.get("category"):
                patches["Category"] = parsed["category"]
            if parsed.get("color"):
                patches["Color"] = parsed["color"]
            if parsed.get("pieces") is not None:
                patches["Pieces"] = parsed["pieces"]

    patches.update(
        enrich_dimensions(
            {**fields, **patches},
            only_fill_blank=only_fill_blank,
        )
    )

    # Template name only when CODE NUMBER did not imply a category.
    if not parsed.get("category"):
        patches.update(enrich_category_from_template({**fields, **patches}))

    if not parsed.get("color") and not patches.get("Color"):
        patches.update(enrich_color_from_variant({**fields, **patches}))

    return patches


def consolidate_dimension_fields(fields: dict[str, Any]) -> dict[str, Any]:
    patches: dict[str, Any] = {}
    canonical = _scalar(fields.get(_DIMENSION_OUT_KEY))

    for duplicate_key in _DIMENSION_DUPLICATE_KEYS:
        duplicate = _scalar(fields.get(duplicate_key))
        if duplicate and not canonical:
            patches[_DIMENSION_OUT_KEY] = duplicate
            canonical = duplicate
        if duplicate_key in fields:
            patches[f"__unset__{duplicate_key}"] = True

    for key in list(fields.keys()):
        lower = key.strip().lower()
        if lower in {"dimension", "dimensions", "size"} and key != _DIMENSION_OUT_KEY:
            value = _scalar(fields.get(key))
            if value and not canonical:
                patches[_DIMENSION_OUT_KEY] = value
                canonical = value
            patches[f"__unset__{key}"] = True

    return patches


def product_matches_collection_filter(fields: dict[str, Any], collection_code: str) -> bool:
    needle = collection_code.strip()
    if not needle:
        return True

    code_number = _first(fields, _CODE_NUMBER_KEYS)
    if code_number:
        if code_number == needle:
            return True
        if code_number.startswith(f"{needle}/") or code_number.startswith(f"{needle}-"):
            return True
        if re.match(rf"^{re.escape(needle)}[a-zA-Z]/", code_number):
            return True

    for key in _COLLECTION_CODE_KEYS:
        if _scalar(fields.get(key)) == needle:
            return True
    return False
