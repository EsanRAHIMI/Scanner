from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SYSTEM_PROMPT = (
    "You are the Lorenzo AI assistant — a concise, friendly helper embedded across "
    "the Lorenzo platform (Products, Proposals, Images, Marketing, Dashboard). "
    "Answer quickly and clearly. You help the sales and merchandising team navigate "
    "and understand their products and proposals. "
    "You currently have READ-ONLY knowledge: you must NOT claim to have changed any "
    "data. If a user asks you to create, edit, delete, send, or otherwise modify "
    "anything, explain that this action isn't enabled yet and that it will require "
    "explicit confirmation once available. Never invent product, proposal, or pricing "
    "data — if you don't know, say so."
)


class Settings(BaseSettings):
    """Agent service settings — reuses platform conventions (shared JWT, Mongo)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Dedicated agent database (NOT the shared lorenzodb) ---
    mongodb_uri: str | None = None
    mongodb_db_name: str = "lorenzo_agent"

    # --- Shared platform DB (READ-ONLY) for product/proposal lookups ---
    platform_db_name: str = "lorenzodb"

    # --- Image service (for read-only status tool) ---
    image_api_base: str | None = None

    # --- Agent loop ---
    agent_max_tool_rounds: int = 4

    # --- Shared auth (same cookie/secret as trainer & proposals) ---
    trainer_jwt_secret: str | None = None
    trainer_auth_cookie_name: str = "trainer_auth"

    # --- Service ---
    agent_port: int = 8040
    # Base path this service is mounted under, ONLY if the reverse proxy does NOT
    # strip it (e.g. "/server"). Leave empty when the proxy strips the prefix.
    agent_root_path: str = ""
    agent_cors_origins: str = (
        "http://localhost:3003,http://localhost:3004,http://localhost:3005,"
        "http://localhost:3006,http://localhost:3007,http://localhost:3010"
    )

    # --- Nav shortcut URLs (for the floating bar); derived from domain if unset ---
    app_base_domain: str = "lorenzohome.ae"
    hub_subdomain: str = "dashboard"
    products_url: str | None = None
    proposals_url: str | None = None
    image_url: str | None = None
    marketing_url: str | None = None

    # --- LLM (provider-agnostic; auto-detects from available keys) ---
    llm_provider: str = "auto"  # auto | anthropic | openai | echo
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-3-5-sonnet-latest"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str | None = None

    agent_system_prompt: str = DEFAULT_SYSTEM_PROMPT
    short_term_max_messages: int = 20

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.agent_cors_origins.split(",") if o.strip()]

    def _svc(self, sub: str, override: str | None) -> str:
        if override:
            return override.rstrip("/")
        return f"https://{sub}.{self.app_base_domain}"

    def nav_urls(self) -> dict[str, str]:
        return {
            "products": self._svc("products", self.products_url),
            "proposals": self._svc("proposals", self.proposals_url),
            "images": self._svc("image", self.image_url),
            "marketing": self._svc("marketing", self.marketing_url),
            "hub": self._svc(self.hub_subdomain, None),
        }

    def resolved_provider(self) -> str:
        if self.llm_provider and self.llm_provider != "auto":
            return self.llm_provider
        if self.anthropic_api_key:
            return "anthropic"
        if self.openai_api_key:
            return "openai"
        return "echo"


@lru_cache
def get_settings() -> Settings:
    return Settings()
