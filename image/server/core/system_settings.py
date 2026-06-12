from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field
from pymongo.database import Database

from .config import Settings, get_settings
from .db import COL_SETTINGS
from .models import utc_now
from .rembg_config import rembg_config_from_env


class SystemSettings(BaseModel):
    default_background_id: str = "lorenzo-default"
    auto_process_on_import: bool = True
    subject_fill_ratio: float = Field(default=0.82, ge=0.5, le=0.95)
    watermark_enabled: bool = True
    watermark_scale: float = Field(default=0.185, ge=0.05, le=0.5)
    watermark_opacity: float = Field(default=1.0, ge=0.1, le=1.0)
    watermark_bottom_margin_px: int = Field(default=28, ge=0, le=200)
    rembg_model: str = "birefnet-general"
    rembg_preserve_detail: bool = True
    rembg_mask_dilate: int = Field(default=1, ge=0, le=5)
    rembg_alpha_matting: bool = False
    rembg_foreground_threshold: int = Field(default=240, ge=0, le=255)
    rembg_background_threshold: int = Field(default=8, ge=0, le=255)
    rembg_erode_size: int = Field(default=0, ge=0, le=20)
    rembg_min_dimension: int = Field(default=1800, ge=800, le=4096)
    # Cutout engine selection (admin-switchable). None = inherit the env value,
    # so switching works via env vars OR admin settings without code changes.
    cutout_engine: str | None = None          # self_hosted | managed_api | hybrid
    processing_mode: str | None = None        # cpu | gpu
    quality_mode: str | None = None           # fast | balanced | premium
    managed_api_enabled: bool | None = None
    managed_api_provider: str | None = None   # photoroom | removebg | none
    hybrid_escalate_below: float | None = Field(default=None, ge=0.0, le=1.0)
    # Output rendition toggles (None = inherit env).
    render_master_png: bool | None = None
    render_master_webp: bool | None = None
    render_web_webp: bool | None = None
    render_web_avif: bool | None = None
    render_branded_jpeg: bool | None = None
    master_max_dimension: int | None = Field(default=None, ge=512, le=8192)
    web_max_dimension: int | None = Field(default=None, ge=512, le=8192)
    webp_quality: int | None = Field(default=None, ge=1, le=100)
    avif_quality: int | None = Field(default=None, ge=1, le=100)
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())


class UpdateSystemSettingsRequest(BaseModel):
    default_background_id: str | None = None
    auto_process_on_import: bool | None = None
    subject_fill_ratio: float | None = Field(default=None, ge=0.5, le=0.95)
    watermark_enabled: bool | None = None
    watermark_scale: float | None = Field(default=None, ge=0.05, le=0.5)
    watermark_opacity: float | None = Field(default=None, ge=0.1, le=1.0)
    watermark_bottom_margin_px: int | None = Field(default=None, ge=0, le=200)
    rembg_model: str | None = None
    rembg_preserve_detail: bool | None = None
    rembg_mask_dilate: int | None = Field(default=None, ge=0, le=5)
    rembg_alpha_matting: bool | None = None
    rembg_foreground_threshold: int | None = Field(default=None, ge=0, le=255)
    rembg_background_threshold: int | None = Field(default=None, ge=0, le=255)
    rembg_erode_size: int | None = Field(default=None, ge=0, le=20)
    rembg_min_dimension: int | None = Field(default=None, ge=800, le=4096)
    cutout_engine: str | None = None
    processing_mode: str | None = None
    quality_mode: str | None = None
    managed_api_enabled: bool | None = None
    managed_api_provider: str | None = None
    hybrid_escalate_below: float | None = Field(default=None, ge=0.0, le=1.0)
    render_master_png: bool | None = None
    render_master_webp: bool | None = None
    render_web_webp: bool | None = None
    render_web_avif: bool | None = None
    render_branded_jpeg: bool | None = None
    master_max_dimension: int | None = Field(default=None, ge=512, le=8192)
    web_max_dimension: int | None = Field(default=None, ge=512, le=8192)
    webp_quality: int | None = Field(default=None, ge=1, le=100)
    avif_quality: int | None = Field(default=None, ge=1, le=100)


def default_system_settings(env: Settings) -> SystemSettings:
    rembg = rembg_config_from_env(env)
    return SystemSettings(
        rembg_model=rembg.model,
        rembg_preserve_detail=rembg.preserve_detail,
        rembg_mask_dilate=rembg.mask_dilate,
        rembg_alpha_matting=rembg.alpha_matting,
        rembg_foreground_threshold=rembg.foreground_threshold,
        rembg_background_threshold=rembg.background_threshold,
        rembg_erode_size=rembg.erode_size,
        rembg_min_dimension=rembg.min_dimension,
    )


class UploadBackgroundRequest(BaseModel):
    background_id: str | None = None
    display_name: str | None = None


def slugify_background_id(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "background"


class SystemSettingsStore:
    SETTINGS_ID = "system"

    def __init__(self, db: Database, env: Settings | None = None) -> None:
        self._collection = db[COL_SETTINGS]
        self._env = env or get_settings()

    def get(self) -> SystemSettings:
        doc = self._collection.find_one({"_id": self.SETTINGS_ID})
        if not doc:
            return self.save(default_system_settings(self._env))
        payload = {k: v for k, v in doc.items() if k != "_id"}
        return SystemSettings.model_validate(payload)

    def save(self, settings: SystemSettings) -> SystemSettings:
        settings.updated_at = utc_now().isoformat()
        doc: dict[str, Any] = {"_id": self.SETTINGS_ID, **settings.model_dump()}
        self._collection.replace_one({"_id": self.SETTINGS_ID}, doc, upsert=True)
        return settings

    def update(self, patch: UpdateSystemSettingsRequest) -> SystemSettings:
        current = self.get()
        data = current.model_dump()
        for key, value in patch.model_dump(exclude_unset=True).items():
            if value is not None:
                data[key] = value
        return self.save(SystemSettings.model_validate(data))


