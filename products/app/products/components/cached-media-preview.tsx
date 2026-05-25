'use client';

import * as React from 'react';
import { prefetchMediaPreview, resolvePreviewSrc } from '../lib/media-preview-cache';

interface CachedMediaPreviewProps {
  url: string;
  width: number;
  className?: string;
  alt?: string;
  onBroken?: () => void;
}

export function CachedMediaPreview({
  url,
  width,
  className,
  alt = '',
  onBroken,
}: CachedMediaPreviewProps) {
  const [src, setSrc] = React.useState(() => resolvePreviewSrc(url, width));
  const [broken, setBroken] = React.useState(false);

  React.useEffect(() => {
    setBroken(false);
    setSrc(resolvePreviewSrc(url, width));
    let cancelled = false;
    void prefetchMediaPreview(url, width).then((loaded) => {
      if (cancelled || !loaded) return;
      setSrc(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [url, width]);

  React.useEffect(() => {
    if (broken) onBroken?.();
  }, [broken, onBroken]);

  if (broken || !src) return null;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setBroken(true)}
      className={className}
    />
  );
}
