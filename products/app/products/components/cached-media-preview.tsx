'use client';

import * as React from 'react';
import {
  registerPreviewFailed,
  registerPreviewLoaded,
  resolvePreviewSrc,
} from '../lib/media-preview-cache';

interface CachedMediaPreviewProps {
  url: string;
  width: number;
  className?: string;
  alt?: string;
  onBroken?: () => void;
  /** When true, skip prefetch queue delay and use higher fetch priority (front thumbnails). */
  priority?: boolean;
  /** When false, do not start loading until enabled (viewport / hover). */
  enabled?: boolean;
}

export function CachedMediaPreview({
  url,
  width,
  className,
  alt = '',
  onBroken,
  priority = false,
  enabled = true,
}: CachedMediaPreviewProps) {
  const [src, setSrc] = React.useState<string | null>(null);
  const [broken, setBroken] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) {
      setSrc(null);
      setBroken(false);
      return;
    }
    setBroken(false);
    setSrc(resolvePreviewSrc(url, width));
  }, [url, width, enabled]);

  React.useEffect(() => {
    if (broken) onBroken?.();
  }, [broken, onBroken]);

  if (!enabled || broken || !src) {
    return (
      <span
        aria-hidden
        className={
          (className ?? '') +
          ' block bg-gradient-to-br from-black/[0.06] to-black/[0.12] dark:from-white/[0.05] dark:to-white/[0.10]'
        }
      />
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'low'}
      referrerPolicy="no-referrer"
      draggable={false}
      onLoad={(e) => {
        const el = e.currentTarget;
        registerPreviewLoaded(url, width, el.currentSrc || el.src);
      }}
      onError={() => {
        registerPreviewFailed(url, width);
        setBroken(true);
      }}
      className={className}
    />
  );
}
