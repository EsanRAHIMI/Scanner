from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from . import platform as P

"""Tool registry + permission layer.

- scope "read"   → auto-run (read-only platform lookups)
- scope "memory" → auto-run (writes only to the agent's OWN per-user memory)
- scope "write"  → NEVER auto-run; must be surfaced as a proposed action and
                   explicitly confirmed before a separate authorized call.
"""

Runtime = dict[str, Any]
Handler = Callable[[dict[str, Any], Runtime], Awaitable[dict[str, Any]]]


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    scope: str  # read | memory | write
    required_role: str  # user | sales | admin
    handler: Handler


@dataclass
class ToolRegistry:
    _tools: dict[str, Tool] = field(default_factory=dict)

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def all(self) -> list[Tool]:
        return list(self._tools.values())

    def list_public(self) -> list[dict[str, Any]]:
        return [
            {"name": t.name, "description": t.description, "scope": t.scope}
            for t in self._tools.values()
        ]

    def openai_schema(self, user: dict[str, Any]) -> list[dict[str, Any]]:
        out = []
        for t in self._tools.values():
            ok, _ = self.can_execute(t, user)
            if not ok and t.scope == "write":
                continue  # don't even expose writes to the model in v2
            out.append(
                {
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.input_schema,
                    },
                }
            )
        return out

    def can_execute(self, tool: Tool, user: dict[str, Any]) -> tuple[bool, str]:
        if tool.scope == "write":
            return False, "WRITE_REQUIRES_CONFIRMATION"
        order = {"user": 0, "sales": 1, "admin": 2}
        user_role = "admin" if user.get("is_admin") else str(user.get("role") or "user")
        if order.get(user_role, 0) < order.get(tool.required_role, 0):
            return False, "INSUFFICIENT_ROLE"
        return True, "OK"


registry = ToolRegistry()

registry.register(Tool(
    name="get_current_user_context",
    description=(
        "Return the CURRENT authenticated user and their on-screen context: display "
        "name, email, role/permissions, current app, page/module, current proposal id, "
        "and selected/visible product ids. Use this to answer 'what is my name', 'who am "
        "I', 'check my account', or to default arguments for other tools. Read-only."
    ),
    input_schema={"type": "object", "properties": {}},
    scope="read", required_role="user", handler=P.tool_get_current_user_context,
))

registry.register(Tool(
    name="search_products",
    description="Search the Lorenzo product catalog by name, code, or category. Read-only.",
    input_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Free-text search (name/code/category)."},
            "category": {"type": "string", "description": "Optional exact category filter."},
            "limit": {"type": "integer", "description": "Max results (default 12)."},
        },
    },
    scope="read", required_role="user", handler=P.tool_search_products,
))

registry.register(Tool(
    name="get_product_details",
    description="Get full details for one product by id. Defaults to the user's selected product if none given.",
    input_schema={
        "type": "object",
        "properties": {"product_id": {"type": "string"}},
    },
    scope="read", required_role="user", handler=P.tool_get_product_details,
))

registry.register(Tool(
    name="get_selected_products",
    description=(
        "Return full details for the products the user has CURRENTLY selected in the "
        "Products app (from session context). Use for 'what products are selected', "
        "'summarize my selection', or which selected products miss a main image. Read-only."
    ),
    input_schema={"type": "object", "properties": {}},
    scope="read", required_role="user", handler=P.tool_get_selected_products,
))

registry.register(Tool(
    name="get_visible_products_context",
    description=(
        "Return the products currently visible on the user's screen (the rendered "
        "rows reported by the page). Use for 'what product is this', 'explain this row', "
        "or 'what's on screen'. Read-only."
    ),
    input_schema={"type": "object", "properties": {}},
    scope="read", required_role="user", handler=P.tool_get_visible_products_context,
))

registry.register(Tool(
    name="get_visible_import_context",
    description=(
        "Return Excel Imports staging context: filename, visible row count, match columns "
        "(Excel → Products), Matched/Unmatched/Empty counts, match_analysis with why_unmatched "
        "and sample values, plus visible row snapshots. REQUIRED on /products/imports for "
        "questions about the import table, row counts, or why rows are Unmatched — NOT "
        "get_selected_products. Read-only."
    ),
    input_schema={"type": "object", "properties": {}},
    scope="read", required_role="user", handler=P.tool_get_visible_import_context,
))

registry.register(Tool(
    name="get_product_fields_schema",
    description=(
        "Explain the Products table fields (Num, Main Image, URL, Category, Material, "
        "Price, etc.) — their business meaning and the actual field keys present. Use "
        "when the user asks what a column means or how the table is structured. Read-only."
    ),
    input_schema={"type": "object", "properties": {}},
    scope="read", required_role="user", handler=P.tool_get_product_fields_schema,
))

registry.register(Tool(
    name="get_recent_proposals",
    description="List the user's recent proposals (admins see all). Read-only.",
    input_schema={"type": "object", "properties": {"limit": {"type": "integer"}}},
    scope="read", required_role="user", handler=P.tool_get_recent_proposals,
))

registry.register(Tool(
    name="get_proposal_details",
    description="Get one proposal's details by id (ownership enforced). Defaults to the current proposal in context.",
    input_schema={"type": "object", "properties": {"proposal_id": {"type": "string"}}},
    scope="read", required_role="user", handler=P.tool_get_proposal_details,
))

registry.register(Tool(
    name="get_current_proposal_context",
    description=(
        "Summarize the proposal the user is CURRENTLY viewing (from page context): "
        "title, status, customer, pricing, item count. Returns a clear 'no proposal "
        "open' when none is in context. Read-only."
    ),
    input_schema={"type": "object", "properties": {}},
    scope="read", required_role="user", handler=P.tool_get_current_proposal_context,
))

registry.register(Tool(
    name="get_product_image_context",
    description=(
        "Report image context for a product (defaults to the selected/first visible "
        "product): main image, gallery URLs, and whether official composed presentation "
        "is available. Read-only — never triggers an image render."
    ),
    input_schema={"type": "object", "properties": {"product_id": {"type": "string"}}},
    scope="read", required_role="user", handler=P.tool_get_product_image_context,
))

registry.register(Tool(
    name="get_main_image_status",
    description=(
        "Report which selected (or on-screen) products have a Main Image set vs missing. "
        "Use for 'which selected products are missing a main image'. Read-only — does not "
        "set or compose any image."
    ),
    input_schema={"type": "object", "properties": {}},
    scope="read", required_role="user", handler=P.tool_get_main_image_status,
))

registry.register(Tool(
    name="get_image_service_status",
    description="Check whether the Lorenzo image processing service is reachable. Read-only.",
    input_schema={"type": "object", "properties": {}},
    scope="read", required_role="user", handler=P.tool_get_image_service_status,
))

registry.register(Tool(
    name="get_platform_status",
    description="Overview of Lorenzo services and basic counts. Read-only.",
    input_schema={"type": "object", "properties": {}},
    scope="read", required_role="user", handler=P.tool_get_platform_status,
))

registry.register(Tool(
    name="remember_preference",
    description=(
        "Save ONE durable, reusable user preference — e.g. preferred response language, "
        "concise vs detailed style, Lorenzo brand tone, a repeated workflow preference, "
        "or useful project context. Use sparingly; never store transcripts or sensitive "
        "data (passwords, tokens, card/ID numbers). Per-user."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "key": {"type": "string", "description": "Short stable label, e.g. 'response_language'."},
            "value": {"type": "string", "description": "The preference value, e.g. 'Arabic'."},
            "kind": {
                "type": "string",
                "enum": ["preference", "language", "style", "tone", "workflow", "context"],
            },
        },
        "required": ["key", "value"],
    },
    scope="memory", required_role="user", handler=P.tool_remember_preference,
))
