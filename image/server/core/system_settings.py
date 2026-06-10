from __future__ import annotations

import re
import threading
from pathlib import Path

from pydantic import BaseModel, Field

from .config import Settings
from .models import utc_now


class SystemSettings(BaseModel):
    default_background_id: str = "lorenzo-default"
    auto_process_on_import: bool = True
    subject_fill_ratio: float = Field(default=0.82, ge=0.5, le=0.95)
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())


class UpdateSystemSettingsRequest(BaseModel):
    default_background_id: str | None = None
    auto_process_on_import: bool | None = None
    subject_fill_ratio: float | None = Field(default=None, ge=0.5, le=0.95)


class UploadBackgroundRequest(BaseModel):
    background_id: str | None = None
    display_name: str | None = None


def slugify_background_id(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "background"


class SystemSettingsStore:
    def __init__(self, root: Path) -> None:
        self.path = root / "system-settings.json"
        self._lock = threading.RLock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.save(SystemSettings())

    def get(self) -> SystemSettings:
        with self._lock:
            return SystemSettings.model_validate_json(self.path.read_text(encoding="utf-8"))

    def save(self, settings: SystemSettings) -> SystemSettings:
        with self._lock:
            settings.updated_at = utc_now().isoformat()
            self.path.write_text(settings.model_dump_json(indent=2), encoding="utf-8")
            return settings

    def update(self, patch: UpdateSystemSettingsRequest) -> SystemSettings:
        current = self.get()
        data = current.model_dump()
        for key, value in patch.model_dump(exclude_unset=True).items():
            if value is not None:
                data[key] = value
        return self.save(SystemSettings.model_validate(data))


def runtime_info(settings: Settings, storage_s3_enabled: bool) -> dict:
    return {
        "output_width": settings.image_output_width,
        "output_height": settings.image_output_height,
        "s3_enabled": storage_s3_enabled,
        "s3_bucket": settings.aws_s3_bucket,
        "s3_public_base_url": settings.aws_s3_public_base_url,
        "upload_prefix": settings.aws_s3_upload_prefix,
        "processed_prefix": settings.aws_s3_processed_prefix,
        "final_prefix": settings.aws_s3_final_prefix,
        "google_drive_configured": bool(settings.google_drive_credentials_json),
    }
