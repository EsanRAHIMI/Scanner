from __future__ import annotations

import logging

from .base import CutoutEngine, CutoutError, CutoutResult, EngineConfig, ProcessingMode, StageCallback
from .gpu import GpuMattingProvider
from .managed_api import ManagedApiProvider
from .self_hosted import SelfHostedProvider

logger = logging.getLogger("image-service")

_self_hosted = SelfHostedProvider()
_managed = ManagedApiProvider()
_gpu = GpuMattingProvider()


def _local_provider(cfg: EngineConfig):
    """CPU self-hosted, or GPU if explicitly selected and implemented."""
    if cfg.processing_mode == ProcessingMode.GPU and _gpu.available(cfg):
        return _gpu
    return _self_hosted


def run_cutout(
    image_bytes: bytes,
    cfg: EngineConfig,
    *,
    allow_managed: bool = True,
    on_stage: StageCallback | None = None,
) -> CutoutResult:
    """Resolve the configured engine to a concrete provider and produce a cutout.

    Fallback rules keep the service stable:
      * managed_api selected but unavailable -> self-hosted
      * hybrid -> self-hosted first, escalate to managed only when the local
        result is weak (confidence < threshold) and managed is available.
      * any provider failure in hybrid/managed falls back to self-hosted.
    """
    engine = cfg.engine
    managed_ok = allow_managed and _managed.available(cfg)

    # Pure managed.
    if engine == CutoutEngine.MANAGED_API:
        if managed_ok:
            try:
                return _managed.cutout(image_bytes, cfg, on_stage)
            except CutoutError as exc:
                logger.warning("Managed API failed, falling back to self-hosted: %s", exc)
        else:
            logger.info("Managed API selected but not available; using self-hosted.")
        return _local_provider(cfg).cutout(image_bytes, cfg, on_stage)

    # Pure self-hosted (CPU or future GPU).
    if engine == CutoutEngine.SELF_HOSTED:
        return _local_provider(cfg).cutout(image_bytes, cfg, on_stage)

    # Hybrid: local first, escalate weak results to managed.
    local = _local_provider(cfg).cutout(image_bytes, cfg, on_stage)
    if not managed_ok:
        return local
    if local.confidence >= cfg.hybrid_escalate_below:
        return local

    logger.info(
        "Hybrid escalation: local confidence %.2f < %.2f -> managed API",
        local.confidence,
        cfg.hybrid_escalate_below,
    )
    try:
        managed = _managed.cutout(image_bytes, cfg, on_stage)
    except CutoutError as exc:
        logger.warning("Hybrid managed escalation failed, keeping local result: %s", exc)
        return local

    # Keep whichever looks better.
    if managed.confidence >= local.confidence:
        managed.escalated = True
        managed.meta["local_confidence"] = round(local.confidence, 3)
        return managed
    return local
