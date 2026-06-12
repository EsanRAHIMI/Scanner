from __future__ import annotations

import logging

from .base import CutoutError, CutoutProvider, CutoutResult, EngineConfig, StageCallback

logger = logging.getLogger("image-service")


class GpuMattingProvider(CutoutProvider):
    """Placeholder for a future GPU-based self-hosted matting backend.

    When the service moves to a GPU host, implement `cutout()` here with a
    high-quality matting model (e.g. ViTMatte / BiRefNet-HR / MatteAnything)
    using onnxruntime-gpu or torch+CUDA. The rest of the pipeline (renditions,
    storage, review workflow) stays unchanged — only this provider is added.

    It is intentionally unavailable until implemented, so selecting GPU mode
    on a CPU host transparently falls back to the self-hosted CPU provider.
    """

    name = "gpu"

    def available(self, cfg: EngineConfig) -> bool:
        # Not implemented yet — never reports available so callers fall back.
        return False

    def cutout(self, image_bytes: bytes, cfg: EngineConfig, on_stage: StageCallback | None = None) -> CutoutResult:
        raise CutoutError(
            "GPU matting provider is not implemented yet. "
            "Set IMAGE_PROCESSING_MODE=cpu (default) until a GPU backend is added."
        )
