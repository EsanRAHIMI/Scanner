from __future__ import annotations

import io
import logging

import numpy as np
from PIL import Image, ImageFilter

from ..rembg_config import RembgConfig
from .base import (
    CutoutError,
    CutoutProvider,
    CutoutResult,
    EngineConfig,
    QualityMode,
    StageCallback,
    emit_stage,
)

logger = logging.getLogger("image-service")

# Lighter, faster segmentation model used for `fast` quality.
_FAST_MODEL = "isnet-general-use"
_FAST_MAX_DIM = 1280


def _rembg_config_from_engine(cfg: EngineConfig) -> RembgConfig:
    model = cfg.model
    max_dim = cfg.max_dimension
    min_dim = cfg.min_dimension
    if cfg.quality == QualityMode.FAST:
        model = _FAST_MODEL
        max_dim = min(cfg.max_dimension, _FAST_MAX_DIM)
        min_dim = min(cfg.min_dimension, _FAST_MAX_DIM)
    return RembgConfig(
        model=model,
        preserve_detail=cfg.preserve_detail,
        mask_dilate=cfg.mask_dilate,
        alpha_matting=cfg.alpha_matting,
        foreground_threshold=cfg.foreground_threshold,
        background_threshold=cfg.background_threshold,
        erode_size=cfg.erode_size,
        min_dimension=max(800, min_dim),
        max_dimension=max(1024, max_dim),
    )


# --------------------------------------------------------------------------- #
# Quality signal
# --------------------------------------------------------------------------- #
def estimate_confidence(alpha01: np.ndarray) -> float:
    """Heuristic 0..1 confidence from an alpha map (1 = clean, 0 = likely failure)."""
    fg = alpha01 > 0.5
    coverage = float(fg.mean()) if fg.size else 0.0
    # Pathological coverage usually means a failed cutout.
    if coverage < 0.003 or coverage > 0.97:
        return 0.1

    near_fg = alpha01 > 0.05
    band = (alpha01 > 0.05) & (alpha01 < 0.95)
    denom = float(near_fg.sum())
    band_fraction = float(band.sum()) / denom if denom > 0 else 1.0
    # A large fuzzy band = halos / unresolved thin detail.
    conf = 1.0 - min(1.0, band_fraction * 2.2)
    return float(max(0.0, min(1.0, conf)))


# --------------------------------------------------------------------------- #
# Dependency-free image ops (no scipy/opencv required)
# --------------------------------------------------------------------------- #
def _box_mean(arr: np.ndarray, radius: int) -> np.ndarray:
    """Mean filter via integral image. arr is 2D float32.

    Uses broadcasting instead of meshgrid so premium matting does not allocate
    several full-resolution index arrays at once.
    """
    if radius < 1:
        return arr
    h, w = arr.shape
    padded = np.pad(arr, ((1, 0), (1, 0)), mode="constant")
    integral = padded.cumsum(0).cumsum(1)
    r = radius
    ys = np.arange(h)
    xs = np.arange(w)
    y0 = np.clip(ys - r, 0, h)
    y1 = np.clip(ys + r + 1, 0, h)
    x0 = np.clip(xs - r, 0, w)
    x1 = np.clip(xs + r + 1, 0, w)
    total = (
        integral[y1[:, None], x1[None, :]]
        - integral[y0[:, None], x1[None, :]]
        - integral[y1[:, None], x0[None, :]]
        + integral[y0[:, None], x0[None, :]]
    )
    count = (y1[:, None] - y0[:, None]) * (x1[None, :] - x0[None, :])
    return (total / np.maximum(count, 1)).astype(np.float32)


def _guided_filter(guide: np.ndarray, src: np.ndarray, radius: int, eps: float) -> np.ndarray:
    """Edge-aware refinement of `src` (alpha) guided by `guide` (gray), both 0..1 2D."""
    mean_I = _box_mean(guide, radius)
    mean_p = _box_mean(src, radius)
    mean_Ip = _box_mean(guide * src, radius)
    cov_Ip = mean_Ip - mean_I * mean_p
    mean_II = _box_mean(guide * guide, radius)
    var_I = mean_II - mean_I * mean_I
    a = cov_Ip / (var_I + eps)
    b = mean_p - a * mean_I
    mean_a = _box_mean(a, radius)
    mean_b = _box_mean(b, radius)
    return np.clip(mean_a * guide + mean_b, 0.0, 1.0).astype(np.float32)


def _decontaminate_foreground(rgb: np.ndarray, alpha01: np.ndarray) -> np.ndarray:
    """Remove background color spill in semi-transparent edges (halo removal).

    Foreground color is estimated by in-painting opaque colors outward via a
    blurred, alpha-weighted average, then blended into the edge band. This is a
    fast CPU approximation of proper foreground estimation (FBA / pymatting).
    """
    a = alpha01[..., None]
    weighted = rgb * a
    # Alpha-weighted blur to "grow" trusted foreground colour into the edges.
    num = np.dstack([_box_mean(weighted[..., c], 4) for c in range(3)])
    den = _box_mean(alpha01, 4)[..., None]
    est_fg = np.where(den > 1e-3, num / np.maximum(den, 1e-3), rgb)
    edge = ((alpha01 > 0.02) & (alpha01 < 0.97))[..., None]
    out = np.where(edge, est_fg, rgb)
    return np.clip(out, 0, 255).astype(np.float32)


def _try_pymatting(rgb_u8: np.ndarray, alpha01: np.ndarray) -> tuple[np.ndarray, np.ndarray] | None:
    """Premium refinement using pymatting if installed. Returns (rgb_f32, alpha01)."""
    try:
        from pymatting import estimate_alpha_cf, estimate_foreground_ml  # type: ignore
    except Exception:  # noqa: BLE001
        return None
    try:
        image = rgb_u8.astype(np.float64) / 255.0
        # Trimap from the soft alpha: confident fg/bg + unknown band.
        trimap = np.full(alpha01.shape, 0.5, dtype=np.float64)
        trimap[alpha01 >= 0.92] = 1.0
        trimap[alpha01 <= 0.08] = 0.0
        alpha = estimate_alpha_cf(image, trimap)
        fg = estimate_foreground_ml(image, alpha)
        return (np.clip(fg * 255.0, 0, 255).astype(np.float32), alpha.astype(np.float32))
    except Exception as exc:  # noqa: BLE001
        logger.warning("pymatting refinement failed, using fallback: %s", exc)
        return None


class SelfHostedProvider(CutoutProvider):
    name = "self_hosted"

    def available(self, cfg: EngineConfig) -> bool:
        try:
            import rembg  # noqa: F401

            return True
        except Exception:  # noqa: BLE001
            return False

    # ---- balanced / fast: historical pipeline (unchanged output) ---------- #
    def _legacy(self, image_bytes: bytes, cfg: EngineConfig, on_stage: StageCallback | None = None) -> CutoutResult:
        from ..background_removal import loaded_model_name, remove_background
        from ..cutout_refine import refine_cutout

        rcfg = _rembg_config_from_engine(cfg)
        emit_stage(on_stage, "segmentation")
        cutout_png = remove_background(image_bytes, rcfg)
        emit_stage(on_stage, "matting")
        refined = refine_cutout(Image.open(io.BytesIO(cutout_png)), preserve_detail=rcfg.preserve_detail)
        rgba = refined.convert("RGBA")
        alpha01 = np.asarray(rgba.split()[3], dtype=np.float32) / 255.0
        return CutoutResult(
            image=rgba,
            confidence=estimate_confidence(alpha01),
            provider=self.name,
            model=loaded_model_name() or rcfg.model,
            meta={"quality": cfg.quality.value, "path": "legacy"},
        )

    # ---- premium: soft alpha + matting + decontamination ------------------ #
    def _premium(self, image_bytes: bytes, cfg: EngineConfig, on_stage: StageCallback | None = None) -> CutoutResult:
        from ..background_removal import _get_session, _prepare_for_inference, loaded_model_name

        try:
            from rembg import remove as rembg_remove
        except Exception as exc:  # noqa: BLE001
            raise CutoutError("rembg is not installed") from exc

        rcfg = _rembg_config_from_engine(cfg)
        emit_stage(on_stage, "preparing")
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        original_size = image.size
        infer_image, _ = _prepare_for_inference(image.convert("RGB"), rcfg)
        session = _get_session(rcfg.model)

        # Soft probability mask (keep continuous — no hard threshold/dilation).
        emit_stage(on_stage, "segmentation")
        mask = rembg_remove(infer_image, session=session, only_mask=True)
        if not isinstance(mask, Image.Image):
            mask = Image.open(io.BytesIO(mask))
        mask = mask.convert("L")

        rgb_u8 = np.asarray(infer_image.convert("RGB"), dtype=np.uint8)
        alpha01 = np.asarray(mask, dtype=np.float32) / 255.0

        emit_stage(on_stage, "matting")
        refined = _try_pymatting(rgb_u8, alpha01)
        if refined is not None:
            rgb_f32, alpha01 = refined
            path = "premium+pymatting"
        else:
            gray = np.asarray(infer_image.convert("L"), dtype=np.float32) / 255.0
            alpha01 = _guided_filter(gray, alpha01, radius=4, eps=1e-4)
            emit_stage(on_stage, "decontamination")
            rgb_f32 = _decontaminate_foreground(rgb_u8.astype(np.float32), alpha01)
            path = "premium+guided"

        # Snap near-solid / near-empty regions so wires stay crisp, bg stays clean.
        alpha01 = np.where(alpha01 > 0.97, 1.0, alpha01)
        alpha01 = np.where(alpha01 < 0.03, 0.0, alpha01)

        rgba_arr = np.dstack([rgb_f32, np.clip(alpha01 * 255.0, 0, 255)]).astype(np.uint8)
        result = Image.fromarray(rgba_arr, "RGBA")
        if result.size != original_size:
            result = result.resize(original_size, Image.Resampling.LANCZOS)

        conf = estimate_confidence(np.asarray(result.split()[3], dtype=np.float32) / 255.0)
        return CutoutResult(
            image=result,
            confidence=conf,
            provider=self.name,
            model=loaded_model_name() or rcfg.model,
            meta={"quality": cfg.quality.value, "path": path},
        )

    def cutout(self, image_bytes: bytes, cfg: EngineConfig, on_stage: StageCallback | None = None) -> CutoutResult:
        if cfg.quality == QualityMode.PREMIUM:
            return self._premium(image_bytes, cfg, on_stage)
        return self._legacy(image_bytes, cfg, on_stage)
