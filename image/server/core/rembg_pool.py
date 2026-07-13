from __future__ import annotations

import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor

from .rembg_config import RembgConfig
from .rembg_worker import extract_tight_cutout_bytes

logger = logging.getLogger("image-service")

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


def _apply_thread_limits() -> None:
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("MKL_NUM_THREADS", "1")


def _warmup_sync(config_dict: dict) -> str:
    from core.background_removal import loaded_model_name, warmup_model
    from core.rembg_config import RembgConfig

    _apply_thread_limits()
    config = RembgConfig.model_validate(config_dict)
    warmup_model(config)
    return loaded_model_name() or config.model


def _run_cutout_sync(image_bytes: bytes, config_dict: dict, on_stage=None) -> tuple[bytes, str | None]:
    _apply_thread_limits()
    return extract_tight_cutout_bytes(image_bytes, config_dict, on_stage)


async def run_cutout(image_bytes: bytes, config: RembgConfig, on_stage=None) -> tuple[bytes, str | None]:
    global _last_loaded_model
    loop = asyncio.get_running_loop()
    try:
        png_bytes, loaded = await loop.run_in_executor(
            _get_executor(),
            _run_cutout_sync,
            image_bytes,
            config.model_dump(),
            on_stage,
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


def _run_engine_sync(image_bytes: bytes, engine_dict: dict):
    _apply_thread_limits()
    from core.cutout import engine as cutout_engine
    from core.cutout.base import EngineConfig

    return cutout_engine.run_cutout(image_bytes, EngineConfig.from_dict(engine_dict))


async def run_engine(image_bytes: bytes, engine_config):
    """Run an explicit EngineConfig through the shared single-thread executor.

    Used by preview/compare so on-demand tests reuse the same serialized,
    OOM-safe worker as batch processing. Returns a CutoutResult.
    """
    global _last_loaded_model
    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(
            _get_executor(), _run_engine_sync, image_bytes, engine_config.to_dict()
        )
    except Exception as exc:  # noqa: BLE001
        message = str(exc).lower()
        if "terminated abruptly" in message or "broken process pool" in message or "memory" in message:
            raise RembgProcessingError(
                "AI cutout worker crashed (usually out of memory). "
                "Use quality=fast or a lighter model, lower Infer size, or give the "
                "Image API container at least 2GB RAM."
            ) from exc
        raise RembgProcessingError(f"Background removal failed: {exc}") from exc

    if getattr(result, "model", None):
        _last_loaded_model = result.model
    return result


async def warmup_worker(config: RembgConfig) -> str | None:
    loop = asyncio.get_running_loop()
    try:
        loaded = await loop.run_in_executor(
            _get_executor(),
            _warmup_sync,
            config.model_dump(),
        )
        global _last_loaded_model
        _last_loaded_model = loaded
        logger.info("Rembg model loaded: %s", loaded)
        return loaded
    except Exception:  # noqa: BLE001
        logger.exception("Rembg warmup failed — model will load on first image")
        return None
