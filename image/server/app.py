from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import logging
import time
import urllib.request
from pathlib import Path
from typing import Annotated
from urllib.parse import unquote, urlparse

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image

from core.backgrounds import BackgroundStore, background_asset_url
from core.config import Settings, get_settings
from core.db import connect_mongo, ensure_indexes, mongo_health
from core.importers import ImportService
from core.runtime_info import runtime_info
from core.system_settings import (
    SystemSettingsStore,
    UpdateSystemSettingsRequest,
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
    utc_now,
)
from core.recovery import item_needs_processing, recover_interrupted_jobs
from core.processor import ImageProcessor, WatermarkConfig
from core.cutout.base import EngineConfig
from core.progress import STAGE_LABELS, registry as progress_registry, stage_percent
from core.rembg_config import rembg_config_from_system, rembg_meta_dict
from core.rembg_pool import pool_loaded_model, run_engine, warmup_worker
from core.renditions import RenditionSpec, build_transparent_renditions
from core.repository import ImageRepository
from core.storage import StorageBackend, sanitize_storage_name
from core.watermarks import WatermarkStore

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
watermark_store: WatermarkStore | None = None


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


def _require_watermark_store() -> WatermarkStore:
    if watermark_store is None:
        raise HTTPException(status_code=503, detail="MONGODB_NOT_CONFIGURED")
    return watermark_store


def _watermark_config() -> WatermarkConfig:
    sys_settings = _require_settings_store().get()
    return WatermarkConfig(
        enabled=sys_settings.watermark_enabled,
        scale=sys_settings.watermark_scale,
        opacity=sys_settings.watermark_opacity,
        bottom_margin_px=sys_settings.watermark_bottom_margin_px,
    )


def _watermark_render_kwargs() -> dict:
    config = _watermark_config()
    if not config.enabled:
        return {"watermark_bytes": None, "watermark_config": config}
    try:
        return {
            "watermark_bytes": _require_watermark_store().get_bytes(),
            "watermark_config": config,
        }
    except FileNotFoundError:
        return {"watermark_bytes": None, "watermark_config": config}


def _settings_response(sys_settings) -> dict:
    return {
        "settings": sys_settings.model_dump(mode="json"),
        "backgrounds": _require_background_store().list_all(sys_settings.default_background_id),
        "watermark": _require_watermark_store().info(),
        "runtime": _runtime(),
    }


def _runtime() -> dict:
    sys_settings = _require_settings_store().get()
    return runtime_info(
        settings,
        storage.s3_enabled,
        mongo_health(mongo_db).get("ok", False),
        sys_settings=sys_settings,
    )


def _rembg_config():
    return rembg_config_from_system(settings, _require_settings_store().get())


_ENGINE_OVERRIDE_KEYS = ("engine", "processing_mode", "quality", "managed_api_enabled")


def _engine_config(overrides: dict | None = None) -> EngineConfig:
    """Effective EngineConfig: env defaults overlaid by admin settings, then per-request overrides."""
    cfg = EngineConfig.from_settings(settings, _require_settings_store().get())
    if overrides:
        from core.cutout.base import CutoutEngine, ProcessingMode, QualityMode, _coerce

        if overrides.get("engine"):
            cfg.engine = _coerce(CutoutEngine, overrides["engine"], cfg.engine)
        if overrides.get("processing_mode"):
            cfg.processing_mode = _coerce(ProcessingMode, overrides["processing_mode"], cfg.processing_mode)
        if overrides.get("quality"):
            cfg.quality = _coerce(QualityMode, overrides["quality"], cfg.quality)
        if overrides.get("managed_api_enabled") is not None:
            cfg.managed_api_enabled = bool(overrides["managed_api_enabled"])
    return cfg


def _rendition_spec() -> RenditionSpec:
    return RenditionSpec.from_config(settings, _require_settings_store().get())


# ---- Presets: simple, purpose-driven mappings to engine + rendition config ---- #
# The UI surfaces these by name; advanced users can still override individual
# settings. `renditions` keys map to RenditionSpec fields.
PRESETS: dict[str, dict] = {
    "fast_preview": {
        "label": "Fast Preview",
        "quality": "fast",
        "engine": "self_hosted",
        "renditions": {"master_png": True, "master_webp": False, "web_webp": False, "web_avif": False, "branded_jpeg": True},
    },
    "website_product": {
        "label": "Website Product",
        "quality": "balanced",
        "engine": "self_hosted",
        "renditions": {"master_png": True, "master_webp": False, "web_webp": True, "web_avif": False, "branded_jpeg": True},
    },
    "premium_cutout": {
        "label": "Premium Cutout",
        "quality": "premium",
        "engine": "self_hosted",
        "renditions": {"master_png": True, "master_webp": True, "web_webp": True, "web_avif": False, "branded_jpeg": False},
    },
    "social_media": {
        "label": "Social Media Output",
        "quality": "balanced",
        "engine": "self_hosted",
        "renditions": {"master_png": False, "master_webp": False, "web_webp": True, "web_avif": True, "branded_jpeg": True},
    },
    "transparent_master": {
        "label": "Transparent Master",
        "quality": "premium",
        "engine": "self_hosted",
        "renditions": {"master_png": True, "master_webp": True, "web_webp": True, "web_avif": False, "branded_jpeg": False},
    },
    "full_brand_package": {
        "label": "Full Brand Package",
        "quality": "premium",
        "engine": "hybrid",
        "renditions": {"master_png": True, "master_webp": True, "web_webp": True, "web_avif": True, "branded_jpeg": True},
    },
}


def _preset_overrides(preset: str | None, quality: str | None, purpose: str | None) -> dict:
    base: dict = {}
    if preset and preset in PRESETS:
        p = PRESETS[preset]
        base = {"preset": preset, "quality": p["quality"], "engine": p["engine"], "renditions": dict(p["renditions"])}
    if quality:
        base["quality"] = quality
    if purpose:
        base["purpose"] = purpose
    return base


def _batch_overrides(batch) -> dict:
    md = getattr(batch, "metadata", None) or {}
    ov = md.get("overrides")
    return ov if isinstance(ov, dict) else {}


def _rembg_config_for_batch(batch):
    rc = _rembg_config()
    ov = _batch_overrides(batch)
    if ov.get("quality"):
        rc.quality = ov["quality"]
    if ov.get("engine"):
        rc.engine = ov["engine"]
    if ov.get("managed_api_enabled") is not None:
        rc.managed_api_enabled = bool(ov["managed_api_enabled"])
    return rc


def _rendition_spec_for_batch(batch) -> RenditionSpec:
    spec = _rendition_spec()
    rend = _batch_overrides(batch).get("renditions")
    if isinstance(rend, dict):
        for key in ("master_png", "master_webp", "web_webp", "web_avif", "branded_jpeg"):
            if key in rend and rend[key] is not None:
                setattr(spec, key, bool(rend[key]))
    return spec


async def _generate_and_store_renditions(item, *, spec: RenditionSpec | None = None, force: bool = False) -> dict[str, str]:
    """Build + store standardized transparent renditions for an item. Returns name->url.

    Cached: if the item already has renditions and force is False, returns them as-is.
    """
    if not force and item.rendition_urls:
        return item.rendition_urls

    cutout_key = _rendition_cutout_key(item)
    if not storage.exists(cutout_key):
        item.processed_url = await processor.process_original_async(
            item.original_key, cutout_key, _rembg_config()
        )
        item.processed_key = cutout_key

    cutout_bytes = storage.get_bytes(cutout_key)
    tight = Image.open(io.BytesIO(cutout_bytes)).convert("RGBA")
    bbox = tight.getbbox()
    if bbox:
        tight = tight.crop(bbox)

    spec = spec or _rendition_spec()
    renditions = await asyncio.to_thread(build_transparent_renditions, tight, spec)
    stem = sanitize_storage_name(item.display_name)
    urls: dict[str, str] = {}
    for r in renditions:
        key = f"{storage.final_prefix(item.batch_id)}/{r.filename(stem)}"
        urls[f"{r.name}_{r.ext}"] = storage.put_bytes(key, r.data, content_type=r.content_type)

    item.rendition_urls = urls
    _require_repo().save_item(item)
    return urls


# ---- Non-destructive touch-up (Adjust step) -------------------------------- #
def _rendition_cutout_key(item) -> str:
    """Prefer the adjusted (touched-up) cutout for renditions when present."""
    if item.adjusted_key and storage.exists(item.adjusted_key):
        return item.adjusted_key
    return _resolve_cutout_key(item)


def _normalize_transform(raw: dict | None) -> dict:
    raw = raw or {}

    def num(key: str, default: float, lo: float, hi: float) -> float:
        try:
            v = float(raw.get(key, default))
        except (TypeError, ValueError):
            v = default
        return max(lo, min(hi, v))

    return {
        "scale": num("scale", 1.0, 0.2, 2.0),
        "offset_x": num("offset_x", 0.0, -0.5, 0.5),
        "offset_y": num("offset_y", 0.0, -0.5, 0.5),
        "rotation": num("rotation", 0.0, -180.0, 180.0),
        "flip_h": bool(raw.get("flip_h", False)),
        "flip_v": bool(raw.get("flip_v", False)),
    }


def _decode_data_url(value: str) -> bytes:
    payload = value.strip()
    if payload.startswith("data:") and "," in payload:
        payload = payload.split(",", 1)[1]
    return base64.b64decode(payload)


async def _render_item_with_adjustments(item, batch) -> None:
    """Build the adjusted transparent cutout + branded output from item.adjustments.

    Original processed_key is never modified (fully non-destructive).
    """
    cutout_key = _resolve_cutout_key(item)
    if not storage.exists(cutout_key):
        item.processed_url = await processor.process_original_async(
            item.original_key, cutout_key, _rembg_config_for_batch(batch)
        )
        item.processed_key = cutout_key

    original_png = storage.get_bytes(cutout_key)
    adj = item.adjustments or {}
    t = _normalize_transform(adj.get("transform"))
    mask_key = adj.get("mask_key")
    mask_png = storage.get_bytes(mask_key) if (mask_key and storage.exists(mask_key)) else None

    subject = await asyncio.to_thread(
        processor.build_adjusted_subject,
        original_png,
        mask_png=mask_png,
        rotation=t["rotation"],
        flip_h=t["flip_h"],
        flip_v=t["flip_v"],
    )

    # Versioned filenames so every save produces NEW URLs — reliably cache-proof
    # across the browser and any CDN. Previous versioned artifacts are removed.
    version = int(time.time() * 1000)
    for old_key in (adj.get("artifacts") or []):
        if old_key and storage.exists(old_key):
            storage.delete_key(old_key)
    artifacts: list[str] = []
    stem = sanitize_storage_name(item.display_name)

    sbuf = io.BytesIO()
    subject.save(sbuf, format="PNG")
    adjusted_key = f"{storage.processed_prefix(item.batch_id)}/{item.id}_adjusted_v{version}.png"
    storage.put_bytes(adjusted_key, sbuf.getvalue(), content_type="image/png")
    item.adjusted_key = adjusted_key
    artifacts.append(adjusted_key)

    bg_id = _batch_background_id(batch)
    bg_bytes = _require_background_store().get_bytes(bg_id)
    final_bytes = await asyncio.to_thread(
        processor.render_adjusted,
        subject,
        bg_bytes,
        scale=t["scale"],
        offset_x=t["offset_x"],
        offset_y=t["offset_y"],
        **_watermark_render_kwargs(),
    )
    final_key = f"{storage.final_prefix(item.batch_id)}/{stem}__{sanitize_storage_name(bg_id)}__v{version}.jpg"
    item.final_key = final_key
    item.final_url = storage.put_bytes(final_key, final_bytes, content_type="image/jpeg")
    item.background_id = bg_id
    artifacts.append(final_key)

    # Regenerate ALL renditions from the adjusted cutout immediately (versioned).
    spec = _rendition_spec_for_batch(batch)
    renditions = await asyncio.to_thread(build_transparent_renditions, subject, spec)
    rendition_urls: dict[str, str] = {}
    for r in renditions:
        key = f"{storage.final_prefix(item.batch_id)}/{stem}__{r.name}__v{version}.{r.ext}"
        rendition_urls[f"{r.name}_{r.ext}"] = storage.put_bytes(key, r.data, content_type=r.content_type)
        artifacts.append(key)
    item.rendition_urls = rendition_urls or None

    item.adjustments = {
        "transform": t,
        "mask_key": mask_key,
        "updated_at": utc_now().isoformat(),
        "artifacts": artifacts,
        "version": version,
    }
    if item.status == ItemStatus.PROCESSED:
        item.status = ItemStatus.REVIEWED
    _require_repo().save_item(item)
    # If already published, refresh the output record so edits show on Outputs.
    if item.status == ItemStatus.FINALIZED:
        try:
            _require_repo().upsert_output(item, batch)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to refresh output after adjust for %s", item.id)


def _build_processing_meta(*, background_id: str | None = None) -> dict:
    sys_settings = _require_settings_store().get()
    config = _rembg_config()
    watermark = _watermark_config()
    return {
        "processed_at": utc_now().isoformat(),
        "rembg": rembg_meta_dict(config, loaded_model=pool_loaded_model()),
        "subject_fill_ratio": sys_settings.subject_fill_ratio,
        "background_id": background_id,
        "watermark": {
            "enabled": watermark.enabled,
            "scale": watermark.scale,
            "opacity": watermark.opacity,
            "bottom_margin_px": watermark.bottom_margin_px,
        },
    }


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
        **_watermark_render_kwargs(),
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
    pending = [item for item in items if item_needs_processing(item)]

    # Register the whole batch for live progress (all items, in order).
    progress_registry.start_batch(batch_id, len(items))
    for idx, item in enumerate(items):
        progress_registry.register_item(batch_id, item.id, item.display_name, idx + 1)
        if item not in pending:
            progress_registry.finish_item(batch_id, item.id, "completed")

    if not pending:
        ready = sum(1 for item in items if item.status != ItemStatus.FAILED)
        batch.status = BatchStatus.REVIEW if ready else BatchStatus.FAILED
        _require_repo().save_batch(batch)
        progress_registry.end_batch(batch_id)
        return

    rembg_config = _rembg_config_for_batch(batch)
    import time as _time

    for item in pending:
        started = _time.perf_counter()
        progress_registry.start_item(batch_id, item.id)

        def _on_stage(stage: str, _id=item.id) -> None:
            progress_registry.set_stage(batch_id, _id, stage)

        try:
            logger.info("Processing item %s (%s)", item.id, item.display_name)
            item.status = ItemStatus.PROCESSING
            item.stage = "preparing"
            item.error = None
            item.attempts = (item.attempts or 0) + 1
            _require_repo().save_item(item)
            batch.updated_at = utc_now()
            _require_repo().save_batch(batch)

            processed_key = storage.processed_key(batch_id, item.id)
            processed_url = await processor.process_original_async(
                item.original_key,
                processed_key,
                rembg_config,
                on_stage=_on_stage,
            )
            item.processed_key = processed_key
            item.processed_url = processed_url

            progress_registry.set_stage(batch_id, item.id, "branded_output")
            item.stage = "branded_output"
            await _render_item_final(item, batch_id, bg_id)

            progress_registry.set_stage(batch_id, item.id, "saving")
            item.processing_meta = _build_processing_meta(background_id=bg_id)
            item.status = ItemStatus.PROCESSED
            item.stage = "completed"
            item.error = None
            item.processing_ms = int((_time.perf_counter() - started) * 1000)
            _require_repo().save_item(item)
            progress_registry.finish_item(batch_id, item.id, "completed")
            logger.info("Processed item %s in %sms", item.id, item.processing_ms)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed processing item %s", item.id)
            item.status = ItemStatus.FAILED
            item.stage = "failed"
            item.error = str(exc)
            item.processing_ms = int((_time.perf_counter() - started) * 1000)
            _require_repo().save_item(item)
            progress_registry.finish_item(batch_id, item.id, "failed", str(exc))

    progress_registry.end_batch(batch_id)
    items = _require_repo().list_items(batch_id)
    failed = sum(1 for item in items if item.status == ItemStatus.FAILED)
    ready = sum(
        1
        for item in items
        if item.status
        in {
            ItemStatus.PROCESSED,
            ItemStatus.REVIEWED,
            ItemStatus.BACKGROUND_APPLIED,
            ItemStatus.FINALIZED,
        }
    )
    batch.status = BatchStatus.REVIEW if ready > 0 else BatchStatus.FAILED
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
                **_watermark_render_kwargs(),
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
    global mongo_db, repository, system_settings_store, processor, importer, background_store, watermark_store

    if not settings.mongodb_uri:
        logger.error("MONGODB_URI is not set — Image metadata API will return 503")
        return

    try:
        mongo_db = connect_mongo(settings)
        ensure_indexes(mongo_db)
        repository = ImageRepository(mongo_db)
        system_settings_store = SystemSettingsStore(mongo_db, settings)
        background_store = BackgroundStore(settings, storage, mongo_db)
        watermark_store = WatermarkStore(settings, storage, mongo_db)
        processor = ImageProcessor(
            settings,
            storage,
            subject_fill_ratio=system_settings_store.get().subject_fill_ratio,
        )
        importer = ImportService(settings, storage, repository)
        seeded = background_store.seed_bundled_defaults()
        if seeded:
            logger.info("Seeded %s background template(s) to shared storage", seeded)
        if watermark_store.seed_default():
            logger.info("Seeded default watermark to shared storage")
        recovered = recover_interrupted_jobs(repository)
        if recovered:
            logger.info("Startup recovery handled %s stuck item(s)", recovered)
        logger.info("Image service ready (MongoDB=%s)", settings.image_mongodb_db)
        config = rembg_config_from_system(settings, system_settings_store.get())
        asyncio.create_task(warmup_worker(config))
    except Exception:
        logger.exception("Failed to connect to MongoDB")
        mongo_db = None
        repository = None
        system_settings_store = None
        background_store = None
        watermark_store = None
        processor = None
        importer = None


def _health_payload() -> dict:
    mongo = mongo_health(mongo_db)
    return {
        "ok": mongo.get("ok", False) and repository is not None,
        "s3_enabled": storage.s3_enabled,
        "mongodb": mongo,
        "mongodb_db": settings.image_mongodb_db,
        "output_size": [settings.image_output_width, settings.image_output_height],
        "rembg_loaded_model": pool_loaded_model(),
    }


@app.get("/health")
async def health() -> dict:
    return _health_payload()


@app.get("/api/v1/health")
async def health_api() -> dict:
    return _health_payload()


@app.get("/api/v1/settings")
async def get_system_settings() -> dict:
    return _settings_response(_require_settings_store().get())


@app.patch("/api/v1/settings")
async def update_system_settings(payload: UpdateSystemSettingsRequest) -> dict:
    if payload.default_background_id:
        try:
            _require_background_store().ensure_exists(payload.default_background_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=400, detail="INVALID_BACKGROUND") from exc
    updated = _require_settings_store().update(payload)
    _sync_processor_from_settings()
    return _settings_response(updated)


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


@app.post("/api/v1/settings/watermark")
async def upload_watermark(file: Annotated[UploadFile, File(...)]) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="NO_FILE")
    suffix = Path(file.filename).suffix or ".png"
    data = await file.read()
    _require_watermark_store().save_upload(data, suffix)
    return _settings_response(_require_settings_store().get())


@app.post("/api/v1/settings/watermark/reset")
async def reset_watermark() -> dict:
    try:
        _require_watermark_store().reset_to_default()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="WATERMARK_NOT_FOUND") from exc
    return _settings_response(_require_settings_store().get())


@app.post("/api/v1/settings/rembg/preview")
async def preview_rembg_settings(file: Annotated[UploadFile, File(...)]) -> dict:
    if processor is None:
        raise HTTPException(status_code=503, detail="PROCESSOR_NOT_READY")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="EMPTY_FILE")
    config = _rembg_config()
    cutout = await processor.extract_tight_cutout_async(data, config)
    return {
        "preview_base64": base64.b64encode(cutout).decode("ascii"),
        "settings": config.model_dump(),
        "loaded_model": pool_loaded_model(),
    }


def _mode_to_overrides(mode: str) -> dict:
    mode = mode.strip().lower()
    if mode == "hybrid":
        return {"engine": "hybrid", "quality": "premium"}
    if mode == "managed":
        return {"engine": "managed_api", "managed_api_enabled": True}
    if mode in ("fast", "balanced", "premium"):
        return {"engine": "self_hosted", "quality": mode}
    return {"quality": "balanced"}


async def _run_cutout_dto(data: bytes, cfg: EngineConfig, *, branded: bool, default_bg_bytes: bytes | None) -> dict:
    t0 = time.perf_counter()
    result = await run_engine(data, cfg)
    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 1)
    cutout_png = result.to_png_bytes()
    dto: dict = {
        "engine": cfg.engine.value,
        "processing_mode": cfg.processing_mode.value,
        "quality": cfg.quality.value,
        "provider": result.provider,
        "model": result.model,
        "confidence": round(result.confidence, 3),
        "escalated": result.escalated,
        "elapsed_ms": elapsed_ms,
        "cutout_base64": base64.b64encode(cutout_png).decode("ascii"),
        "meta": result.meta,
    }
    if branded and default_bg_bytes is not None:
        try:
            branded_bytes = await asyncio.to_thread(
                processor.compose_on_background,
                cutout_png,
                default_bg_bytes,
                **_watermark_render_kwargs(),
            )
            dto["branded_base64"] = base64.b64encode(branded_bytes).decode("ascii")
        except Exception:  # noqa: BLE001
            logger.exception("Branded compose failed in cutout preview")
    return dto


def _default_bg_bytes_or_none(enabled: bool) -> bytes | None:
    if not enabled:
        return None
    try:
        return _require_background_store().get_bytes(_default_background_id())
    except Exception:  # noqa: BLE001
        return None


@app.post("/api/v1/cutout/preview")
async def cutout_preview(
    file: Annotated[UploadFile, File(...)],
    engine: Annotated[str | None, Form()] = None,
    quality: Annotated[str | None, Form()] = None,
    processing_mode: Annotated[str | None, Form()] = None,
    managed_api_enabled: Annotated[bool | None, Form()] = None,
    branded: Annotated[bool, Form()] = False,
) -> dict:
    """Test the current (or overridden) engine settings on one image."""
    if processor is None:
        raise HTTPException(status_code=503, detail="PROCESSOR_NOT_READY")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="EMPTY_FILE")
    cfg = _engine_config(
        {
            "engine": engine,
            "quality": quality,
            "processing_mode": processing_mode,
            "managed_api_enabled": managed_api_enabled,
        }
    )
    return await _run_cutout_dto(data, cfg, branded=branded, default_bg_bytes=_default_bg_bytes_or_none(branded))


@app.post("/api/v1/cutout/compare")
async def cutout_compare(
    file: Annotated[UploadFile, File(...)],
    modes: Annotated[str | None, Form()] = None,  # csv: fast,balanced,premium,hybrid,managed
    branded: Annotated[bool, Form()] = True,
) -> dict:
    """Run several modes on one image for side-by-side quality comparison."""
    if processor is None:
        raise HTTPException(status_code=503, detail="PROCESSOR_NOT_READY")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="EMPTY_FILE")

    requested = [m.strip().lower() for m in (modes or "balanced,premium").split(",") if m.strip()]
    default_bg_bytes = _default_bg_bytes_or_none(branded)
    results: list[dict] = []
    for mode in requested:
        cfg = _engine_config(_mode_to_overrides(mode))
        try:
            dto = await _run_cutout_dto(data, cfg, branded=branded, default_bg_bytes=default_bg_bytes)
            dto["mode"] = mode
            results.append(dto)
        except Exception as exc:  # noqa: BLE001
            results.append({"mode": mode, "error": str(exc)})
    return {"results": results}


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
    preset: str | None = Query(default=None),
    quality: str | None = Query(default=None),
    purpose: str | None = Query(default=None),
) -> LocalImportResponse:
    if not files:
        raise HTTPException(status_code=400, detail="NO_FILES")

    if importer is None:
        raise HTTPException(status_code=503, detail="MONGODB_NOT_CONFIGURED")

    overrides = _preset_overrides(preset, quality, purpose)
    batch = importer.create_batch(
        name=batch_name or f"Local import {len(files)} file(s)",
        source=ImportSource.LOCAL,
        default_background_id=_default_background_id(),
        metadata={"overrides": overrides} if overrides else {},
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


@app.get("/api/v1/presets")
async def list_presets() -> dict:
    return {
        "presets": [
            {
                "id": pid,
                "label": p["label"],
                "quality": p["quality"],
                "engine": p["engine"],
                "renditions": p["renditions"],
            }
            for pid, p in PRESETS.items()
        ]
    }


def _progress_from_mongo(batch_id: str) -> dict:
    """Durable fallback progress from Mongo (after a reload or server restart)."""
    items = _require_repo().list_items(batch_id)
    total = len(items)
    done_statuses = {
        ItemStatus.PROCESSED,
        ItemStatus.REVIEWED,
        ItemStatus.BACKGROUND_APPLIED,
        ItemStatus.FINALIZED,
    }
    completed = 0
    failed = 0
    out_items: list[dict] = []
    for idx, it in enumerate(items):
        if it.status in done_statuses:
            pct, pstatus, stage = 100, "completed", "completed"
            completed += 1
        elif it.status == ItemStatus.FAILED:
            pct, pstatus, stage = 0, "failed", "failed"
            failed += 1
        elif it.status == ItemStatus.PROCESSING:
            stage = it.stage or "preparing"
            pct, pstatus = stage_percent(stage), "processing"
        else:
            pct, pstatus, stage = 0, "pending", (it.stage or "queued")
        out_items.append(
            {
                "item_id": it.id,
                "name": it.display_name,
                "index": idx + 1,
                "status": pstatus,
                "stage": stage,
                "stage_label": STAGE_LABELS.get(stage, stage),
                "percent": pct,
                "elapsed_ms": it.processing_ms,
                "error": it.error,
            }
        )
    active = any(it.status == ItemStatus.PROCESSING for it in items)
    overall = round((completed / total * 100.0), 1) if total else 0.0
    return {
        "batch_id": batch_id,
        "active": active,
        "total": total,
        "completed": completed,
        "failed": failed,
        "overall_percent": overall,
        "elapsed_ms": None,
        "eta_ms": None,
        "current": next((i for i in out_items if i["status"] == "processing"), None),
        "items": out_items,
    }


@app.get("/api/v1/batches/{batch_id}/progress")
async def batch_progress(batch_id: str) -> dict:
    _batch_or_404(batch_id)
    snap = progress_registry.snapshot(batch_id)
    if snap is not None and snap.get("total"):
        return snap
    return _progress_from_mongo(batch_id)


@app.post("/api/v1/items/{item_id}/retry")
async def retry_item(item_id: str, background_tasks: BackgroundTasks) -> dict:
    """Reset a failed item and re-run its batch (only pending/failed items reprocess)."""
    item = _item_or_404(item_id)
    item.status = ItemStatus.IMPORTED
    item.stage = None
    item.error = None
    _require_repo().save_item(item)
    background_tasks.add_task(_process_batch, item.batch_id)
    return {"ok": True, "item_id": item_id, "batch_id": item.batch_id}


@app.get("/api/v1/items/{item_id}")
async def get_item(item_id: str) -> dict:
    return {"item": _item_or_404(item_id).model_dump(mode="json")}


@app.post("/api/v1/items/{item_id}/adjust")
async def adjust_item(item_id: str, payload: dict) -> dict:
    """Save non-destructive touch-up (transform + erase mask) and re-render outputs."""
    if processor is None:
        raise HTTPException(status_code=503, detail="PROCESSOR_NOT_READY")
    item = _item_or_404(item_id)
    batch = _batch_or_404(item.batch_id)

    transform = _normalize_transform(payload.get("transform"))
    existing = item.adjustments or {}
    mask_key = existing.get("mask_key")

    if payload.get("clear_mask"):
        if mask_key and storage.exists(mask_key):
            storage.delete_key(mask_key)
        mask_key = None

    mask_b64 = payload.get("mask_base64")
    if isinstance(mask_b64, str) and mask_b64.strip():
        try:
            raw = _decode_data_url(mask_b64)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail="INVALID_MASK") from exc
        mask_key = f"{storage.processed_prefix(item.batch_id)}/{item.id}_mask.png"
        storage.put_bytes(mask_key, raw, content_type="image/png")

    item.adjustments = {
        "transform": transform,
        "mask_key": mask_key,
        "updated_at": utc_now().isoformat(),
        "artifacts": existing.get("artifacts", []),  # carried forward for cleanup
    }
    await _render_item_with_adjustments(item, batch)
    return {"item": item.model_dump(mode="json")}


@app.post("/api/v1/items/{item_id}/adjust/reset")
async def reset_item_adjustments(item_id: str) -> dict:
    """Revert to the original processed output (discard touch-up)."""
    if processor is None:
        raise HTTPException(status_code=503, detail="PROCESSOR_NOT_READY")
    item = _item_or_404(item_id)
    batch = _batch_or_404(item.batch_id)

    adj = item.adjustments or {}
    for key in [adj.get("mask_key"), item.adjusted_key, *(adj.get("artifacts") or [])]:
        if key and storage.exists(key):
            storage.delete_key(key)

    item.adjustments = None
    item.adjusted_key = None
    item.rendition_urls = None
    # Re-render the automatic (auto-centered) branded output from the original cutout.
    await _render_item_final(item, item.batch_id, _batch_background_id(batch))
    # Regenerate renditions from the original so Outputs stays consistent.
    try:
        await _generate_and_store_renditions(
            item, spec=_rendition_spec_for_batch(batch), force=True
        )
    except Exception:  # noqa: BLE001
        logger.exception("Failed to regenerate renditions after reset for %s", item.id)
    _require_repo().save_item(item)
    if item.status == ItemStatus.FINALIZED:
        try:
            _require_repo().upsert_output(item, batch)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to refresh output after reset for %s", item.id)
    return {"item": item.model_dump(mode="json")}


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
            rembg_config = _rembg_config()
            processed_url = await processor.process_original_async(
                item.original_key,
                processed_key,
                rembg_config,
            )
            item.processed_key = processed_key
            item.processed_url = processed_url
            bg_id = _batch_background_id(batch)
            await _render_item_final(item, item.batch_id, bg_id)
            item.processing_meta = _build_processing_meta(background_id=bg_id)
            item.status = ItemStatus.PROCESSED
            item.error = None
            _require_repo().save_item(item)
        except Exception as exc:  # noqa: BLE001
            item.status = ItemStatus.FAILED
            item.error = str(exc)
            _require_repo().save_item(item)

    background_tasks.add_task(_run)
    return {"ok": True, "item_id": item_id}


@app.post("/api/v1/items/{item_id}/apply-processing-settings")
async def apply_item_processing_settings(item_id: str) -> dict:
    item = _item_or_404(item_id)
    meta = item.processing_meta or {}
    rembg = meta.get("rembg")
    if not rembg:
        raise HTTPException(status_code=404, detail="NO_PROCESSING_META")

    watermark = meta.get("watermark") or {}
    patch = UpdateSystemSettingsRequest(
        rembg_model=rembg.get("configured_model"),
        rembg_preserve_detail=rembg.get("preserve_detail"),
        rembg_mask_dilate=rembg.get("mask_dilate"),
        rembg_alpha_matting=rembg.get("alpha_matting"),
        rembg_foreground_threshold=rembg.get("foreground_threshold"),
        rembg_background_threshold=rembg.get("background_threshold"),
        rembg_erode_size=rembg.get("erode_size"),
        rembg_min_dimension=rembg.get("min_dimension"),
        subject_fill_ratio=meta.get("subject_fill_ratio"),
        watermark_enabled=watermark.get("enabled"),
        watermark_scale=watermark.get("scale"),
        watermark_opacity=watermark.get("opacity"),
        watermark_bottom_margin_px=watermark.get("bottom_margin_px"),
    )
    updated = _require_settings_store().update(patch)
    _sync_processor_from_settings()
    return _settings_response(updated)


@app.post("/api/v1/items/{item_id}/renditions")
async def generate_item_renditions(item_id: str) -> dict:
    """Generate standardized transparent renditions (master PNG/WebP, web WebP/AVIF).

    On-demand; which renditions are produced is controlled by the IMAGE_RENDER_*
    settings (env or admin). Renditions are also generated automatically on finalize.
    """
    if processor is None:
        raise HTTPException(status_code=503, detail="PROCESSOR_NOT_READY")
    item = _item_or_404(item_id)
    urls = await _generate_and_store_renditions(item, force=True)
    return {"item_id": item_id, "renditions": urls}


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
    rendition_spec = _rendition_spec_for_batch(batch)
    for item in items:
        if item.status not in ready_statuses or not item.final_url:
            continue
        item.status = ItemStatus.FINALIZED
        if processor is not None:
            try:
                await _generate_and_store_renditions(item, spec=rendition_spec, force=True)
            except Exception:  # noqa: BLE001
                logger.exception("Rendition generation failed for item %s", item.id)
        _require_repo().save_item(item)
        outputs.append(_enrich_output_row(_require_repo().upsert_output(item, batch)))

    batch.status = BatchStatus.FINALIZED
    _require_repo().save_batch(batch)
    return {"batch": batch.model_dump(mode="json"), "outputs": outputs}


def _enrich_output_row(row):
    payload = row.model_dump(mode="json")
    item = _require_repo().get_item(row.item_id)
    if item:
        if not payload.get("background_id") and item.background_id:
            payload["background_id"] = item.background_id
        if getattr(item, "rendition_urls", None):
            payload["rendition_urls"] = item.rendition_urls
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
            rembg_config = _rembg_config()
            item.processed_url = await processor.process_original_async(
                item.original_key,
                cutout_key,
                rembg_config,
            )
            item.processed_key = cutout_key
            item.processing_meta = _build_processing_meta(background_id=bg_id)

        if item.adjustments and item.adjusted_key and storage.exists(item.adjusted_key):
            # Preserve the user's touch-up when changing background.
            subject = Image.open(io.BytesIO(storage.get_bytes(item.adjusted_key))).convert("RGBA")
            t = _normalize_transform((item.adjustments or {}).get("transform"))
            final_bytes = await asyncio.to_thread(
                processor.render_adjusted,
                subject,
                bg_bytes,
                scale=t["scale"],
                offset_x=t["offset_x"],
                offset_y=t["offset_y"],
                **_watermark_render_kwargs(),
            )
            final_url = storage.put_bytes(final_key, final_bytes, content_type="image/jpeg")
        else:
            final_url = await asyncio.to_thread(
                processor.render_final,
                cutout_key,
                final_key,
                bg_bytes,
                f"{item.display_name}.jpg",
                **_watermark_render_kwargs(),
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


_COMPOSE_ALLOWED_HOST_SUFFIXES = (
    "googleusercontent.com",
    "drive.google.com",
    "google.com",
    "lorenzohome.ae",
    "ehsanrahimi.com",
)


def _compose_allowed_hosts() -> tuple[str, ...]:
    extra: list[str] = []
    base = settings.aws_s3_public_base_url
    if base:
        try:
            host = urlparse(base).hostname
            if host:
                extra.append(host.lower())
        except Exception:
            pass
    return _COMPOSE_ALLOWED_HOST_SUFFIXES + tuple(extra)


def _compose_src_allowed(url: str) -> bool:
    """SSRF guard: only allow http(s) to known product-image hosts.

    The image service is internal/unauthenticated, so the compose endpoint must
    never fetch arbitrary or internal URLs.
    """
    if not (url.startswith("http://") or url.startswith("https://")):
        return False
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False
    if not host:
        return False
    return any(host == s or host.endswith("." + s) for s in _compose_allowed_hosts())


def _fetch_bytes(url: str, timeout: int = 20) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "LorenzoImage/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 (host allow-listed)
        return resp.read()


@app.get("/api/v1/compose")
async def compose_official(
    src: str = Query(..., description="Transparent cutout image URL (allow-listed hosts)"),
    bg: str | None = Query(None, description="Background id; defaults to the official default"),
) -> Response:
    """Official Lorenzo composition: place a transparent cutout on the real
    Lorenzo background using the SAME ImageProcessor.compose_on_background logic
    as the pipeline (1080×1440, contain-fit @ subject_fill_ratio, centered).

    Read-only with respect to product data. The composed JPEG is cached in
    object storage under a deterministic key so repeat requests are cheap.
    """
    if not _compose_src_allowed(src):
        raise HTTPException(status_code=400, detail="SRC_NOT_ALLOWED")

    sys_settings = _require_settings_store().get()
    bg_id = bg or sys_settings.default_background_id
    fill = float(getattr(sys_settings, "subject_fill_ratio", 0.82) or 0.82)

    cache_key = (
        "compose/"
        + hashlib.sha256(f"{src}|{bg_id}|{fill:.3f}".encode("utf-8")).hexdigest()
        + ".jpg"
    )

    # Serve cached composition when present.
    try:
        cached = storage.get_bytes(cache_key)
        return Response(
            content=cached,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except FileNotFoundError:
        pass

    try:
        cutout_bytes = await asyncio.to_thread(_fetch_bytes, src)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="CUTOUT_FETCH_FAILED") from exc

    try:
        bg_bytes = _require_background_store().get_bytes(bg_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="BACKGROUND_NOT_FOUND") from exc

    def _compose() -> bytes:
        # Fresh processor instance so we never mutate the shared one's fill ratio.
        proc = ImageProcessor(settings, storage, subject_fill_ratio=fill)
        return proc.compose_on_background(cutout_bytes, bg_bytes)

    try:
        composed = await asyncio.to_thread(_compose)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail="COMPOSE_FAILED") from exc

    # Best-effort cache write (display-only derived asset; not product data).
    try:
        storage.put_bytes(cache_key, composed, content_type="image/jpeg")
    except Exception:  # noqa: BLE001
        pass

    return Response(
        content=composed,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/api/v1/assets/backgrounds/{background_id}")
async def get_background_asset(background_id: str) -> Response:
    store = _require_background_store()
    try:
        data = store.get_bytes(background_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="BACKGROUND_NOT_FOUND") from exc
    return Response(content=data, media_type=store.get_content_type(background_id))


@app.get("/api/v1/assets/watermark")
async def get_watermark_asset() -> Response:
    store = _require_watermark_store()
    try:
        data = store.get_bytes()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="WATERMARK_NOT_FOUND") from exc
    return Response(content=data, media_type=store.get_content_type())
