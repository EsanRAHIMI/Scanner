from __future__ import annotations

import asyncio
import logging
import multiprocessing as mp
import os
from concurrent.futures import ProcessPoolExecutor

from .rembg_config import RembgConfig

logger = logging.getLogger("image-service")

# Spawn avoids fork-after-threads crashes under uvicorn; recycle kills the child
# so ONNX/ORT arenas return RSS to the OS after heavy cutouts.
_MP_CONTEXT = mp.get_context("spawn")
_executor: ProcessPoolExecutor | None = None
_last_loaded_model: str | None = None
_recycle_lock: asyncio.Lock | None = None


class RembgProcessingError(RuntimeError):
    """User-facing cutout failure."""


def _get_recycle_lock() -> asyncio.Lock:
    global _recycle_lock
    if _recycle_lock is None:
        _recycle_lock = asyncio.Lock()
    return _recycle_lock


def _get_executor() -> ProcessPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ProcessPoolExecutor(
            max_workers=1,
            mp_context=_MP_CONTEXT,
            initializer=_apply_thread_limits,
        )
    return _executor


def pool_loaded_model() -> str | None:
    return _last_loaded_model


def _apply_thread_limits() -> None:
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("MKL_NUM_THREADS", "1")


def _warmup_sync(config_dict: dict) -> str:
    from core.background_removal import loaded_model_name, warmup_model
    from core.rembg_config import RembgConfig as _RembgConfig

    _apply_thread_limits()
    config = _RembgConfig.model_validate(config_dict)
    warmup_model(config)
    return loaded_model_name() or config.model


def _run_cutout_sync(image_bytes: bytes, config_dict: dict) -> tuple[bytes, str | None]:
    """Top-level worker entry (must be picklable). Stage callbacks stay in the parent."""
    from core.rembg_worker import extract_tight_cutout_bytes

    _apply_thread_limits()
    return extract_tight_cutout_bytes(image_bytes, config_dict, on_stage=None)


def _run_engine_sync(image_bytes: bytes, engine_dict: dict):
    _apply_thread_limits()
    from core.cutout import engine as cutout_engine
    from core.cutout.base import EngineConfig

    return cutout_engine.run_cutout(image_bytes, EngineConfig.from_dict(engine_dict), on_stage=None)


def _shutdown_executor_sync(executor: ProcessPoolExecutor) -> None:
    executor.shutdown(wait=True, cancel_futures=True)


async def recycle_worker(reason: str = "") -> None:
    """Kill the rembg child process so ORT arenas release RSS back to the OS."""
    global _executor, _last_loaded_model
    async with _get_recycle_lock():
        if _executor is None:
            return
        logger.info("Recycling rembg worker (%s)", reason or "manual")
        executor = _executor
        _executor = None
        _last_loaded_model = None
        loop = asyncio.get_running_loop()
        try:
            await loop.run_in_executor(None, _shutdown_executor_sync, executor)
        except Exception:  # noqa: BLE001
            logger.exception("Rembg worker recycle failed")


async def run_cutout(image_bytes: bytes, config: RembgConfig, on_stage=None) -> tuple[bytes, str | None]:
    """Run cutout in the spawn worker. ``on_stage`` is accepted for API compat but ignored
    (callables are not picklable across processes — parent should set coarse stages)."""
    del on_stage  # cross-process callbacks are not supported
    global _last_loaded_model
    loop = asyncio.get_running_loop()
    try:
        async with _get_recycle_lock():
            executor = _get_executor()
        png_bytes, loaded = await loop.run_in_executor(
            executor,
            _run_cutout_sync,
            image_bytes,
            config.model_dump(),
        )
    except Exception as exc:  # noqa: BLE001
        message = str(exc).lower()
        if "terminated abruptly" in message or "broken process pool" in message:
            await recycle_worker("broken_pool")
            raise RembgProcessingError(
                "AI cutout worker crashed (usually out of memory). "
                "In Settings → Runtime use model 3 or 4, lower Infer size, "
                "or give the Image API container at least 2GB RAM."
            ) from exc
        if "memory" in message or "oom" in message:
            await recycle_worker("oom")
            raise RembgProcessingError(
                "Out of memory during background removal. "
                "Lower Infer size or switch to a lighter model (isnet / u2net)."
            ) from exc
        raise RembgProcessingError(f"Background removal failed: {exc}") from exc

    if loaded:
        _last_loaded_model = loaded
    return png_bytes, loaded


async def run_engine(image_bytes: bytes, engine_config):
    """Run an explicit EngineConfig through the shared single-worker process pool.

    Used by preview/compare so on-demand tests reuse the same serialized,
    OOM-safe worker as batch processing. Returns a CutoutResult.
    """
    global _last_loaded_model
    loop = asyncio.get_running_loop()
    try:
        async with _get_recycle_lock():
            executor = _get_executor()
        result = await loop.run_in_executor(
            executor, _run_engine_sync, image_bytes, engine_config.to_dict()
        )
    except Exception as exc:  # noqa: BLE001
        message = str(exc).lower()
        if "terminated abruptly" in message or "broken process pool" in message or "memory" in message:
            await recycle_worker("broken_pool")
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
        async with _get_recycle_lock():
            executor = _get_executor()
        loaded = await loop.run_in_executor(
            executor,
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
