from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from .db import require_db

KINDS = ("task", "project", "campaign")
REPEATS = ("once", "daily", "weekly")
STAGES = ("Queued", "Doing", "Review", "Done")
STAGE_ORDER = {name: index for index, name in enumerate(STAGES)}


def _day(value: str | None, fallback: date | None = None) -> str:
    raw = (value or "").strip()
    if not raw and fallback is not None:
        return fallback.isoformat()
    try:
        return date.fromisoformat(raw).isoformat()
    except ValueError:
        raise HTTPException(status_code=400, detail="INVALID_DATE")


def _clean(body: dict[str, Any], today: date) -> dict[str, Any]:
    title = str(body.get("title") or "").strip()
    if not title or len(title) > 120:
        raise HTTPException(status_code=400, detail="INVALID_TITLE")
    kind = str(body.get("kind") or "")
    repeat = str(body.get("repeat") or "")
    stage = str(body.get("stage") or "")
    if kind not in KINDS or repeat not in REPEATS or stage not in STAGES:
        raise HTTPException(status_code=400, detail="INVALID_WORK")
    owner = str(body.get("owner") or "").strip()
    note = str(body.get("note") or "").strip()
    if len(owner) > 80 or len(note) > 500:
        raise HTTPException(status_code=400, detail="INVALID_WORK")
    deadline_raw = str(body.get("deadline") or "").strip()
    return {
        "title": title,
        "kind": kind,
        "repeat": repeat,
        "owner": owner,
        "stage": stage,
        "started_on": _day(body.get("started_on"), today),
        "deadline": _day(deadline_raw) if deadline_raw else None,
        "hours": _amount(body.get("hours")),
        "cost_aed": _amount(body.get("cost_aed")),
        "note": note,
    }


def _amount(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="INVALID_WORK")
    if number < 0 or number > 1_000_000:
        raise HTTPException(status_code=400, detail="INVALID_WORK")
    return round(number, 2)


def _public(doc: dict[str, Any]) -> dict[str, Any]:
    item = dict(doc)
    item["id"] = str(item.pop("_id"))
    item.pop("open", None)
    return item


def _snapshot(doc: dict[str, Any], closed_on: str, reason: str) -> dict[str, Any]:
    return {
        "_id": uuid4().hex,
        "work_id": str(doc["_id"]),
        "title": doc.get("title") or "",
        "kind": doc.get("kind") or "task",
        "repeat": doc.get("repeat") or "once",
        "owner": doc.get("owner") or "",
        "stage": doc.get("stage") or "Done",
        "started_on": doc.get("started_on") or closed_on,
        "stage_on": doc.get("stage_on") or doc.get("started_on") or closed_on,
        "deadline": doc.get("deadline"),
        "hours": doc.get("hours"),
        "cost_aed": doc.get("cost_aed"),
        "note": doc.get("note") or "",
        "closed_on": closed_on,
        "reason": reason,
    }


async def list_work() -> dict[str, Any]:
    database = require_db()
    items = await database["marketing_os_work"].find({"open": {"$ne": False}}).to_list(length=300)
    items.sort(key=lambda doc: (STAGE_ORDER.get(str(doc.get("stage")), 9), str(doc.get("started_on") or "")))
    archive = await database["marketing_os_work_log"].find({}).sort("closed_on", -1).to_list(length=80)
    return {"items": [_public(doc) for doc in items], "archive": [_public(doc) for doc in archive]}


async def create_work(body: dict[str, Any]) -> dict[str, Any]:
    database = require_db()
    today = _day(body.get("today"), date.today())
    clean = _clean(body, date.fromisoformat(today))
    doc = {
        "_id": uuid4().hex,
        **clean,
        "stage_on": today if clean["stage"] != "Queued" else clean["started_on"],
        "open": True,
        "updated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }
    await database["marketing_os_work"].insert_one(doc)
    return _public(doc)


async def update_work(work_id: str, body: dict[str, Any]) -> dict[str, Any]:
    database = require_db()
    current = await database["marketing_os_work"].find_one({"_id": work_id, "open": {"$ne": False}})
    if current is None:
        raise HTTPException(status_code=404, detail="WORK_NOT_FOUND")
    today = _day(body.get("today"), date.today())
    clean = _clean(body, date.fromisoformat(today))
    stage_on = current.get("stage_on") or current.get("started_on") or today
    if clean["stage"] != current.get("stage"):
        stage_on = today
    doc = {
        **current,
        **clean,
        "stage_on": stage_on,
        "open": True,
        "updated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }
    await database["marketing_os_work"].replace_one({"_id": work_id}, doc)
    return _public(doc)


async def _close(work_id: str, reason: str, today_raw: str | None, restart: bool) -> dict[str, Any]:
    database = require_db()
    current = await database["marketing_os_work"].find_one({"_id": work_id, "open": {"$ne": False}})
    if current is None:
        raise HTTPException(status_code=404, detail="WORK_NOT_FOUND")
    today = _day(today_raw, date.today())
    await database["marketing_os_work_log"].insert_one(_snapshot(current, today, reason))
    if restart:
        current["stage"] = "Queued"
        current["started_on"] = today
        current["stage_on"] = today
        current["open"] = True
    else:
        current["open"] = False
    current["updated_at"] = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    await database["marketing_os_work"].replace_one({"_id": work_id}, current)
    return _public(current)


async def archive_work(work_id: str, today_raw: str | None) -> dict[str, Any]:
    return await _close(work_id, "archived", today_raw, restart=False)


async def log_round(work_id: str, today_raw: str | None) -> dict[str, Any]:
    return await _close(work_id, "round", today_raw, restart=True)


async def restore_work(work_id: str) -> dict[str, Any]:
    database = require_db()
    current = await database["marketing_os_work"].find_one({"_id": work_id})
    if current is None:
        raise HTTPException(status_code=404, detail="WORK_NOT_FOUND")
    current["open"] = True
    current["updated_at"] = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    await database["marketing_os_work"].replace_one({"_id": work_id}, current)
    return _public(current)
