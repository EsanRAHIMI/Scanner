from __future__ import annotations

import logging

from .models import BatchStatus, ItemRecord, ItemStatus

logger = logging.getLogger("image-service")

_SKIP_ITEM_STATUSES = {
    ItemStatus.PROCESSED,
    ItemStatus.REVIEWED,
    ItemStatus.BACKGROUND_APPLIED,
    ItemStatus.FINALIZED,
}

INTERRUPTED_ERROR = "Processing interrupted (server restart). Use Reprocess or Resume batch."


def recover_interrupted_jobs(repository) -> int:
    """Mark in-flight items as failed after a crash/restart."""
    recovered = 0
    batch_ids: set[str] = set()

    for item in repository.list_items_with_status(ItemStatus.PROCESSING):
        if item.status != ItemStatus.PROCESSING:
            continue
        item.status = ItemStatus.FAILED
        item.error = INTERRUPTED_ERROR
        repository.save_item(item)
        batch_ids.add(item.batch_id)
        recovered += 1

    for batch_id in batch_ids:
        _reconcile_batch_status(repository, batch_id)

    if recovered:
        logger.warning("Recovered %s interrupted processing item(s)", recovered)
    return recovered


def _reconcile_batch_status(repository, batch_id: str) -> None:
    batch = repository.get_batch(batch_id)
    if not batch or batch.status != BatchStatus.PROCESSING:
        return

    items = repository.list_items(batch_id)
    if not items:
        return

    failed = sum(1 for item in items if item.status == ItemStatus.FAILED)
    ready = sum(1 for item in items if item.status in _SKIP_ITEM_STATUSES)

    if ready > 0 and failed < len(items):
        batch.status = BatchStatus.REVIEW
    elif failed >= len(items):
        batch.status = BatchStatus.FAILED
    else:
        batch.status = BatchStatus.PROCESSING

    repository.save_batch(batch)


def item_needs_processing(item: ItemRecord) -> bool:
    return item.status not in _SKIP_ITEM_STATUSES
