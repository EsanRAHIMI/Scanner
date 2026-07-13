#!/usr/bin/env python3
"""Apply CODE NUMBER enrichment to products in MongoDB (scoped by collection code)."""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

from enrich_product_fields import (
    consolidate_dimension_fields,
    enrich_category_from_template,
    enrich_color_from_variant,
    enrich_dimensions,
    enrich_product_fields,
    product_matches_collection_filter,
)

BASE_DIR = Path(__file__).resolve().parent


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _apply_field_patches(fields: dict, patches: dict) -> dict:
    next_fields = {**fields}
    for key, value in patches.items():
        if key.startswith("__unset__"):
            next_fields.pop(key.removeprefix("__unset__"), None)
        else:
            next_fields[key] = value
    return next_fields


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich product fields from CODE NUMBER")
    parser.add_argument("--collection", default="9538", help="Collection code prefix (default: 9538)")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing")
    parser.add_argument("--apply", action="store_true", help="Write patches to MongoDB")
    parser.add_argument(
        "--consolidate-dimensions",
        action="store_true",
        help="Merge DIMENSION (cm) duplicates into DIMENSION (mm) for all products",
    )
    parser.add_argument(
        "--fill-category-from-template",
        action="store_true",
        help="Set Category from product_tmpl_id/name for all matching products",
    )
    parser.add_argument(
        "--fill-color-from-variant",
        action="store_true",
        help="Set Color from product_template_variant_value_ids for all matching products",
    )
    parser.add_argument(
        "--fill-dimensions",
        action="store_true",
        help="Fill h/l/w and DIMENSION from Code Number + Dimension column for all products",
    )
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        parser.error("Pass --dry-run and/or --apply")

    load_dotenv(BASE_DIR / ".env")
    uri = os.environ.get("MONGODB_URI")
    db_name = os.environ.get("MONGODB_DB_NAME", "lorenzodb")
    if not uri:
        raise SystemExit("MONGODB_URI is not set")

    client = MongoClient(uri, serverSelectionTimeoutMS=10000)
    db = client[db_name]
    collection = db["products"]

    ops: list[UpdateOne] = []
    preview: list[dict] = []

    for doc in collection.find({}):
        fields = doc.get("fields") or {}
        if not isinstance(fields, dict):
            continue

        patches: dict = {}
        if args.consolidate_dimensions:
            patches.update(consolidate_dimension_fields(fields))

        if args.fill_category_from_template:
            patches.update(enrich_category_from_template(fields))

        if args.fill_color_from_variant:
            patches.update(enrich_color_from_variant(fields))

        if args.fill_dimensions:
            patches.update(enrich_product_fields(fields))

        if product_matches_collection_filter(fields, args.collection):
            patches.update(enrich_product_fields(fields, only_fill_blank=True))

        if not patches:
            continue

        next_preview_fields = _apply_field_patches(fields, patches)
        changed = {
            key: {"from": fields.get(key.replace("__unset__", "") if key.startswith("__unset__") else key), "to": value}
            for key, value in patches.items()
            if not key.startswith("__unset__") and fields.get(key) != value
        }
        unset_keys = [key.removeprefix("__unset__") for key in patches if key.startswith("__unset__") and key.removeprefix("__unset__") in fields]
        if unset_keys:
            changed["__removed_duplicate_keys__"] = unset_keys

        if not changed:
            continue

        code_number = fields.get("CODE NUMBER") or fields.get("Code Number") or doc["_id"]
        preview.append({"id": doc["_id"], "code_number": code_number, "changes": changed})

        if args.apply:
            ops.append(
                UpdateOne(
                    {"_id": doc["_id"]},
                    {"$set": {"fields": next_preview_fields, "updated_at": _now()}},
                )
            )

    print(json.dumps({"collection": args.collection, "matched_updates": len(preview), "preview": preview}, indent=2, ensure_ascii=False))

    if args.apply and ops:
        result = collection.bulk_write(ops, ordered=False)
        print(f"\n✓ Applied {result.modified_count} update(s)", flush=True)

    client.close()


if __name__ == "__main__":
    main()
