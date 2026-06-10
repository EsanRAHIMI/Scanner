from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from uuid import uuid4

from pymongo.database import Database

from .models import BatchRecord, BatchStatus, ImportSource, ItemRecord, ItemStatus, OutputRecord, utc_now
from .repository import ImageRepository
from .storage import StorageBackend

logger = logging.getLogger("image-migrations")

_FINAL_KEY_RE = re.compile(
    r"^[^/]+/(?P<batch_id>[0-9a-f-]{36})/(?P<stem>[^/]+)__(?P<bg>[^/]+)\.jpg$",
    re.IGNORECASE,
)


def migrate_json_storage_to_mongo(db: Database, storage_root: Path) -> dict:
    """Import legacy image/server/storage JSON files into MongoDB."""
    repo = ImageRepository(db)
    stats = {"batches": 0, "items": 0, "outputs": 0, "settings": 0}

    batches_dir = storage_root / "batches"
    if batches_dir.exists():
        for path in sorted(batches_dir.glob("*.json")):
            batch = BatchRecord.model_validate_json(path.read_text(encoding="utf-8"))
            repo.save_batch(batch)
            stats["batches"] += 1

    items_dir = storage_root / "items"
    if items_dir.exists():
        for path in sorted(items_dir.glob("*.json")):
            item = ItemRecord.model_validate_json(path.read_text(encoding="utf-8"))
            repo.save_item(item)
            stats["items"] += 1

    outputs_file = storage_root / "outputs.json"
    if outputs_file.exists():
        raw = json.loads(outputs_file.read_text(encoding="utf-8"))
        for row in raw:
            payload = {**row}
            if "item_id" not in payload and payload.get("id"):
                payload["item_id"] = payload["id"]
            if "created_at" not in payload:
                payload["created_at"] = payload.get("updated_at") or utc_now().isoformat()
            output = OutputRecord.model_validate(payload)
            batch = repo.get_batch(output.batch_id)
            item = repo.get_item(output.item_id)
            if batch and item:
                repo.upsert_output(item, batch)
                stats["outputs"] += 1

    settings_file = storage_root / "system-settings.json"
    if settings_file.exists():
        from .system_settings import SystemSettings, SystemSettingsStore

        store = SystemSettingsStore(db)
        store.save(SystemSettings.model_validate_json(settings_file.read_text(encoding="utf-8")))
        stats["settings"] = 1

    logger.info("JSON migration complete: %s", stats)
    return stats


def _guess_original_key(storage: StorageBackend, batch_id: str, stem: str) -> str | None:
    prefix = f"{storage.upload_prefix(batch_id)}/"
    for key in storage.list_keys(prefix):
        if stem in Path(key).name:
            return key
    return None


def rebuild_outputs_from_s3(
    db: Database,
    storage: StorageBackend,
    *,
    dry_run: bool = False,
) -> dict:
    """Scan final/ keys and upsert outputs (and minimal items/batches when missing)."""
    repo = ImageRepository(db)
    final_root = storage.settings.aws_s3_final_prefix
    keys = storage.list_keys(f"{final_root}/")

    stats = {"scanned": 0, "outputs_upserted": 0, "items_created": 0, "batches_created": 0, "skipped": 0}

    for key in keys:
        match = _FINAL_KEY_RE.match(key)
        if not match:
            stats["skipped"] += 1
            continue
        stats["scanned"] += 1

        batch_id = match.group("batch_id")
        stem = match.group("stem")
        background_id = match.group("bg")
        final_url = storage.public_url(key)

        batch = repo.get_batch(batch_id)
        if not batch:
            batch = BatchRecord(
                id=batch_id,
                name=f"Recovered batch {batch_id[:8]}",
                source=ImportSource.S3,
                status=BatchStatus.FINALIZED,
            )
            if not dry_run:
                repo.save_batch(batch)
            stats["batches_created"] += 1

        items = repo.list_items(batch_id)
        item = next((i for i in items if i.final_key == key), None)
        if item is None:
            item = next((i for i in items if i.display_name == stem), None)

        if item is None:
            item_id = str(uuid4())
            processed_key = storage.processed_key(batch_id, item_id)
            original_guess = _guess_original_key(storage, batch_id, stem)
            item = ItemRecord(
                id=item_id,
                batch_id=batch_id,
                file_name=f"{stem}.jpg",
                display_name=stem,
                source=ImportSource.S3,
                source_ref=f"s3://{key}",
                original_key=original_guess or key,
                original_url=storage.public_url(original_guess) if original_guess else None,
                processed_key=processed_key if storage.exists(processed_key) else None,
                processed_url=storage.public_url(processed_key) if storage.exists(processed_key) else None,
                final_key=key,
                final_url=final_url,
                background_id=background_id,
                status=ItemStatus.FINALIZED,
            )
            if not dry_run:
                repo.save_item(item)
            stats["items_created"] += 1

        if not dry_run:
            item.final_key = key
            item.final_url = final_url
            item.background_id = background_id
            item.status = ItemStatus.FINALIZED
            repo.save_item(item)
            repo.upsert_output(item, batch)
        stats["outputs_upserted"] += 1

    logger.info("S3 rebuild complete: %s", stats)
    return stats
