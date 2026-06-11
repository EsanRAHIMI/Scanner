from __future__ import annotations

import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor

from .rembg_config import RembgConfig
from .rembg_worker import extract_tight_cutout_bytes

logger = logging.getLogger("image-service")

# Single background thread — avoids ProcessPoolExecutor fork crashes under uvicorn.
_executor: ThreadPoolExecutor | None = None
_last_loaded_model: str | None = None


class RembgProcessingError(RuntimeError):
    """User-facing cutout failure."""


def _get_executor() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="rembg")
    return _executor


def pool_loaded_model() -> str | None:
    return _last_loaded_model


def _run_cutout_sync(image_bytes: bytes, config_dict: dict) -> tuple[bytes, str | None]:
    # Keep ONNX/Pillow from grabbing all CPU cores on small VPS hosts.
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("MKL_NUM_THREADS", "1")
    return extract_tight_cutout_bytes(image_bytes, config_dict)


async def run_cutout(image_bytes: bytes, config: RembgConfig) -> tuple[bytes, str | None]:
    global _last_loaded_model
    loop = asyncio.get_running_loop()
    try:
        png_bytes, loaded = await loop.run_in_executor(
            _get_executor(),
            _run_cutout_sync,
            image_bytes,
            config.model_dump(),
        )
    except Exception as exc:  # noqa: BLE001
        message = str(exc).lower()
        if "terminated abruptly" in message or "broken process pool" in message:
            raise RembgProcessingError(
                "AI cutout worker crashed (usually out of memory). "
                "In Settings → Runtime use model 3 or 4, lower Infer size, "
                "or give the Image API container at least 2GB RAM."
            ) from exc
        if "memory" in message or "oom" in message:
            raise RembgProcessingError(
                "Out of memory during background removal. "
                "Lower Infer size or switch to a lighter model (isnet / u2net)."
            ) from exc
        raise RembgProcessingError(f"Background removal failed: {exc}") from exc

    if loaded:
        _last_loaded_model = loaded
    return png_bytes, loaded


async def warmup_worker(config: RembgConfig) -> str | None:
    tiny = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
        b"\x01\x01\x01\x00\x18\xdd\x8d\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    try:
        _, loaded = await run_cutout(tiny, config)
        logger.info("Rembg ready: %s", loaded or config.model)
        return loaded
    except Exception:  # noqa: BLE001
        logger.exception("Rembg warmup failed")
        return None
