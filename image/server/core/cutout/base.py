from __future__ import annotations

import io
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable

from PIL import Image

# Optional callback providers may invoke to report fine-grained stages
# (e.g. "segmentation", "matting", "decontamination"). Safe to ignore.
StageCallback = Callable[[str], None]


def emit_stage(on_stage: "StageCallback | None", stage: str) -> None:
    if on_stage is not None:
        try:
            on_stage(stage)
        except Exception:  # noqa: BLE001 - progress reporting must never break processing
            pass


class CutoutEngine(str, Enum):
    SELF_HOSTED = "self_hosted"
    MANAGED_API = "managed_api"
    HYBRID = "hybrid"


class ProcessingMode(str, Enum):
    CPU = "cpu"
    GPU = "gpu"


class QualityMode(str, Enum):
    FAST = "fast"
    BALANCED = "balanced"
    PREMIUM = "premium"


class CutoutError(RuntimeError):
    """User-facing cutout failure raised by a provider."""


def _coerce(enum_cls, value, default):
    try:
        return enum_cls(str(value).strip().lower())
    except Exception:  # noqa: BLE001
        return default


@dataclass
class EngineConfig:
    """Everything a provider needs, resolved from env Settings (+ admin overrides).

    Kept as a plain dataclass so it can cross the thread/pool boundary as a dict.
    """

    engine: CutoutEngine = CutoutEngine.SELF_HOSTED
    processing_mode: ProcessingMode = ProcessingMode.CPU
    quality: QualityMode = QualityMode.BALANCED

    # self-hosted segmentation (rembg) parameters
    model: str = "birefnet-general"
    preserve_detail: bool = True
    mask_dilate: int = 1
    alpha_matting: bool = False
    foreground_threshold: int = 240
    background_threshold: int = 8
    erode_size: int = 0
    min_dimension: int = 1800
    max_dimension: int = 2048

    # managed API provider
    managed_api_enabled: bool = False
    managed_api_provider: str = "none"
    managed_api_key: str | None = None
    managed_api_timeout_s: float = 30.0

    # hybrid escalation
    hybrid_escalate_below: float = 0.55
    hybrid_managed_budget: int = -1

    @classmethod
    def from_settings(cls, settings: Any, sys_settings: Any | None = None) -> "EngineConfig":
        """Build from env Settings; admin SystemSettings (if given) override matching fields."""

        def pick(attr_env: str, attr_sys: str | None = None, default=None):
            val = getattr(settings, attr_env, default)
            if sys_settings is not None and attr_sys is not None:
                sys_val = getattr(sys_settings, attr_sys, None)
                if sys_val is not None:
                    return sys_val
            return val

        return cls(
            engine=_coerce(CutoutEngine, pick("image_cutout_engine", "cutout_engine"), CutoutEngine.SELF_HOSTED),
            processing_mode=_coerce(
                ProcessingMode, pick("image_processing_mode", "processing_mode"), ProcessingMode.CPU
            ),
            quality=_coerce(QualityMode, pick("image_quality_mode", "quality_mode"), QualityMode.BALANCED),
            model=pick("image_rembg_model", "rembg_model", "birefnet-general"),
            preserve_detail=bool(pick("image_rembg_preserve_detail", "rembg_preserve_detail", True)),
            mask_dilate=int(pick("image_rembg_mask_dilate", "rembg_mask_dilate", 1)),
            alpha_matting=bool(pick("image_rembg_alpha_matting", "rembg_alpha_matting", False)),
            foreground_threshold=int(pick("image_rembg_foreground_threshold", "rembg_foreground_threshold", 240)),
            background_threshold=int(pick("image_rembg_background_threshold", "rembg_background_threshold", 8)),
            erode_size=int(pick("image_rembg_erode_size", "rembg_erode_size", 0)),
            min_dimension=int(pick("image_rembg_min_dimension", "rembg_min_dimension", 1800)),
            max_dimension=int(getattr(settings, "image_rembg_max_dimension", 2048)),
            managed_api_enabled=bool(pick("image_managed_api_enabled", "managed_api_enabled", False)),
            managed_api_provider=str(pick("image_managed_api_provider", "managed_api_provider", "none") or "none"),
            managed_api_key=getattr(settings, "image_managed_api_key", None),
            managed_api_timeout_s=float(getattr(settings, "image_managed_api_timeout_s", 30.0)),
            hybrid_escalate_below=float(
                pick("image_hybrid_escalate_below", "hybrid_escalate_below", 0.55) or 0.55
            ),
            hybrid_managed_budget=int(getattr(settings, "image_hybrid_managed_budget", -1)),
        )

    def to_dict(self) -> dict[str, Any]:
        d = dict(self.__dict__)
        d["engine"] = self.engine.value
        d["processing_mode"] = self.processing_mode.value
        d["quality"] = self.quality.value
        return d

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "EngineConfig":
        data = dict(data)
        data["engine"] = _coerce(CutoutEngine, data.get("engine"), CutoutEngine.SELF_HOSTED)
        data["processing_mode"] = _coerce(ProcessingMode, data.get("processing_mode"), ProcessingMode.CPU)
        data["quality"] = _coerce(QualityMode, data.get("quality"), QualityMode.BALANCED)
        allowed = set(cls.__dataclass_fields__.keys())  # type: ignore[attr-defined]
        return cls(**{k: v for k, v in data.items() if k in allowed})


@dataclass
class CutoutResult:
    """A transparent RGBA cutout plus quality signal and provenance."""

    image: Image.Image
    confidence: float = 1.0
    provider: str = "unknown"
    model: str | None = None
    escalated: bool = False
    meta: dict[str, Any] = field(default_factory=dict)

    def to_png_bytes(self) -> bytes:
        buf = io.BytesIO()
        self.image.convert("RGBA").save(buf, format="PNG")
        return buf.getvalue()


class CutoutProvider(ABC):
    """A pluggable background-removal/matting backend."""

    name: str = "base"

    @abstractmethod
    def available(self, cfg: EngineConfig) -> bool:
        """Whether this provider can run given current config/environment."""

    @abstractmethod
    def cutout(
        self, image_bytes: bytes, cfg: EngineConfig, on_stage: StageCallback | None = None
    ) -> CutoutResult:
        """Return an RGBA cutout. Raise CutoutError on user-facing failure.

        `on_stage` (optional) reports fine-grained stages for live progress.
        """
