from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    image_storage_root: str = "./storage"
    image_output_width: int = 1080
    image_output_height: int = 1440

    image_rembg_model: str = "birefnet-general"
    image_rembg_preserve_detail: bool = True
    image_rembg_mask_dilate: int = 1
    image_rembg_alpha_matting: bool = False
    image_rembg_foreground_threshold: int = 240
    image_rembg_background_threshold: int = 8
    image_rembg_erode_size: int = 0
    image_rembg_max_dimension: int = 2048
    image_rembg_min_dimension: int = 1800

    # ----- Cutout engine architecture (provider-based, switchable) -----
    # IMAGE_CUTOUT_ENGINE: self_hosted | managed_api | hybrid
    image_cutout_engine: str = "self_hosted"
    # IMAGE_PROCESSING_MODE: cpu | gpu  (gpu reserved for a future self-hosted upgrade)
    image_processing_mode: str = "cpu"
    # IMAGE_QUALITY_MODE: fast | balanced | premium
    # balanced == today's behavior (rembg preserve_detail + heuristic refine).
    image_quality_mode: str = "balanced"
    # Master switch for the managed API provider (must also have a provider + key).
    image_managed_api_enabled: bool = False
    # Managed provider: photoroom | removebg | none
    image_managed_api_provider: str = "none"
    image_managed_api_key: str | None = None
    image_managed_api_timeout_s: float = 30.0
    # In hybrid mode, escalate to the managed API when the local cutout looks weak.
    # 0..1 confidence; below this we try the managed provider (if enabled).
    image_hybrid_escalate_below: float = 0.55
    # Cap how many managed-API escalations per batch (cost control). -1 = unlimited.
    image_hybrid_managed_budget: int = -1

    # ----- Standardized output renditions -----
    # Always keep a transparent high-res master derived cutout.
    image_render_master_png: bool = True
    image_render_master_webp: bool = True
    # Web-optimized transparent renditions.
    image_render_web_webp: bool = True
    image_render_web_avif: bool = False  # needs pillow-avif-plugin; off by default
    # Branded JPEG-on-background output (the existing finalized product image).
    image_render_branded_jpeg: bool = True
    image_web_max_dimension: int = 2048
    image_webp_quality: int = 90
    image_avif_quality: int = 60
    image_master_max_dimension: int = 4096

    mongodb_uri: str | None = None
    image_mongodb_db: str = "lorenzo_image"

    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_region: str = "us-east-1"
    aws_s3_bucket: str | None = None
    aws_s3_public_base_url: str | None = None
    aws_s3_upload_prefix: str = "uploads"
    aws_s3_processed_prefix: str = "processed"
    aws_s3_final_prefix: str = "final"
    aws_s3_backgrounds_prefix: str = "backgrounds"
    aws_s3_watermarks_prefix: str = "watermarks"

    google_drive_credentials_json: str | None = None
    google_drive_scopes: str = "https://www.googleapis.com/auth/drive.readonly"

    image_cors_origins: str = "http://localhost:3006,http://127.0.0.1:3006"

    @property
    def storage_root(self) -> Path:
        return Path(self.image_storage_root).resolve()

    @property
    def assets_root(self) -> Path:
        return Path(__file__).resolve().parent.parent / "assets"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.image_cors_origins.split(",") if o.strip()]

    @property
    def s3_enabled(self) -> bool:
        return bool(
            self.aws_s3_bucket
            and self.aws_access_key_id
            and self.aws_secret_access_key
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
