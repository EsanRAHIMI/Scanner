from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator

from .config import Settings
from .llm import stream_reply
from .tools import registry

"""The agentic turn.

For OpenAI it runs a function-calling loop: the model may call read-only tools,
whose calls/results are streamed to the UI as events, then the final answer is
streamed. Read + memory tools auto-run; write tools are never exposed/executed.
Non-OpenAI providers fall back to a plain streamed answer (no tools) for now.

Yields event dicts:
  {"type": "tool_call",   "name", "args"}
  {"type": "tool_result", "name", "ok", "summary"}
  {"type": "delta",       "text"}
  {"type": "error",       "detail"}
"""


def _truncate_result(result: dict[str, Any], limit: int = 6000) -> str:
    try:
        s = json.dumps(result, ensure_ascii=False, default=str)
    except Exception:
        s = str(result)
    return s if len(s) <= limit else s[:limit] + "…(truncated)"


async def _emit_text(text: str) -> AsyncIterator[dict[str, Any]]:
    # Chunk a (non-streamed) final answer for a live feel.
    words = text.split(" ")
    buf = ""
    for w in words:
        buf += w + " "
        if len(buf) >= 28:
            yield {"type": "delta", "text": buf}
            buf = ""
            await asyncio.sleep(0.01)
    if buf:
        yield {"type": "delta", "text": buf}


async def run_agent(
    *,
    settings: Settings,
    provider: str,
    system: str,
    messages: list[dict[str, str]],
    runtime: dict[str, Any],
) -> AsyncIterator[dict[str, Any]]:
    user = runtime.get("user") or {}

    if provider != "openai" or not settings.openai_api_key:
        # No tool-calling for non-OpenAI providers yet — plain streamed answer.
        async for delta in stream_reply(messages, system, settings):
            yield {"type": "delta", "text": delta}
        return

    try:
        from openai import AsyncOpenAI
    except Exception:
        async for delta in stream_reply(messages, system, settings):
            yield {"type": "delta", "text": delta}
        return

    client = AsyncOpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
    tools_schema = registry.openai_schema(user)
    oai_messages: list[dict[str, Any]] = [{"role": "system", "content": system}]
    oai_messages += [{"role": m["role"], "content": m["content"]} for m in messages]

    for _round in range(max(1, settings.agent_max_tool_rounds)):
        try:
            resp = await client.chat.completions.create(
                model=settings.openai_model,
                messages=oai_messages,  # type: ignore[arg-type]
                tools=tools_schema or None,
                tool_choice="auto" if tools_schema else None,
                max_tokens=1024,
            )
        except Exception as e:  # noqa: BLE001
            yield {"type": "error", "detail": f"LLM_ERROR: {e}"}
            return

        msg = resp.choices[0].message
        tool_calls = getattr(msg, "tool_calls", None)

        if not tool_calls:
            async for ev in _emit_text(msg.content or "I'm not sure how to help with that yet."):
                yield ev
            return

        oai_messages.append(
            {
                "role": "assistant",
                "content": msg.content or None,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in tool_calls
                ],
            }
        )

        for tc in tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except Exception:
                args = {}
            yield {"type": "tool_call", "name": name, "args": args}

            tool = registry.get(name)
            if tool is None:
                result = {"ok": False, "summary": f"Unknown tool: {name}"}
            else:
                allowed, reason = registry.can_execute(tool, user)
                if not allowed:
                    result = {"ok": False, "summary": reason}
                else:
                    try:
                        result = await tool.handler(args, runtime)
                    except Exception as e:  # noqa: BLE001
                        result = {"ok": False, "summary": f"Tool error: {e}"}

            yield {
                "type": "tool_result",
                "name": name,
                "ok": bool(result.get("ok")),
                "summary": result.get("summary", ""),
            }
            oai_messages.append(
                {"role": "tool", "tool_call_id": tc.id, "content": _truncate_result(result)}
            )

    # Tool-round budget exhausted — force a final answer without tools.
    try:
        resp = await client.chat.completions.create(
            model=settings.openai_model,
            messages=oai_messages,  # type: ignore[arg-type]
            max_tokens=1024,
        )
        final = resp.choices[0].message.content or "I gathered some data — could you narrow the question?"
    except Exception:
        final = "I gathered some information but couldn't finish. Please try a more specific question."
    async for ev in _emit_text(final):
        yield ev
