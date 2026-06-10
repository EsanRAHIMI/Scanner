#!/usr/bin/env python3
"""Migrate legacy JSON storage under image/server/storage into MongoDB Atlas."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.config import get_settings
from core.db import connect_mongo, ensure_indexes
from core.migrations import migrate_json_storage_to_mongo

logging.basicConfig(level=logging.INFO)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--storage-root",
        type=Path,
        default=None,
        help="Path to legacy JSON storage (default: IMAGE_STORAGE_ROOT from .env)",
    )
    args = parser.parse_args()

    settings = get_settings()
    storage_root = (args.storage_root or settings.storage_root).resolve()
    if not storage_root.exists():
        print(f"Storage root not found: {storage_root}")
        return 1

    db = connect_mongo(settings)
    ensure_indexes(db)
    stats = migrate_json_storage_to_mongo(db, storage_root)
    print("Migration finished:", stats)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
