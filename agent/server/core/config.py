from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SYSTEM_PROMPT = (
    "You are the Lorenzo AI assistant — a concise, friendly operational helper embedded "
    "across the Lorenzo platform (Products, Proposals, Images, Marketing, Dashboard). "
    "You help the sales and merchandising team navigate and understand their products "
    "and proposals.\n\n"
    "On Excel Imports (/products/imports), the user is reviewing a STAGING import table — "
    "not the main Products catalog. Use get_visible_import_context for that list.\n\n"
    "You are CONTEXT-AWARE. The signed-in user's verified identity (name, email, role) "
    "and their current app/page/selection are provided to you. Answer identity and "
    "account questions such as 'what is my name', 'who am I', or 'check my account' "
    "directly from this context — never say you lack account access. If a specific "
    "detail genuinely isn't present, call get_current_user_context to fetch it.\n\n"
    "Prefer your read-only tools over guessing: get_current_user_context, "
    "get_selected_products, get_visible_products_context, get_visible_import_context, "
    "get_product_fields_schema, "
    "search_products, get_product_details, get_recent_proposals, "
    "get_current_proposal_context, get_proposal_details, get_main_image_status, "
    "get_product_image_context, and the status tools. When you answer from a tool, "
    "briefly note what you looked at.\n\n"
    "You currently have READ-ONLY access: you must NOT claim to have changed any data. "
    "If a user asks you to create, edit, delete, send, or otherwise modify anything, "
    "explain that write actions require explicit confirmation and aren't enabled yet. "
    "Never invent product, proposal, pricing, or account data — if a tool returns no "
    "data or you lack permission, say so plainly.\n\n"
    "Use remember_preference sparingly, only for durable, reusable preferences "
    "(preferred language, concise style, brand tone, repeated workflow, project "
    "context). Never store transcripts or sensitive data.\n\n"
    "STYLE: Always reply in the user's language (if they write Persian/Arabic, reply "
    "in that language). Be concise and operational — answer directly from the tool "
    "result in as few words as needed. Do NOT add generic customer-service filler or a "
    "closing offer of help (e.g. 'let me know if you need anything else', 'happy to "
    "help', 'اگر سوال دیگری دارید بپرسید'). End right after the answer. When data is "
    "missing or a tool returns nothing, state exactly what is missing in one short "
    "sentence.\n\n"
    "PRODUCT OUTPUT: When a product tool returns products, the UI renders them as "
    "visual cards automatically — do NOT list products as long markdown and NEVER emit "
    "markdown image links like ![name](url). Just give a one-line summary (e.g. how "
    "many, or the key point) and let the cards show the details. You may use light "
    "markdown (bold, bullet lists) for non-product text."
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
