from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core import runtime

from core.auth import get_current_user, require_admin
from core.config import get_settings
from core.connectors import connect_tiktok, tiktok_connect_url
from core.db import close, connect, db, ensure_indexes, require_db
from core.importer import load_workbook_rows
from core.store import (
    complete_budget_rows,
    dashboard,
    rebuild_if_stale,
    replace_budgets,
    replace_targets,
    save_settings,
    seed_if_empty,
    settings_doc,
    subscribe,
    unsubscribe,
)
from core.insight import overview, report
from core.operating import (
    create_campaign,
    create_content,
    create_initiative,
    delete_campaign,
    delete_content,
    delete_initiative,
    get_asset,
    list_assets,
    list_campaigns,
    list_content,
    list_initiatives,
    list_people,
    search,
    seed_initiatives,
    update_campaign,
    update_content,
    update_initiative,
)
from core.timeline import (
    add_time_log,
    create_activity,
    create_lane,
    delete_activity,
    delete_lane,
    ensure_lanes,
    get_activity,
    get_timeline,
    reorder_lanes,
    timer,
    update_activity,
    update_lane,
    update_time_log,
)
from core.sync import run_sync, sync_loop
from core.work import archive_work, create_work, list_work, log_round, restore_work, update_work


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


class WorkWrite(BaseModel):
    title: str
    kind: str = "task"
    repeat: str = "once"
    owner: str = ""
    stage: str = "Queued"
    started_on: str = ""
    deadline: str | None = None
    hours: float | None = None
    cost_aed: float | None = None
    note: str = ""
    priority: str = "Medium"
    blocker: str = ""
    link_type: str | None = None
    link_id: str | None = None
    today: str | None = None


class ContentKpi(BaseModel):
    views: float | None = None
    likes: float | None = None
    comments: float | None = None
    clicks: float | None = None
    leads: float | None = None


class ContentWrite(BaseModel):
    title: str | None = None
    status: str | None = None
    publish_date: str | None = None
    due_date: str | None = None
    channels: list[str] | None = None
    format: str | None = None
    pillar: str | None = None
    hero_product: str | None = None
    owner: str | None = None
    campaign_id: str | None = None
    mode: str | None = None
    caption: str | None = None
    brief: str | None = None
    assets: list[str] | None = None
    content_link: str | None = None
    kpi: ContentKpi | None = None


class CampaignWrite(BaseModel):
    name: str | None = None
    objective: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    color: str | None = None
    channels: list[str] | None = None
    is_critical: bool | None = None
    mode: str | None = None
    budget_aed: float | None = None
    owner: str | None = None
    state: str | None = None
    landing_url: str | None = None
    creatives: list[str] | None = None
    kpi_target: str | None = None
    results: str | None = None


class InitiativeFile(BaseModel):
    label: str = ""
    url: str


class InitiativeWrite(BaseModel):
    name: str | None = None
    owner: str | None = None
    priority: str | None = None
    deadline: str | None = None
    status: str | None = None
    budget_aed: float | None = None
    spent_aed: float | None = None
    blockers: str | None = None
    files: list[InitiativeFile] | None = None
    notes: str | None = None


class ContributorWrite(BaseModel):
    person: str
    start: str | None = None
    end: str | None = None
    active: bool | None = None


class LaneWrite(BaseModel):
    name: str | None = None
    owner: str | None = None
    color: str | None = None
    group: str | None = None


class LaneCreate(BaseModel):
    name: str
    owner: str | None = None
    color: str | None = None
    group: str | None = None


class LaneOrder(BaseModel):
    ids: list[str]


class ActivityWrite(BaseModel):
    lane_id: str | None = None
    title: str | None = None
    start: str | None = None
    end: str | None = None
    deadline: str | None = None
    status: str | None = None
    priority: str | None = None
    progress: float | None = None
    owner: str | None = None
    reviewer: str | None = None
    contributors: list[ContributorWrite] | None = None
    link_type: str | None = None
    link_id: str | None = None
    color: str | None = None
    expected_updated_at: str | None = None


class TimeLogWrite(BaseModel):
    person: str | None = None
    started_at: str | None = None
    ended_at: str | None = None
    minutes: float | None = None
    note: str | None = None


class TimerWrite(BaseModel):
    person: str
    action: str


def _set(body: BaseModel) -> dict:
    """Only the keys the client sent. A sent null clears the value."""
    return body.model_dump(exclude_unset=True)


class WorkDay(BaseModel):
    today: str | None = None


class TikTokCode(BaseModel):
    auth_code: str
    state: str | None = None


log = logging.getLogger("uvicorn.error")

_STARTING = b'{"detail":"STARTING"}'


class ReadyMiddleware:
    """Answer data calls while boot is still running, without holding the socket shut."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not runtime.blocks_until_ready(scope.get("path") or ""):
            await self.app(scope, receive, send)
            return
        await send(
            {
                "type": "http.response.start",
                "status": 503,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(_STARTING)).encode()),
                    (b"retry-after", b"1"),
                    (b"cache-control", b"no-store"),
                ],
            }
        )
        await send({"type": "http.response.body", "body": _STARTING})


async def _boot() -> None:
    await connect()
    # The page can read data that is already stored. Index checks and catalog
    # fills are maintenance; they must not hold the first screen.
    runtime.ready = True
    log.info("marketing api ready")
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
                log.exception("workbook import failed")
    if database is not None:
        await seed_initiatives()
        await ensure_lanes()
        await rebuild_if_stale()
    log.info("marketing catalog checked")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    runtime.ready = False
    runtime.failed = False
    sync_task: asyncio.Task | None = None

    async def boot() -> None:
        nonlocal sync_task
        try:
            await _boot()
            sync_task = asyncio.create_task(sync_loop())
        except asyncio.CancelledError:
            raise
        except Exception:
            runtime.failed = True
            log.exception("marketing api failed to start")

    boot_task = asyncio.create_task(boot())
    try:
        yield
    finally:
        boot_task.cancel()
        await asyncio.gather(boot_task, return_exceptions=True)
        if sync_task is not None:
            sync_task.cancel()
            await asyncio.gather(sync_task, return_exceptions=True)
        await close()


app = FastAPI(title="Lorenzo Marketing API", version="1.0.0", lifespan=lifespan)
settings = get_settings()
app.add_middleware(ReadyMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "mongo": db() is not None, "ready": runtime.ready}


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


@app.get("/api/v1/tiktok/oauth")
async def tiktok_oauth_url(_admin: dict = Depends(require_admin)) -> dict:
    url = await tiktok_connect_url(get_settings())
    if not url:
        return {"url": None, "detail": "TIKTOK_APP_ID and TIKTOK_APP_SECRET are not set."}
    return {"url": url}


@app.post("/api/v1/tiktok/oauth")
async def tiktok_oauth_finish(body: TikTokCode, _admin: dict = Depends(require_admin)) -> dict:
    try:
        return await connect_tiktok(get_settings(), body.auth_code.strip(), (body.state or "").strip() or None)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/v1/sync")
async def sync_now(_admin: dict = Depends(require_admin)) -> dict:
    if db() is None:
        raise HTTPException(status_code=503, detail="MONGODB_NOT_CONFIGURED")
    return await run_sync()


@app.get("/api/v1/settings")
async def read_settings(_user: dict = Depends(get_current_user)) -> dict:
    doc = await settings_doc()
    doc.pop("_id", None)
    for key in ("access_token", "secret", "state", "tiktok_access_token", "app_secret"):
        doc.pop(key, None)
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
    rows = await database["marketing_os_budgets"].find(query).sort("month", 1).to_list(length=500)
    return {"items": complete_budget_rows(rows)}


@app.put("/api/v1/budgets")
async def write_budgets(body: list[BudgetRow], _admin: dict = Depends(require_admin)) -> dict:
    await replace_budgets([row.model_dump() for row in body])
    return {"ok": True}


@app.get("/api/v1/work")
async def read_work(_user: dict = Depends(get_current_user)) -> dict:
    return await list_work()


@app.post("/api/v1/work")
async def add_work(body: WorkWrite, _user: dict = Depends(get_current_user)) -> dict:
    return await create_work(body.model_dump())


@app.put("/api/v1/work/{work_id}")
async def edit_work(work_id: str, body: WorkWrite, _user: dict = Depends(get_current_user)) -> dict:
    return await update_work(work_id, body.model_dump())


@app.post("/api/v1/work/{work_id}/archive")
async def close_work(work_id: str, body: WorkDay, _user: dict = Depends(get_current_user)) -> dict:
    return await archive_work(work_id, body.today)


@app.post("/api/v1/work/{work_id}/round")
async def finish_round(work_id: str, body: WorkDay, _user: dict = Depends(get_current_user)) -> dict:
    return await log_round(work_id, body.today)


@app.post("/api/v1/work/{work_id}/restore")
async def reopen_work(work_id: str, _user: dict = Depends(get_current_user)) -> dict:
    return await restore_work(work_id)


@app.get("/api/v1/overview")
async def read_overview(_user: dict = Depends(get_current_user)) -> dict:
    require_db()
    return await overview()


@app.get("/api/v1/report")
async def read_report(start: str, end: str, _user: dict = Depends(get_current_user)) -> dict:
    require_db()
    return await report(start, end)


@app.get("/api/v1/content")
async def read_content(start: str | None = None, end: str | None = None, _user: dict = Depends(get_current_user)) -> dict:
    return await list_content(start, end)


@app.post("/api/v1/content")
async def add_content(body: ContentWrite, user: dict = Depends(get_current_user)) -> dict:
    return await create_content(_set(body), user["id"])


@app.patch("/api/v1/content/{item_id}")
async def edit_content(item_id: str, body: ContentWrite, user: dict = Depends(get_current_user)) -> dict:
    return await update_content(item_id, _set(body), user["id"])


@app.delete("/api/v1/content/{item_id}")
async def remove_content(item_id: str, _admin: dict = Depends(require_admin)) -> dict:
    return await delete_content(item_id)


@app.get("/api/v1/campaigns")
async def read_campaigns(_user: dict = Depends(get_current_user)) -> dict:
    return await list_campaigns()


@app.post("/api/v1/campaigns")
async def add_campaign(body: CampaignWrite, user: dict = Depends(get_current_user)) -> dict:
    return await create_campaign(_set(body), user["id"])


@app.patch("/api/v1/campaigns/{campaign_id}")
async def edit_campaign(campaign_id: str, body: CampaignWrite, user: dict = Depends(get_current_user)) -> dict:
    return await update_campaign(campaign_id, _set(body), user["id"])


@app.delete("/api/v1/campaigns/{campaign_id}")
async def remove_campaign(campaign_id: str, _admin: dict = Depends(require_admin)) -> dict:
    return await delete_campaign(campaign_id)


@app.get("/api/v1/initiatives")
async def read_initiatives(_user: dict = Depends(get_current_user)) -> dict:
    return await list_initiatives()


@app.post("/api/v1/initiatives")
async def add_initiative(body: InitiativeWrite, user: dict = Depends(get_current_user)) -> dict:
    return await create_initiative(_set(body), user["id"])


@app.patch("/api/v1/initiatives/{initiative_id}")
async def edit_initiative(initiative_id: str, body: InitiativeWrite, user: dict = Depends(get_current_user)) -> dict:
    return await update_initiative(initiative_id, _set(body), user["id"])


@app.delete("/api/v1/initiatives/{initiative_id}")
async def remove_initiative(initiative_id: str, _admin: dict = Depends(require_admin)) -> dict:
    return await delete_initiative(initiative_id)


@app.get("/api/v1/people")
async def read_people(_user: dict = Depends(get_current_user)) -> dict:
    return await list_people()


@app.get("/api/v1/assets")
async def read_assets(
    q: str | None = None,
    category: str | None = None,
    skip: int = 0,
    limit: int = 36,
    _user: dict = Depends(get_current_user),
) -> dict:
    return await list_assets(q, category, skip, limit)


@app.get("/api/v1/assets/{asset_id}")
async def read_asset(asset_id: str, _user: dict = Depends(get_current_user)) -> dict:
    return await get_asset(asset_id)


@app.get("/api/v1/search")
async def read_search(q: str = "", _user: dict = Depends(get_current_user)) -> dict:
    return await search(q)


@app.get("/api/v1/timeline")
async def read_timeline(_user: dict = Depends(get_current_user)) -> dict:
    return await get_timeline()


@app.get("/api/v1/timeline/live")
async def timeline_live(_user: dict = Depends(get_current_user)):
    async def stream():
        event = subscribe()
        try:
            current = await get_timeline()
            yield f"data: {json.dumps(current, default=str)}\n\n"
            while True:
                try:
                    await asyncio.wait_for(event.wait(), timeout=20)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                    continue
                event.clear()
                payload = await get_timeline()
                yield f"data: {json.dumps(payload, default=str)}\n\n"
        finally:
            unsubscribe(event)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/v1/timeline/lanes")
async def add_lane(body: LaneCreate, admin: dict = Depends(require_admin)) -> dict:
    return await create_lane(_set(body), admin["id"])


@app.put("/api/v1/timeline/lanes/order")
async def order_lanes(body: LaneOrder, _admin: dict = Depends(require_admin)) -> dict:
    return await reorder_lanes(body.ids)


@app.patch("/api/v1/timeline/lanes/{lane_id}")
async def edit_lane(lane_id: str, body: LaneWrite, admin: dict = Depends(require_admin)) -> dict:
    return await update_lane(lane_id, _set(body), admin["id"])


@app.delete("/api/v1/timeline/lanes/{lane_id}")
async def remove_lane(lane_id: str, _admin: dict = Depends(require_admin)) -> dict:
    return await delete_lane(lane_id)


@app.post("/api/v1/timeline/activities")
async def add_activity(body: ActivityWrite, user: dict = Depends(get_current_user)) -> dict:
    return await create_activity(_set(body), user["id"])


@app.get("/api/v1/timeline/activities/{activity_id}")
async def read_activity(activity_id: str, _user: dict = Depends(get_current_user)) -> dict:
    return await get_activity(activity_id)


@app.patch("/api/v1/timeline/activities/{activity_id}")
async def edit_activity(activity_id: str, body: ActivityWrite, user: dict = Depends(get_current_user)) -> dict:
    return await update_activity(activity_id, _set(body), user["id"])


@app.delete("/api/v1/timeline/activities/{activity_id}")
async def remove_activity(activity_id: str, _user: dict = Depends(get_current_user)) -> dict:
    return await delete_activity(activity_id)


@app.post("/api/v1/timeline/activities/{activity_id}/logs")
async def add_activity_log(activity_id: str, body: TimeLogWrite, user: dict = Depends(get_current_user)) -> dict:
    return await add_time_log(activity_id, _set(body), user["id"])


@app.patch("/api/v1/timeline/logs/{log_id}")
async def edit_activity_log(log_id: str, body: TimeLogWrite, user: dict = Depends(get_current_user)) -> dict:
    return await update_time_log(log_id, _set(body), user["id"])


@app.post("/api/v1/timeline/activities/{activity_id}/timer")
async def activity_timer(activity_id: str, body: TimerWrite, user: dict = Depends(get_current_user)) -> dict:
    return await timer(activity_id, body.action, body.person, user["id"])


@app.get("/api/v1/connectors")
async def read_connectors(_user: dict = Depends(get_current_user)) -> dict:
    database = require_db()
    rows = await database["marketing_os_connectors"].find({}).to_list(length=20)
    site = await database["marketing_os_site"].find_one({"_id": "current"}) or {}
    for row in rows:
        row.pop("_id", None)
    site.pop("_id", None)
    return {"connectors": rows, "site": site}
