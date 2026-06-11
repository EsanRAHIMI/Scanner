from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ProcessPoolExecutor

from .rembg_config import RembgConfig
from .rembg_worker import extract_tight_cutout_bytes

logger = logging.getLogger("image-service")

_executor: ProcessPoolExecutor | None = None
_last_loaded_model: str | None = None


def _get_executor() -> ProcessPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ProcessPoolExecutor(max_workers=1)
    return _executor


def pool_loaded_model() -> str | None:
    return _last_loaded_model


async def run_cutout(image_bytes: bytes, config: RembgConfig) -> tuple[bytes, str | None]:
    global _last_loaded_model
    loop = asyncio.get_running_loop()
    png_bytes, loaded = await loop.run_in_executor(
        _get_executor(),
        extract_tight_cutout_bytes,
        image_bytes,
        config.model_dump(),
    )
    if loaded:
        _last_loaded_model = loaded
    return png_bytes, loaded


async def warmup_worker(config: RembgConfig) -> str | None:
    """Load the model in the worker with a tiny image — non-blocking for API startup."""
    tiny = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
        b"\x01\x01\x01\x00\x18\xdd\x8d\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    try:
        _, loaded = await run_cutout(tiny, config)
        logger.info("Rembg worker ready: %s", loaded or config.model)
        return loaded
    except Exception:  # noqa: BLE001
        logger.exception("Rembg worker warmup failed")
        return None
