'use client';

import * as React from 'react';

/**
 * A thumbnail that shows the OFFICIAL composed image (cutout on the Lorenzo
 * background) and falls back to the raw cutout if compose is unavailable.
 * Display-only; used for the primary product image in the list `Image` column.
 */
export function ComposedThumb({
  composedSrc,
  rawSrc,
  alt,
  className,
  onOpen,
  onHover,
  onHoverEnd,
}: {
  composedSrc: string;
  rawSrc: string;
  alt?: string;
  className?: string;
  onOpen?: () => void;
  onHover?: (e: React.MouseEvent) => void;
  onHoverEnd?: () => void;
}) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [composedSrc, rawSrc]);

  const src = failed ? rawSrc : composedSrc;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? 'product'}
      className={className}
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => {
        if (!failed) setFailed(true);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.();
      }}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
    />
  );
}
