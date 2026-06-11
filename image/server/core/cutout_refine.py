from __future__ import annotations

import numpy as np
from PIL import Image, ImageFilter


def refine_cutout(image: Image.Image) -> Image.Image:
    """Clean halos and background color spill while preserving thin product details."""
    image = image.convert("RGBA")
    arr = np.asarray(image, dtype=np.float32)
    rgb = arr[..., :3]
    alpha = arr[..., 3].copy()

    # Drop invisible noise that creates a dusty halo when composited.
    alpha[alpha < 10] = 0

    luminance = np.max(rgb, axis=-1)
    saturation = np.max(rgb, axis=-1) - np.min(rgb, axis=-1)
    edge = (alpha >= 10) & (alpha < 250)

    # Obvious white-background fringe on soft edges.
    white_fringe = edge & (luminance > 205) & (saturation < 45)
    alpha[white_fringe] *= 0.12

    fg_mask = alpha > 245
    if np.any(fg_mask):
        fg_color = np.median(rgb[fg_mask], axis=0)
        contam = edge & (np.linalg.norm(rgb - 255.0, axis=-1) < np.linalg.norm(rgb - fg_color, axis=-1))
        rgb[contam] = rgb[contam] * 0.35 + fg_color * 0.65

    # Smooth only the alpha channel on a narrow edge band (reduces stair-steps, keeps wires).
    edge_band = (alpha >= 10) & (alpha < 250)
    if np.any(edge_band):
        alpha_img = Image.fromarray(np.clip(alpha, 0, 255).astype(np.uint8), mode="L")
        blurred = np.asarray(alpha_img.filter(ImageFilter.GaussianBlur(radius=0.6)), dtype=np.float32)
        alpha[edge_band] = blurred[edge_band] * 0.55 + alpha[edge_band] * 0.45

    arr[..., :3] = np.clip(rgb, 0, 255)
    arr[..., 3] = np.clip(alpha, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")
