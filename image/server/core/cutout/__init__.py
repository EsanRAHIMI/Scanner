"""Provider-based cutout engine.

Switchable via environment variables / admin settings without code changes:

    IMAGE_CUTOUT_ENGINE   = self_hosted | managed_api | hybrid
    IMAGE_PROCESSING_MODE = cpu | gpu
    IMAGE_QUALITY_MODE    = fast | balanced | premium
    IMAGE_MANAGED_API_ENABLED = true | false

`balanced` quality on the `self_hosted` engine reproduces the historical
rembg-based pipeline byte-for-byte, so enabling this package changes nothing
until a stronger mode is selected.
"""

from .base import (
    CutoutEngine,
    CutoutError,
    CutoutProvider,
    CutoutResult,
    EngineConfig,
    ProcessingMode,
    QualityMode,
)

__all__ = [
    "CutoutEngine",
    "CutoutError",
    "CutoutProvider",
    "CutoutResult",
    "EngineConfig",
    "ProcessingMode",
    "QualityMode",
]
