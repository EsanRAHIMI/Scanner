from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Proposals service settings.

    Reuses the platform conventions:
      - MONGODB_URI / MONGODB_DB_NAME  -> same Atlas DB as trainer/server
      - TRAINER_JWT_SECRET / TRAINER_AUTH_COOKIE_NAME -> shared session cookie
      - AWS_*                          -> same S3 strategy as image/server
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Shared platform DB (same Atlas cluster as trainer/server) ---
    mongodb_uri: str | None = None
    mongodb_db_name: str = "lorenzodb"

    # --- Shared auth (same JWT cookie as trainer/server) ---
    trainer_jwt_secret: str | None = None
    trainer_auth_cookie_name: str = "trainer_auth"

    # --- Object storage (Amazon S3 in production; local disk dev fallback) ---
    proposals_storage_root: str = "./storage"
    proposals_require_s3: bool = False
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_region: str = "us-east-1"
    aws_s3_bucket: str | None = None
    aws_s3_public_base_url: str | None = None
    aws_s3_proposals_prefix: str = "proposals"

    # --- Service ---
    proposals_port: int = 8030
    # Base URL this server can reach itself on (used by Playwright for PDF export).
    proposals_internal_base: str = "http://127.0.0.1:8030"
    # Public base URL for building share links (falls back to request origin).
    proposals_public_base: str | None = None
    proposals_cors_origins: str = "http://localhost:3007,http://127.0.0.1:3007"

    # PDF export
    pdf_page_width_px: int = 1440
    pdf_page_height_px: int = 810

    @property
    def storage_root_path(self) -> Path:
        return Path(self.proposals_storage_root)

    @property
    def s3_enabled(self) -> bool:
        return bool(self.aws_s3_bucket and self.aws_access_key_id and self.aws_secret_access_key)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.proposals_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
