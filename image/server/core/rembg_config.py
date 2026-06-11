from __future__ import annotations

from pydantic import BaseModel, Field

from .config import Settings

# Strongest → lightest (chandelier detail quality).
REMBG_MODELS = (
    "birefnet-general",  # 1
    "bria-rmbg",  # 2
    "isnet-general-use",  # 3
    "u2net",  # 4
)


class RembgConfig(BaseModel):
    model: str = "birefnet-general"
    preserve_detail: bool = True
    mask_dilate: int = Field(default=1, ge=0, le=5)
    alpha_matting: bool = False
    foreground_threshold: int = Field(default=240, ge=0, le=255)
    background_threshold: int = Field(default=8, ge=0, le=255)
    erode_size: int = Field(default=0, ge=0, le=20)
    min_dimension: int = Field(default=1800, ge=800, le=4096)
    max_dimension: int = Field(default=2048, ge=1024, le=4096)


def rembg_config_from_env(env: Settings) -> RembgConfig:
    return RembgConfig(
        model=env.image_rembg_model,
        preserve_detail=env.image_rembg_preserve_detail,
        mask_dilate=env.image_rembg_mask_dilate,
        alpha_matting=env.image_rembg_alpha_matting,
        foreground_threshold=env.image_rembg_foreground_threshold,
        background_threshold=env.image_rembg_background_threshold,
        erode_size=env.image_rembg_erode_size,
        min_dimension=env.image_rembg_min_dimension,
        max_dimension=env.image_rembg_max_dimension,
    )


def rembg_config_from_system(env: Settings, sys_settings) -> RembgConfig:
    return RembgConfig(
        model=sys_settings.rembg_model,
        preserve_detail=sys_settings.rembg_preserve_detail,
        mask_dilate=sys_settings.rembg_mask_dilate,
        alpha_matting=sys_settings.rembg_alpha_matting,
        foreground_threshold=sys_settings.rembg_foreground_threshold,
        background_threshold=sys_settings.rembg_background_threshold,
        erode_size=sys_settings.rembg_erode_size,
        min_dimension=sys_settings.rembg_min_dimension,
        max_dimension=env.image_rembg_max_dimension,
    )


def rembg_meta_dict(config: RembgConfig, *, loaded_model: str | None) -> dict:
    return {
        "configured_model": config.model,
        "loaded_model": loaded_model,
        "preserve_detail": config.preserve_detail,
        "mask_dilate": config.mask_dilate,
        "alpha_matting": config.alpha_matting,
        "foreground_threshold": config.foreground_threshold,
        "background_threshold": config.background_threshold,
        "erode_size": config.erode_size,
        "min_dimension": config.min_dimension,
    }
