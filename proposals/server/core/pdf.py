from __future__ import annotations

import asyncio
from typing import Any

from .config import get_settings

_browser_lock = asyncio.Lock()
_playwright: Any = None
_browser: Any = None


async def _get_browser() -> Any:
    """Lazily start a shared headless Chromium instance."""
    global _playwright, _browser
    async with _browser_lock:
        if _browser is not None and _browser.is_connected():
            return _browser
        from playwright.async_api import async_playwright

        if _playwright is None:
            _playwright = await async_playwright().start()
        _browser = await _playwright.chromium.launch(
            args=["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb"]
        )
        return _browser


async def html_to_pdf(html: str) -> bytes:
    """Render exact-layout HTML (1440x810 pages) into a high-quality PDF."""
    settings = get_settings()
    browser = await _get_browser()
    page = await browser.new_page(
        viewport={"width": settings.pdf_page_width_px, "height": settings.pdf_page_height_px},
        device_scale_factor=2,
    )
    try:
        await page.set_content(html, wait_until="networkidle", timeout=60_000)
        # Give webfonts a moment to settle even when networkidle fires early.
        try:
            await page.evaluate("document.fonts && document.fonts.ready")
        except Exception:
            pass
        pdf = await page.pdf(
            width=f"{settings.pdf_page_width_px}px",
            height=f"{settings.pdf_page_height_px}px",
            print_background=True,
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
        )
        return pdf
    finally:
        await page.close()


async def page_screenshot(html: str) -> bytes:
    """PNG of the first page (used for share-link previews if needed)."""
    settings = get_settings()
    browser = await _get_browser()
    page = await browser.new_page(
        viewport={"width": settings.pdf_page_width_px, "height": settings.pdf_page_height_px},
    )
    try:
        await page.set_content(html, wait_until="networkidle", timeout=60_000)
        element = await page.query_selector(".page")
        if element:
            return await element.screenshot(type="png")
        return await page.screenshot(type="png")
    finally:
        await page.close()


async def shutdown_pdf() -> None:
    global _playwright, _browser
    try:
        if _browser is not None:
            await _browser.close()
        if _playwright is not None:
            await _playwright.stop()
    except Exception:
        pass
    _browser = None
    _playwright = None
