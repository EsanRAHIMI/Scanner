"""In-process job/progress registry for live batch processing feedback.

Processing runs in the same server process (FastAPI background task + a single
worker thread), so a thread-safe in-memory registry gives fine-grained, live
progress (current stage, %, ETA) that the UI can poll. Coarse, durable state
(per-item status + last stage) is also persisted to Mongo so that after a page
reload — or a server restart — the UI still shows where each item stands.
"""

from __future__ import annotations

import threading
import time
from typing import Any

# Ordered processing stages (used for per-item % and human labels).
STAGES: tuple[str, ...] = (
    "queued",
    "preparing",
    "segmentation",
    "matting",
    "decontamination",
    "transparent_output",
    "branded_output",
    "web_renditions",
    "saving",
    "completed",
)

STAGE_LABELS: dict[str, str] = {
    "queued": "Queued",
    "preparing": "Preparing image",
    "segmentation": "Background removal",
    "matting": "Edge refinement",
    "decontamination": "Halo cleanup",
    "transparent_output": "Transparent output",
    "branded_output": "Branded output",
    "web_renditions": "Web renditions",
    "saving": "Saving outputs",
    "completed": "Completed",
    "failed": "Failed",
}

_TERMINAL = {"completed", "failed"}


def stage_percent(stage: str) -> int:
    if stage == "completed":
        return 100
    if stage == "failed":
        return 100
    try:
        idx = STAGES.index(stage)
    except ValueError:
        return 0
    # Mid-point of the stage band, excluding the terminal "completed".
    span = max(1, len(STAGES) - 1)
    return min(99, int(((idx + 0.5) / span) * 100))


class _ItemProgress:
    __slots__ = ("item_id", "name", "index", "stage", "status", "started_at", "ended_at", "error")

    def __init__(self, item_id: str, name: str, index: int) -> None:
        self.item_id = item_id
        self.name = name
        self.index = index
        self.stage = "queued"
        self.status = "pending"
        self.started_at: float | None = None
        self.ended_at: float | None = None
        self.error: str | None = None


class _BatchProgress:
    def __init__(self, batch_id: str, total: int) -> None:
        self.batch_id = batch_id
        self.total = total
        self.started_at = time.time()
        self.ended_at: float | None = None
        self.items: dict[str, _ItemProgress] = {}
        self.order: list[str] = []
        self.durations: list[float] = []  # completed item durations (s)
        self.active = True


class ProgressRegistry:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._batches: dict[str, _BatchProgress] = {}

    def start_batch(self, batch_id: str, total: int) -> None:
        with self._lock:
            self._batches[batch_id] = _BatchProgress(batch_id, total)

    def register_item(self, batch_id: str, item_id: str, name: str, index: int) -> None:
        with self._lock:
            bp = self._batches.get(batch_id)
            if not bp:
                bp = _BatchProgress(batch_id, 0)
                self._batches[batch_id] = bp
            if item_id not in bp.items:
                bp.items[item_id] = _ItemProgress(item_id, name, index)
                bp.order.append(item_id)
                bp.total = max(bp.total, len(bp.order))

    def start_item(self, batch_id: str, item_id: str) -> None:
        with self._lock:
            ip = self._item(batch_id, item_id)
            if ip:
                ip.started_at = time.time()
                ip.status = "processing"
                ip.stage = "preparing"
                ip.error = None

    def set_stage(self, batch_id: str, item_id: str, stage: str) -> None:
        with self._lock:
            ip = self._item(batch_id, item_id)
            if ip:
                ip.stage = stage

    def finish_item(self, batch_id: str, item_id: str, status: str, error: str | None = None) -> None:
        with self._lock:
            bp = self._batches.get(batch_id)
            ip = self._item(batch_id, item_id)
            if not ip:
                return
            ip.ended_at = time.time()
            ip.status = status
            ip.stage = "completed" if status == "completed" else "failed"
            ip.error = error
            if bp and ip.started_at and status == "completed":
                bp.durations.append(max(0.0, ip.ended_at - ip.started_at))

    def end_batch(self, batch_id: str) -> None:
        with self._lock:
            bp = self._batches.get(batch_id)
            if bp:
                bp.ended_at = time.time()
                bp.active = False

    def _item(self, batch_id: str, item_id: str) -> _ItemProgress | None:
        bp = self._batches.get(batch_id)
        return bp.items.get(item_id) if bp else None

    def snapshot(self, batch_id: str) -> dict[str, Any] | None:
        with self._lock:
            bp = self._batches.get(batch_id)
            if not bp:
                return None
            now = time.time()
            items = [bp.items[i] for i in bp.order]
            done = sum(1 for it in items if it.status in _TERMINAL)
            failed = sum(1 for it in items if it.status == "failed")
            active_item = next((it for it in items if it.status == "processing"), None)

            # current item fraction for overall %
            frac = 0.0
            if active_item:
                frac = stage_percent(active_item.stage) / 100.0
            overall = ((done + frac) / bp.total * 100.0) if bp.total else 0.0

            avg = (sum(bp.durations) / len(bp.durations)) if bp.durations else None
            remaining = bp.total - done
            eta_ms = int(avg * remaining * 1000) if (avg is not None and remaining > 0) else None
            elapsed_ms = int(((bp.ended_at or now) - bp.started_at) * 1000)

            return {
                "batch_id": batch_id,
                "active": bp.active and done < bp.total,
                "total": bp.total,
                "completed": done,
                "failed": failed,
                "overall_percent": round(min(100.0, overall), 1),
                "elapsed_ms": elapsed_ms,
                "eta_ms": eta_ms,
                "current": (
                    {
                        "item_id": active_item.item_id,
                        "name": active_item.name,
                        "index": active_item.index,
                        "stage": active_item.stage,
                        "stage_label": STAGE_LABELS.get(active_item.stage, active_item.stage),
                    }
                    if active_item
                    else None
                ),
                "items": [
                    {
                        "item_id": it.item_id,
                        "name": it.name,
                        "index": it.index,
                        "status": it.status,
                        "stage": it.stage,
                        "stage_label": STAGE_LABELS.get(it.stage, it.stage),
                        "percent": stage_percent(it.stage) if it.status == "processing" else (100 if it.status == "completed" else 0),
                        "elapsed_ms": (
                            int(((it.ended_at or now) - it.started_at) * 1000) if it.started_at else None
                        ),
                        "error": it.error,
                    }
                    for it in items
                ],
            }


# Module-level singleton shared by the processing loop and the API.
registry = ProgressRegistry()
