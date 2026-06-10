from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Iterable

from .models import BatchRecord, ItemRecord, ItemStatus, OutputRecord, utc_now


class ImageRepository:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.batches_dir = root / "batches"
        self.items_dir = root / "items"
        self.outputs_file = root / "outputs.json"
        self._lock = threading.RLock()
        self.batches_dir.mkdir(parents=True, exist_ok=True)
        self.items_dir.mkdir(parents=True, exist_ok=True)
        if not self.outputs_file.exists():
            self.outputs_file.write_text("[]", encoding="utf-8")

    def _batch_path(self, batch_id: str) -> Path:
        return self.batches_dir / f"{batch_id}.json"

    def _item_path(self, item_id: str) -> Path:
        return self.items_dir / f"{item_id}.json"

    def save_batch(self, batch: BatchRecord) -> BatchRecord:
        with self._lock:
            batch.updated_at = utc_now()
            self._batch_path(batch.id).write_text(
                batch.model_dump_json(indent=2),
                encoding="utf-8",
            )
            return batch

    def get_batch(self, batch_id: str) -> BatchRecord | None:
        path = self._batch_path(batch_id)
        if not path.exists():
            return None
        return BatchRecord.model_validate_json(path.read_text(encoding="utf-8"))

    def list_batches(self) -> list[BatchRecord]:
        batches: list[BatchRecord] = []
        for path in sorted(self.batches_dir.glob("*.json"), reverse=True):
            batches.append(BatchRecord.model_validate_json(path.read_text(encoding="utf-8")))
        return batches

    def save_item(self, item: ItemRecord) -> ItemRecord:
        with self._lock:
            item.updated_at = utc_now()
            self._item_path(item.id).write_text(
                item.model_dump_json(indent=2),
                encoding="utf-8",
            )
            return item

    def get_item(self, item_id: str) -> ItemRecord | None:
        path = self._item_path(item_id)
        if not path.exists():
            return None
        return ItemRecord.model_validate_json(path.read_text(encoding="utf-8"))

    def list_items(self, batch_id: str | None = None) -> list[ItemRecord]:
        items: list[ItemRecord] = []
        for path in sorted(self.items_dir.glob("*.json")):
            item = ItemRecord.model_validate_json(path.read_text(encoding="utf-8"))
            if batch_id is None or item.batch_id == batch_id:
                items.append(item)
        items.sort(key=lambda i: i.created_at)
        return items

    def _read_outputs(self) -> list[OutputRecord]:
        raw = json.loads(self.outputs_file.read_text(encoding="utf-8"))
        return [OutputRecord.model_validate(row) for row in raw]

    def _write_outputs(self, rows: Iterable[OutputRecord]) -> None:
        payload = [row.model_dump(mode="json") for row in rows]
        self.outputs_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def upsert_output(self, item: ItemRecord, batch: BatchRecord) -> OutputRecord:
        if not item.final_url:
            raise ValueError("Item has no final URL")

        record = OutputRecord(
            id=item.id,
            batch_id=item.batch_id,
            file_name=item.display_name,
            final_url=item.final_url,
            source_ref=item.source_ref,
            original_ref=item.original_key,
            source=batch.source,
            status=item.status,
            background_id=item.background_id,
            updated_at=utc_now(),
        )

        with self._lock:
            rows = self._read_outputs()
            rows = [r for r in rows if r.id != record.id]
            rows.append(record)
            rows.sort(key=lambda r: r.updated_at, reverse=True)
            self._write_outputs(rows)
        return record

    def list_outputs(
        self,
        *,
        batch_id: str | None = None,
        status: ItemStatus | None = None,
        file_name: str | None = None,
    ) -> list[OutputRecord]:
        rows = self._read_outputs()
        if batch_id:
            rows = [r for r in rows if r.batch_id == batch_id]
        if status:
            rows = [r for r in rows if r.status == status]
        if file_name:
            needle = file_name.lower()
            rows = [r for r in rows if r.file_name.lower() == needle]
        return rows

    def delete_output(self, item_id: str) -> bool:
        with self._lock:
            rows = self._read_outputs()
            next_rows = [r for r in rows if r.id != item_id]
            if len(next_rows) == len(rows):
                return False
            self._write_outputs(next_rows)
            return True

    def delete_item(self, item_id: str) -> bool:
        with self._lock:
            path = self._item_path(item_id)
            if not path.exists():
                return False
            path.unlink()
            return True
