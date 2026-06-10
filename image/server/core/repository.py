from __future__ import annotations

from datetime import datetime
from typing import Any

from pymongo.database import Database

from .db import COL_BATCHES, COL_ITEMS, COL_OUTPUTS
from .models import BatchRecord, ImportSource, ItemRecord, ItemStatus, OutputRecord, utc_now


def _dt(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return utc_now()


def _batch_from_doc(doc: dict) -> BatchRecord:
    payload = {**doc}
    payload.pop("_id", None)
    payload["created_at"] = _dt(payload.get("created_at"))
    payload["updated_at"] = _dt(payload.get("updated_at"))
    return BatchRecord.model_validate(payload)


def _item_from_doc(doc: dict) -> ItemRecord:
    payload = {**doc}
    payload.pop("_id", None)
    # MongoDB stores transparent_key/url; API model uses processed_key/url.
    if "transparent_key" in payload and not payload.get("processed_key"):
        payload["processed_key"] = payload.pop("transparent_key")
    if "transparent_url" in payload and not payload.get("processed_url"):
        payload["processed_url"] = payload.pop("transparent_url")
    payload.pop("transparent_key", None)
    payload.pop("transparent_url", None)
    payload["created_at"] = _dt(payload.get("created_at"))
    payload["updated_at"] = _dt(payload.get("updated_at"))
    return ItemRecord.model_validate(payload)


def _item_to_doc(item: ItemRecord) -> dict:
    doc = item.model_dump(mode="json")
    doc["transparent_key"] = doc.pop("processed_key", None)
    doc["transparent_url"] = doc.pop("processed_url", None)
    return doc


def _output_from_doc(doc: dict) -> OutputRecord:
    payload = {**doc}
    payload.pop("_id", None)
    if "item_id" not in payload and payload.get("id"):
        payload["item_id"] = payload["id"]
    payload["created_at"] = _dt(payload.get("created_at"))
    payload["updated_at"] = _dt(payload.get("updated_at"))
    return OutputRecord.model_validate(payload)


def _output_to_doc(row: OutputRecord) -> dict:
    doc = row.model_dump(mode="json")
    doc["id"] = row.item_id
    return doc


class ImageRepository:
    def __init__(self, db: Database) -> None:
        self._batches = db[COL_BATCHES]
        self._items = db[COL_ITEMS]
        self._outputs = db[COL_OUTPUTS]

    def _refresh_batch_total(self, batch_id: str) -> None:
        total = self._items.count_documents({"batch_id": batch_id})
        self._batches.update_one(
            {"id": batch_id},
            {"$set": {"total_count": total, "updated_at": utc_now().isoformat()}},
        )

    def save_batch(self, batch: BatchRecord) -> BatchRecord:
        batch.updated_at = utc_now()
        if batch.total_count == 0:
            batch.total_count = self._items.count_documents({"batch_id": batch.id})
        doc = batch.model_dump(mode="json")
        self._batches.update_one({"id": batch.id}, {"$set": doc}, upsert=True)
        return batch

    def get_batch(self, batch_id: str) -> BatchRecord | None:
        doc = self._batches.find_one({"id": batch_id})
        return _batch_from_doc(doc) if doc else None

    def list_batches(self) -> list[BatchRecord]:
        docs = self._batches.find().sort("created_at", -1)
        return [_batch_from_doc(doc) for doc in docs]

    def save_item(self, item: ItemRecord) -> ItemRecord:
        item.updated_at = utc_now()
        doc = _item_to_doc(item)
        self._items.update_one({"id": item.id}, {"$set": doc}, upsert=True)
        self._refresh_batch_total(item.batch_id)
        return item

    def get_item(self, item_id: str) -> ItemRecord | None:
        doc = self._items.find_one({"id": item_id})
        return _item_from_doc(doc) if doc else None

    def list_items(self, batch_id: str | None = None) -> list[ItemRecord]:
        query = {"batch_id": batch_id} if batch_id else {}
        docs = self._items.find(query).sort("created_at", 1)
        return [_item_from_doc(doc) for doc in docs]

    def upsert_output(self, item: ItemRecord, batch: BatchRecord) -> OutputRecord:
        if not item.final_url:
            raise ValueError("Item has no final URL")

        existing = self._outputs.find_one({"item_id": item.id})
        created_at = _dt(existing.get("created_at")) if existing else utc_now()

        record = OutputRecord(
            id=item.id,
            item_id=item.id,
            batch_id=item.batch_id,
            file_name=item.display_name,
            final_url=item.final_url,
            final_key=item.final_key,
            source_ref=item.source_ref,
            original_ref=item.original_key,
            source=batch.source,
            status=item.status,
            background_id=item.background_id,
            created_at=created_at,
            updated_at=utc_now(),
        )
        doc = _output_to_doc(record)
        self._outputs.update_one({"item_id": item.id}, {"$set": doc}, upsert=True)
        return record

    def list_outputs(
        self,
        *,
        batch_id: str | None = None,
        status: ItemStatus | None = None,
        file_name: str | None = None,
    ) -> list[OutputRecord]:
        query: dict[str, Any] = {}
        if batch_id:
            query["batch_id"] = batch_id
        if status:
            query["status"] = status.value

        docs = self._outputs.find(query).sort("updated_at", -1)
        rows = [_output_from_doc(doc) for doc in docs]
        if file_name:
            needle = file_name.lower()
            rows = [r for r in rows if r.file_name.lower() == needle]
        return rows

    def delete_output(self, item_id: str) -> bool:
        result = self._outputs.delete_one({"item_id": item_id})
        return result.deleted_count > 0

    def delete_item(self, item_id: str) -> bool:
        item = self.get_item(item_id)
        result = self._items.delete_one({"id": item_id})
        if item:
            self._refresh_batch_total(item.batch_id)
        return result.deleted_count > 0

    def count_outputs(self, query: dict | None = None) -> int:
        return self._outputs.count_documents(query or {})
