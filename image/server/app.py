from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Annotated
from urllib.parse import unquote

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from core.backgrounds import BackgroundStore, background_asset_url
from core.config import Settings, get_settings
from core.db import connect_mongo, ensure_indexes, mongo_health
from core.importers import ImportService
from core.system_settings import (
    SystemSettingsStore,
    UpdateSystemSettingsRequest,
    runtime_info,
    slugify_background_id,
)
from core.models import (
    ApplyBackgroundRequest,
    BatchStatus,
    ChangeOutputBackgroundRequest,
    FinalizeBatchRequest,
    GoogleDriveImportRequest,
    ImportSource,
    ItemStatus,
    LocalImportResponse,
    RenameItemRequest,
    S3ImportRequest,
)
from core.processor import ImageProcessor
from core.repository import ImageRepository
from core.storage import StorageBackend, sanitize_storage_name

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("image-service")

settings: Settings = get_settings()
storage = StorageBackend(settings)
mongo_db = None
repository: ImageRepository | None = None
system_settings_store: SystemSettingsStore | None = None
processor: ImageProcessor | None = None
importer: ImportService | None = None
background_store: BackgroundStore | None = None


def _require_repo() -> ImageRepository:
    if repository is None:
        raise HTTPException(status_code=503, detail="MONGODB_NOT_CONFIGURED")
    return repository


def _require_settings_store() -> SystemSettingsStore:
    if system_settings_store is None:
        raise HTTPException(status_code=503, detail="MONGODB_NOT_CONFIGURED")
    return system_settings_store


def _require_background_store() -> BackgroundStore:
    if background_store is None:
        raise HTTPException(status_code=503, detail="MONGODB_NOT_CONFIGURED")
    return background_store


def _runtime() -> dict:
    return runtime_info(settings, storage.s3_enabled, mongo_health(mongo_db).get("ok", False))


def _sync_processor_from_settings() -> None:
    if processor is not None:
        processor.set_subject_fill_ratio(_require_settings_store().get().subject_fill_ratio)


def _default_background_id() -> str:
    return _require_settings_store().get().default_background_id


def _auto_process_enabled(query_override: bool | None = None) -> bool:
    if query_override is not None:
        return query_override
    return _require_settings_store().get().auto_process_on_import


app = FastAPI(
    title="Lorenzo Image Service",
    version="1.0.0",
    description="Image import, processing, review, and output management API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _batch_or_404(batch_id: str):
    batch = _require_repo().get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="BATCH_NOT_FOUND")
    return batch


def _item_or_404(item_id: str):
    item = _require_repo().get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="ITEM_NOT_FOUND")
    return item


def _batch_background_id(batch) -> str:
    return batch.default_background_id or _default_background_id()


async def _render_item_final(item, batch_id: str, background_id: str) -> None:
    if not item.processed_key:
        raise ValueError("Item has no processed cutout")
    bg_bytes = _require_background_store().get_bytes(background_id)
    final_key = storage.final_key(
        batch_id,
        item.id,
        f"{item.display_name}.jpg",
        background_id,
    )
    final_url = await asyncio.to_thread(
        processor.render_final,
        item.processed_key,
        final_key,
        bg_bytes,
        f"{item.display_name}.jpg",
    )
    item.background_id = background_id
    item.final_key = final_key
    item.final_url = final_url


async def _process_batch(batch_id: str) -> None:
    batch = _batch_or_404(batch_id)
    batch.status = BatchStatus.PROCESSING
    _require_repo().save_batch(batch)

    bg_id = _batch_background_id(batch)
    items = _require_repo().list_items(batch_id)
    failed = 0
    for item in items:
        try:
            item.status = ItemStatus.PROCESSING
            _require_repo().save_item(item)
            processed_key = storage.processed_key(batch_id, item.id)
            processed_url = await asyncio.to_thread(
                processor.process_original,
                item.original_key,
                processed_key,
            )
            item.processed_key = processed_key
            item.processed_url = processed_url
            await _render_item_final(item, batch_id, bg_id)
            item.status = ItemStatus.PROCESSED
            item.error = None
            _require_repo().save_item(item)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed processing item %s", item.id)
            item.status = ItemStatus.FAILED
            item.error = str(exc)
            _require_repo().save_item(item)
            failed += 1

    batch.status = BatchStatus.REVIEW if failed < len(items) else BatchStatus.FAILED
    _require_repo().save_batch(batch)


async def _apply_backgrounds(batch_id: str, payload: ApplyBackgroundRequest) -> None:
    batch = _batch_or_404(batch_id)
    default_bg = payload.default_background_id or batch.default_background_id or _default_background_id()
    batch.default_background_id = default_bg
    batch.status = BatchStatus.BACKGROUND
    _require_repo().save_batch(batch)

    bg_store = _require_background_store()
    items = _require_repo().list_items(batch_id)

    for item in items:
        if item.status not in {ItemStatus.PROCESSED, ItemStatus.REVIEWED, ItemStatus.BACKGROUND_APPLIED}:
            continue
        if not item.processed_key:
            continue
        try:
            bg_id = payload.overrides.get(item.id, default_bg)
            bg_bytes = bg_store.get_bytes(bg_id)
            final_key = storage.final_key(
                batch_id,
                item.id,
                f"{item.display_name}.jpg",
                bg_id,
            )
            final_url = await asyncio.to_thread(
                processor.render_final,
                item.processed_key,
                final_key,
                bg_bytes,
                f"{item.display_name}.jpg",
            )
            item.background_id = bg_id
            item.final_key = final_key
            item.final_url = final_url
            item.status = ItemStatus.BACKGROUND_APPLIED
            _require_repo().save_item(item)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed background for item %s", item.id)
            item.status = ItemStatus.FAILED
            item.error = str(exc)
            _require_repo().save_item(item)


@app.on_event("startup")
async def startup() -> None:
    global mongo_db, repository, system_settings_store, processor, importer, background_store

    if not settings.mongodb_uri:
        logger.error("MONGODB_URI is not set — Image metadata API will return 503")
        return

    try:
        mongo_db = connect_mongo(settings)
        ensure_indexes(mongo_db)
        repository = ImageRepository(mongo_db)
        system_settings_store = SystemSettingsStore(mongo_db)
        background_store = BackgroundStore(settings, storage, mongo_db)
        processor = ImageProcessor(
            settings,
            storage,
            subject_fill_ratio=system_settings_store.get().subject_fill_ratio,
        )
        importer = ImportService(settings, storage, repository)
        seeded = background_store.seed_bundled_defaults()
        if seeded:
            logger.info("Seeded %s background template(s) to shared storage", seeded)
        logger.info("Image service ready (MongoDB=%s)", settings.image_mongodb_db)
    except Exception:
        logger.exception("Failed to connect to MongoDB")
        mongo_db = None
        repository = None
        system_settings_store = None
        background_store = None
        processor = None
        importer = None


@app.get("/health")
async def health() -> dict:
    mongo = mongo_health(mongo_db)
    return {
        "ok": mongo.get("ok", False) and repository is not None,
        "s3_enabled": storage.s3_enabled,
        "mongodb": mongo,
        "mongodb_db": settings.image_mongodb_db,
        "output_size": [settings.image_output_width, settings.image_output_height],
    }


@app.get("/api/v1/settings")
async def get_system_settings() -> dict:
    sys_settings = _require_settings_store().get()
    return {
        "settings": sys_settings.model_dump(mode="json"),
        "backgrounds": _require_background_store().list_all(sys_settings.default_background_id),
        "runtime": _runtime(),
    }


@app.patch("/api/v1/settings")
async def update_system_settings(payload: UpdateSystemSettingsRequest) -> dict:
    if payload.default_background_id:
        try:
            _require_background_store().ensure_exists(payload.default_background_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=400, detail="INVALID_BACKGROUND") from exc
    updated = _require_settings_store().update(payload)
    _sync_processor_from_settings()
    return {
        "settings": updated.model_dump(mode="json"),
        "backgrounds": _require_background_store().list_all(updated.default_background_id),
        "runtime": _runtime(),
    }


@app.post("/api/v1/settings/backgrounds")
async def upload_background(
    file: Annotated[UploadFile, File(...)],
    background_id: str | None = None,
    display_name: str | None = None,
) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="NO_FILE")
    raw_id = background_id or display_name or Path(file.filename).stem
    bg_id = slugify_background_id(raw_id)
    suffix = Path(file.filename).suffix or ".jpg"
    data = await file.read()
    label = display_name or bg_id.replace("-", " ").title()
    _require_background_store().save_upload(bg_id, label, data, suffix)
    sys_settings = _require_settings_store().get()
    return {
        "background": {
            "id": bg_id,
            "name": label,
            "preview_url": background_asset_url(bg_id),
            "is_default": bg_id == sys_settings.default_background_id,
        },
        "backgrounds": _require_background_store().list_all(sys_settings.default_background_id),
    }


@app.get("/api/v1/backgrounds")
async def get_backgrounds() -> dict:
    return {"backgrounds": _require_background_store().list_all(_default_background_id())}


@app.get("/api/v1/batches")
async def list_batches() -> dict:
    batches = _require_repo().list_batches()
    return {"batches": [b.model_dump(mode="json") for b in batches]}


@app.get("/api/v1/batches/{batch_id}")
async def get_batch(batch_id: str) -> dict:
    batch = _batch_or_404(batch_id)
    items = _require_repo().list_items(batch_id)
    return {
        "batch": batch.model_dump(mode="json"),
        "items": [i.model_dump(mode="json") for i in items],
    }


@app.post("/api/v1/import/local", response_model=LocalImportResponse)
async def import_local(
    background_tasks: BackgroundTasks,
    files: Annotated[list[UploadFile], File(...)],
    batch_name: str | None = None,
    auto_process: bool = Query(default=True),
) -> LocalImportResponse:
    if not files:
        raise HTTPException(status_code=400, detail="NO_FILES")

    if importer is None:
        raise HTTPException(status_code=503, detail="MONGODB_NOT_CONFIGURED")

    batch = importer.create_batch(
        name=batch_name or f"Local import {len(files)} file(s)",
        source=ImportSource.LOCAL,
        default_background_id=_default_background_id(),
    )
    payload: list[tuple[str, bytes]] = []
    for upload in files:
        content = await upload.read()
        filename = upload.filename or "image.jpg"
        payload.append((filename, content))

    created = importer.add_local_files(batch, payload)
    if not created:
        raise HTTPException(status_code=400, detail="NO_IMAGE_FILES")

    if _auto_process_enabled(auto_process):
        background_tasks.add_task(_process_batch, batch.id)

    return LocalImportResponse(batch_id=batch.id, item_count=len(created))


@app.post("/api/v1/import/s3")
async def import_s3(payload: S3ImportRequest, background_tasks: BackgroundTasks) -> dict:
    if not payload.keys and not payload.prefix:
        raise HTTPException(status_code=400, detail="S3_KEYS_OR_PREFIX_REQUIRED")
    if not storage.s3_enabled:
        raise HTTPException(status_code=400, detail="S3_NOT_CONFIGURED")

    if importer is None:
        raise HTTPException(status_code=503, detail="MONGODB_NOT_CONFIGURED")

    batch = importer.create_batch(
        name=payload.batch_name or "S3 import",
        source=ImportSource.S3,
        metadata={"prefix": payload.prefix, "keys": payload.keys},
        default_background_id=_default_background_id(),
    )
    if payload.prefix:
        created = importer.import_from_s3_prefix(batch, payload.prefix)
    else:
        created = importer.import_from_s3_keys(batch, payload.keys)

    if not created:
        raise HTTPException(status_code=400, detail="NO_IMAGE_FILES")

    if _auto_process_enabled(True):
        background_tasks.add_task(_process_batch, batch.id)
    return {"batch_id": batch.id, "item_count": len(created)}


@app.post("/api/v1/import/google-drive")
async def import_google_drive(
    payload: GoogleDriveImportRequest,
    background_tasks: BackgroundTasks,
) -> dict:
    if not payload.file_ids and not payload.folder_id:
        raise HTTPException(status_code=400, detail="DRIVE_FILE_OR_FOLDER_REQUIRED")

    if importer is None:
        raise HTTPException(status_code=503, detail="MONGODB_NOT_CONFIGURED")

    batch = importer.create_batch(
        name=payload.batch_name or "Google Drive import",
        source=ImportSource.GOOGLE_DRIVE,
        metadata={"folder_id": payload.folder_id, "file_ids": payload.file_ids},
        default_background_id=_default_background_id(),
    )
    try:
        created = importer.import_from_google_drive(
            batch,
            file_ids=payload.file_ids,
            folder_id=payload.folder_id,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not created:
        raise HTTPException(status_code=400, detail="NO_IMAGE_FILES")

    if _auto_process_enabled(True):
        background_tasks.add_task(_process_batch, batch.id)
    return {"batch_id": batch.id, "item_count": len(created)}


@app.post("/api/v1/batches/{batch_id}/process")
async def process_batch(batch_id: str, background_tasks: BackgroundTasks) -> dict:
    _batch_or_404(batch_id)
    background_tasks.add_task(_process_batch, batch_id)
    return {"ok": True, "batch_id": batch_id, "status": "processing"}


@app.patch("/api/v1/items/{item_id}")
async def rename_item(item_id: str, payload: RenameItemRequest) -> dict:
    item = _item_or_404(item_id)
    name = payload.display_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="INVALID_NAME")
    item.display_name = name
    if item.status == ItemStatus.PROCESSED:
        item.status = ItemStatus.REVIEWED
    _require_repo().save_item(item)
    return {"item": item.model_dump(mode="json")}


@app.post("/api/v1/items/{item_id}/reprocess")
async def reprocess_item(item_id: str, background_tasks: BackgroundTasks) -> dict:
    item = _item_or_404(item_id)

    async def _run() -> None:
        try:
            batch = _batch_or_404(item.batch_id)
            item.status = ItemStatus.PROCESSING
            _require_repo().save_item(item)
            processed_key = storage.processed_key(item.batch_id, item.id)
            processed_url = await asyncio.to_thread(
                processor.process_original,
                item.original_key,
                processed_key,
            )
            item.processed_key = processed_key
            item.processed_url = processed_url
            await _render_item_final(item, item.batch_id, _batch_background_id(batch))
            item.status = ItemStatus.PROCESSED
            item.error = None
            _require_repo().save_item(item)
        except Exception as exc:  # noqa: BLE001
            item.status = ItemStatus.FAILED
            item.error = str(exc)
            _require_repo().save_item(item)

    background_tasks.add_task(_run)
    return {"ok": True, "item_id": item_id}


@app.post("/api/v1/batches/{batch_id}/apply-background")
async def apply_background(batch_id: str, payload: ApplyBackgroundRequest) -> dict:
    _batch_or_404(batch_id)
    await _apply_backgrounds(batch_id, payload)
    batch = _batch_or_404(batch_id)
    items = _require_repo().list_items(batch_id)
    return {
        "batch": batch.model_dump(mode="json"),
        "items": [i.model_dump(mode="json") for i in items],
    }


@app.post("/api/v1/batches/{batch_id}/finalize")
async def finalize_batch(batch_id: str, payload: FinalizeBatchRequest) -> dict:
    if not payload.confirm:
        raise HTTPException(status_code=400, detail="CONFIRM_REQUIRED")

    batch = _batch_or_404(batch_id)
    items = _require_repo().list_items(batch_id)
    ready_statuses = {
        ItemStatus.PROCESSED,
        ItemStatus.REVIEWED,
        ItemStatus.BACKGROUND_APPLIED,
    }
    outputs = []
    for item in items:
        if item.status not in ready_statuses or not item.final_url:
            continue
        item.status = ItemStatus.FINALIZED
        _require_repo().save_item(item)
        outputs.append(_require_repo().upsert_output(item, batch).model_dump(mode="json"))

    batch.status = BatchStatus.FINALIZED
    _require_repo().save_batch(batch)
    return {"batch": batch.model_dump(mode="json"), "outputs": outputs}


def _enrich_output_row(row):
    payload = row.model_dump(mode="json")
    if not payload.get("background_id"):
        item = _require_repo().get_item(row.item_id)
        if item and item.background_id:
            payload["background_id"] = item.background_id
    return payload


@app.get("/api/v1/outputs")
async def list_outputs(
    batch_id: str | None = None,
    status: ItemStatus | None = None,
    file_name: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    rows = _require_repo().list_outputs(batch_id=batch_id, status=status, file_name=file_name)
    page = rows[offset : offset + limit]
    return {
        "items": [_enrich_output_row(row) for row in page],
        "total": len(rows),
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < len(rows),
    }


def _resolve_cutout_key(item) -> str:
    if item.processed_key:
        return item.processed_key
    candidate = storage.processed_key(item.batch_id, item.id)
    if storage.exists(candidate):
        return candidate
    if not item.original_key:
        raise HTTPException(status_code=400, detail="NO_PROCESSED_IMAGE")
    return candidate


@app.post("/api/v1/outputs/{item_id}/background")
async def change_output_background(item_id: str, payload: ChangeOutputBackgroundRequest) -> dict:
    item = _item_or_404(item_id)
    batch = _batch_or_404(item.batch_id)
    bg_id = payload.background_id.strip()
    if not bg_id:
        raise HTTPException(status_code=400, detail="INVALID_BACKGROUND")

    bg_bytes = _require_background_store().get_bytes(bg_id)
    final_key = storage.final_key(
        item.batch_id,
        item.id,
        f"{item.display_name}.jpg",
        bg_id,
    )

    try:
        cutout_key = _resolve_cutout_key(item)
        if storage.exists(cutout_key):
            item.processed_key = cutout_key
            item.processed_url = storage.public_url(cutout_key)
        else:
            item.processed_url = await asyncio.to_thread(
                processor.process_original,
                item.original_key,
                cutout_key,
            )
            item.processed_key = cutout_key

        final_url = await asyncio.to_thread(
            processor.render_final,
            cutout_key,
            final_key,
            bg_bytes,
            f"{item.display_name}.jpg",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to change background for output %s", item_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    item.background_id = bg_id
    item.final_key = final_key
    item.final_url = final_url
    item.status = ItemStatus.FINALIZED
    item.error = None
    _require_repo().save_item(item)
    output = _require_repo().upsert_output(item, batch)
    return {
        "output": _enrich_output_row(output),
        "item": item.model_dump(mode="json"),
    }


def _storage_keys_for_item(item) -> list[str]:
    keys: list[str] = []
    for key in (item.original_key, item.processed_key, item.final_key):
        if key and key not in keys:
            keys.append(key)

    stem = sanitize_storage_name(item.display_name)
    final_prefix = f"{storage.final_prefix(item.batch_id)}/"
    for key in storage.list_keys(final_prefix):
        name = Path(key).name
        if name.startswith(f"{stem}__") and name.endswith(".jpg"):
            if key not in keys:
                keys.append(key)
    return keys


@app.delete("/api/v1/outputs/{item_id}")
async def delete_output(item_id: str) -> dict:
    item = _item_or_404(item_id)
    if not _require_repo().delete_output(item_id):
        raise HTTPException(status_code=404, detail="OUTPUT_NOT_FOUND")

    deleted_keys: list[str] = []
    for key in _storage_keys_for_item(item):
        storage.delete_key(key)
        deleted_keys.append(key)

    _require_repo().delete_item(item_id)
    return {"ok": True, "id": item_id, "deleted_keys": deleted_keys}


@app.get("/api/v1/files/{file_path:path}")
async def get_file(file_path: str) -> Response:
    key = unquote(file_path)
    try:
        data = storage.get_bytes(key)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="FILE_NOT_FOUND") from exc

    content_type = storage.guess_content_type(key)
    return Response(content=data, media_type=content_type)


@app.get("/api/v1/assets/backgrounds/{background_id}")
async def get_background_asset(background_id: str) -> Response:
    store = _require_background_store()
    try:
        data = store.get_bytes(background_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="BACKGROUND_NOT_FOUND") from exc
    return Response(content=data, media_type=store.get_content_type(background_id))
