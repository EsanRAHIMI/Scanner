from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str | None = None
    mongodb_db_name: str = "lorenzodb"
    trainer_jwt_secret: str | None = None
    trainer_auth_cookie_name: str = "trainer_auth"
    marketing_cors_origins: str = "http://localhost:3005,http://127.0.0.1:3005"
    marketing_workbook_path: str | None = None
    sync_interval_seconds: int = 3600

    meta_access_token: str | None = None
    meta_ad_account_id: str = "449251307578659"
    meta_graph_version: str = "v22.0"

    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    google_oauth_refresh_token: str | None = None
    google_ads_developer_token: str | None = None
    google_ads_customer_id: str = "2042770350"
    google_ads_login_customer_id: str | None = None
    ga4_property_id: str | None = None
    gsc_site_url: str = "https://lorenzolighting.com/"
    gtm_container_path: str | None = None
    gbp_location_name: str | None = None

    linkedin_access_token: str | None = None
    linkedin_ad_account_id: str = "554320120"

    pinterest_access_token: str | None = None
    pinterest_ad_account_id: str = "549770710125"

    tiktok_access_token: str | None = None
    tiktok_advertiser_id: str | None = None

    snapchat_client_id: str | None = None
    snapchat_client_secret: str | None = None
    snapchat_refresh_token: str | None = None
    snapchat_ad_account_id: str | None = None

    odoo_url: str | None = None
    odoo_db: str | None = None
    odoo_username: str | None = None
    odoo_api_key: str | None = None

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.marketing_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
