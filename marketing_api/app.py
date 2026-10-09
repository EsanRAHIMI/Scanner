from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.auth import get_current_user, require_admin
from core.config import get_settings
from core.db import close, connect, db, ensure_indexes, require_db
from core.importer import load_workbook_rows
from core.store import dashboard, rebuild, replace_budgets, replace_targets, save_settings, seed_if_empty, settings_doc, subscribe, unsubscribe
from core.sync import run_sync, sync_loop


class SettingsPatch(BaseModel):
    fx_usd_aed: float | None = None
    selected_month: str | None = None
    mappings: list[dict] | None = None
    qualified_stages: list[str] | None = None


class TargetRow(BaseModel):
    channel: str
    metric: str
    target: float | None = None
    direction: str | None = None
    unit: str | None = None


class BudgetRow(BaseModel):
    month: str
    channel: str
    budget_aed: float | None = None
    approval: str | None = None
    note: str | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await connect()
    await ensure_indexes()
    await seed_if_empty()
    settings = get_settings()
    database = db()
    if database is not None and settings.marketing_workbook_path:
        current = await database["marketing_os_settings"].find_one({"_id": "current"})
        if not (current or {}).get("workbook_imported"):
            try:
                loaded = await asyncio.to_thread(load_workbook_rows, settings.marketing_workbook_path)
                for record in loaded["records"]:
                    await database["marketing_os_records"].replace_one({"_id": record["_id"]}, record, upsert=True)
                await database["marketing_os_settings"].update_one(
                    {"_id": "current"}, {"$set": {"workbook_imported": True}}
                )
            except Exception:
                pass
    if database is not None:
        await rebuild()
    task = asyncio.create_task(sync_loop())
    try:
        yield
    finally:
        task.cancel()
        await close()


app = FastAPI(title="Lorenzo Marketing API", version="1.0.0", lifespan=lifespan)
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "mongo": db() is not None}


@app.get("/api/v1/dashboard")
async def get_dashboard(month: str | None = None, _user: dict = Depends(get_current_user)) -> dict:
    return await dashboard(month)


@app.get("/api/v1/live")
async def live(month: str | None = None, _user: dict = Depends(get_current_user)):
    async def stream():
        event = subscribe()
        try:
            current = await dashboard(month)
            yield f"data: {json.dumps(current, default=str)}\n\n"
            while True:
                try:
                    await asyncio.wait_for(event.wait(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                    continue
                event.clear()
                payload = await dashboard(month)
                yield f"data: {json.dumps(payload, default=str)}\n\n"
        finally:
            unsubscribe(event)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/v1/sync")
async def sync_now(_admin: dict = Depends(require_admin)) -> dict:
    if db() is None:
        raise HTTPException(status_code=503, detail="MONGODB_NOT_CONFIGURED")
    asyncio.create_task(run_sync())
    return {"started": True}


@app.get("/api/v1/settings")
async def read_settings(_user: dict = Depends(get_current_user)) -> dict:
    doc = await settings_doc()
    doc.pop("_id", None)
    return doc


@app.put("/api/v1/settings")
async def write_settings(body: SettingsPatch, _admin: dict = Depends(require_admin)) -> dict:
    return await save_settings(body.model_dump(exclude_none=True))


@app.get("/api/v1/targets")
async def read_targets(_user: dict = Depends(get_current_user)) -> dict:
    database = require_db()
    rows = await database["marketing_os_targets"].find({}).to_list(length=200)
    for row in rows:
        row.pop("_id", None)
    return {"items": rows}


@app.put("/api/v1/targets")
async def write_targets(body: list[TargetRow], _admin: dict = Depends(require_admin)) -> dict:
    await replace_targets([row.model_dump() for row in body])
    return {"ok": True}


@app.get("/api/v1/budgets")
async def read_budgets(month: str | None = None, _user: dict = Depends(get_current_user)) -> dict:
    database = require_db()
    query = {"month": month} if month else {}
    rows = await database["marketing_os_budgets"].find(query).sort("month", 1).to_list(length=200)
    for row in rows:
        row.pop("_id", None)
    return {"items": rows}


@app.put("/api/v1/budgets")
async def write_budgets(body: list[BudgetRow], _admin: dict = Depends(require_admin)) -> dict:
    await replace_budgets([row.model_dump() for row in body])
    return {"ok": True}


@app.get("/api/v1/connectors")
async def read_connectors(_user: dict = Depends(get_current_user)) -> dict:
    database = require_db()
    rows = await database["marketing_os_connectors"].find({}).to_list(length=20)
    site = await database["marketing_os_site"].find_one({"_id": "current"}) or {}
    for row in rows:
        row.pop("_id", None)
    site.pop("_id", None)
    return {"connectors": rows, "site": site}
