#!/usr/bin/env python3
"""Rebuild image_outputs (and missing items/batches) by scanning S3 final/ keys."""

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
from core.migrations import rebuild_outputs_from_s3
from core.storage import StorageBackend

logging.basicConfig(level=logging.INFO)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Scan only; do not write to MongoDB")
    args = parser.parse_args()

    settings = get_settings()
    db = connect_mongo(settings)
    ensure_indexes(db)
    storage = StorageBackend(settings)

    if not storage.s3_enabled:
        print("S3 is not configured. Set AWS_* env vars first.")
        return 1

    stats = rebuild_outputs_from_s3(db, storage, dry_run=args.dry_run)
    print("Rebuild finished:", stats)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
