from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

"""Tool registry + permission layer (FOUNDATION).

v1 ships the registry and the safety gate, plus read-only/mock tools. The chat
loop does NOT auto-execute write tools: any tool with scope='write' must be
surfaced to the UI as a *proposed action* and explicitly confirmed by the user
before a separate authorized call runs it. Real Product/Proposal/Image
integrations are added later, one read-only tool at a time.
"""


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    scope: str  # "read" | "write"
    required_role: str  # "user" | "sales" | "admin"
    handler: Callable[[dict[str, Any], dict[str, Any]], Awaitable[dict[str, Any]]]


@dataclass
class ToolRegistry:
    _tools: dict[str, Tool] = field(default_factory=dict)

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def list_public(self) -> list[dict[str, Any]]:
        return [
            {
                "name": t.name,
                "description": t.description,
                "scope": t.scope,
                "required_role": t.required_role,
            }
            for t in self._tools.values()
        ]

    def can_execute(self, tool: Tool, user: dict[str, Any]) -> tuple[bool, str]:
        """Permission gate. Writes are never auto-runnable from the model."""
        if tool.scope == "write":
            return False, "WRITE_REQUIRES_CONFIRMATION"
        order = {"user": 0, "sales": 1, "admin": 2}
        user_role = "admin" if user.get("is_admin") else str(user.get("role") or "user")
        if order.get(user_role, 0) < order.get(tool.required_role, 0):
            return False, "INSUFFICIENT_ROLE"
        return True, "OK"


# --- Example read-only tool (mock) -----------------------------------------

async def _platform_status(_args: dict[str, Any], _user: dict[str, Any]) -> dict[str, Any]:
    return {
        "ok": True,
        "services": ["products", "proposals", "images", "marketing", "trainer"],
        "note": "read-only status (mock)",
    }


registry = ToolRegistry()
registry.register(
    Tool(
        name="get_platform_status",
        description="Return a read-only overview of available Lorenzo services.",
        input_schema={"type": "object", "properties": {}},
        scope="read",
        required_role="user",
        handler=_platform_status,
    )
)
