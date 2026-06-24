'use client';

import * as React from 'react';

/**
 * Lorenzo official presentation frame for transparent / cutout product images.
 *
 * Source of truth: the Image service composes the cutout onto the OFFICIAL
 * Lorenzo background (1080×1440, contain-fit @ subject_fill_ratio, centered) via
 * `ImageProcessor.compose_on_background`. This component simply displays that
 * composed image — it does NOT invent a background or composition. The composed
 * URL is produced by the Products BFF (`/api/product-image/compose`).
 *
 * Display-only: nothing is written. If the composed image can't be produced
 * (service unavailable), it falls back to the plain cutout on a neutral
 * transparent area — never a made-up branded background.
 */
export function BrandedImageFrame({
  composedSrc,
  cutoutSrc,
  alt,
  onBroken,
  className,
}: {
  /** Official composed image URL (cutout on the real Lorenzo background). */
  composedSrc: string;
  /** Fallback: the plain transparent cutout, shown if composition is unavailable. */
  cutoutSrc: string;
  alt?: string;
  onBroken?: () => void;
  className?: string;
}) {
  const [composedFailed, setComposedFailed] = React.useState(false);

  // Reset the fallback state whenever the inputs change (card recycling).
  React.useEffect(() => {
    setComposedFailed(false);
  }, [composedSrc, cutoutSrc]);

  const src = composedFailed ? cutoutSrc : composedSrc;

  return (
    <div
      className={`absolute inset-0 flex h-full w-full items-center justify-center overflow-hidden ${className ?? ''}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ''}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        onError={() => {
          if (!composedFailed) setComposedFailed(true);
          else onBroken?.();
        }}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
