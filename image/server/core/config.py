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
