from __future__ import annotations

import asyncio
from typing import Any, AsyncIterator

from .config import Settings

"""Provider-agnostic streaming chat.

`stream_reply` yields text chunks. The provider is selected from settings
(auto-detect by available key). Provider SDKs are imported lazily so the service
runs even if a given SDK isn't installed — falling back to a safe local "echo"
provider so the chat UI always works for testing without any API key.
"""


async def stream_reply(
    messages: list[dict[str, str]],
    system: str,
    settings: Settings,
) -> AsyncIterator[str]:
    provider = settings.resolved_provider()
    try:
        if provider == "anthropic":
            async for chunk in _anthropic_stream(messages, system, settings):
                yield chunk
            return
        if provider == "openai":
            async for chunk in _openai_stream(messages, system, settings):
                yield chunk
            return
    except Exception as e:  # noqa: BLE001 — never hard-fail the chat
        print(f"⚠  [agent] LLM provider '{provider}' failed, using echo: {e}", flush=True)

    async for chunk in _echo_stream(messages, system, settings):
        yield chunk


async def _anthropic_stream(
    messages: list[dict[str, str]], system: str, settings: Settings
) -> AsyncIterator[str]:
    from anthropic import AsyncAnthropic  # lazy import

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    async with client.messages.stream(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=system,
        messages=[{"role": m["role"], "content": m["content"]} for m in messages],
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def _openai_stream(
    messages: list[dict[str, str]], system: str, settings: Settings
) -> AsyncIterator[str]:
    from openai import AsyncOpenAI  # lazy import

    client = AsyncOpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
    chat_messages = [{"role": "system", "content": system}] + [
        {"role": m["role"], "content": m["content"]} for m in messages
    ]
    stream = await client.chat.completions.create(
        model=settings.openai_model,
        messages=chat_messages,  # type: ignore[arg-type]
        stream=True,
        max_tokens=1024,
    )
    async for event in stream:
        delta = event.choices[0].delta.content if event.choices else None
        if delta:
            yield delta


async def _echo_stream(
    messages: list[dict[str, str]], system: str, settings: Settings
) -> AsyncIterator[str]:
    """Safe fallback used when no LLM key is configured.

    Streams a clear, honest placeholder so the widget works end-to-end in dev.
    """
    last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    reply = (
        "I'm the Lorenzo assistant (running without an LLM key, so this is a "
        "placeholder reply). Set ANTHROPIC_API_KEY or OPENAI_API_KEY on the agent "
        "service to enable real answers. "
        f'You said: "{last_user[:300]}"'
    )
    for word in reply.split(" "):
        yield word + " "
        await asyncio.sleep(0.02)


def build_system_prompt(settings: Settings, memory: list[dict[str, Any]]) -> str:
    base = settings.agent_system_prompt
    if not memory:
        return base
    facts = "\n".join(
        f"- {m.get('key')}: {m.get('value')}" for m in memory if m.get("value")
    )
    if not facts.strip():
        return base
    return f"{base}\n\nKnown context about this user (use if relevant):\n{facts}"
