#!/usr/bin/env python3
"""Upload local background assets and MongoDB metadata rows to shared S3 storage."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.backgrounds import BackgroundStore, slugify_background_id_from_path
from core.config import get_settings
from core.db import COL_BACKGROUNDS, connect_mongo, ensure_indexes
from core.storage import StorageBackend

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migrate-backgrounds")

_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--assets-root",
        type=Path,
        default=None,
        help="Path to assets/ with *-bg.* files (default: bundled assets next to server)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-upload even when storage_key already exists in MongoDB",
    )
    args = parser.parse_args()

    settings = get_settings()
    if not settings.mongodb_uri:
        print("MONGODB_URI is required")
        return 1

    assets_root = (args.assets_root or settings.assets_root).resolve()
    db = connect_mongo(settings)
    ensure_indexes(db)
    storage = StorageBackend(settings)
    store = BackgroundStore(settings, storage, db)

    uploaded = 0
    skipped = 0

    for path in sorted(assets_root.glob("*")):
        if path.suffix.lower() not in _IMAGE_EXTENSIONS:
            continue
        bg_id = slugify_background_id_from_path(path)
        existing = db[COL_BACKGROUNDS].find_one({"background_id": bg_id})
        if existing and existing.get("storage_key") and not args.force:
            logger.info("Skip %s (already has storage_key)", bg_id)
            skipped += 1
            continue
        name = (existing or {}).get("name") or bg_id.replace("-", " ").title()
        store.register(bg_id, name, path.read_bytes(), ext=path.suffix.lower(), resize=False)
        logger.info("Uploaded background %s from %s", bg_id, path.name)
        uploaded += 1

    for doc in db[COL_BACKGROUNDS].find({"storage_key": {"$exists": False}}):
        bg_id = doc.get("background_id")
        if not bg_id:
            continue
        bundled = store._bundled_path(bg_id)  # noqa: SLF001 — migration helper
        if not bundled:
            logger.warning("No file for background_id=%s (metadata only)", bg_id)
            continue
        name = doc.get("name") or bg_id.replace("-", " ").title()
        store.register(bg_id, name, bundled.read_bytes(), ext=bundled.suffix.lower(), resize=False)
        logger.info("Backfilled %s from bundled asset", bg_id)
        uploaded += 1

    seeded = store.seed_bundled_defaults()
    print(f"Done: uploaded={uploaded}, skipped={skipped}, seeded_defaults={seeded}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
