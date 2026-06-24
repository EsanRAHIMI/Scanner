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
    description="Save a useful, durable user preference or work-style note (e.g. preferred currency, summary format). Use sparingly for genuinely reusable context.",
    input_schema={
        "type": "object",
        "properties": {
            "key": {"type": "string"},
            "value": {"type": "string"},
            "kind": {"type": "string", "enum": ["preference", "fact", "context"]},
        },
        "required": ["key", "value"],
    },
    scope="memory", required_role="user", handler=P.tool_remember_preference,
))
