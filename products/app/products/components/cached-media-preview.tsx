'use client';

import * as React from 'react';
import {
  acquireSequentialPreview,
  isPreviewLoaded,
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
  /** Stable sort key for sequential one-at-a-time loading (e.g. row index). */
  sequentialKey?: string;
}

export function CachedMediaPreview({
  url,
  width,
  className,
  alt = '',
  onBroken,
  priority = false,
  enabled = true,
  sequentialKey,
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

    if (isPreviewLoaded(url, width)) {
      setSrc(resolvePreviewSrc(url, width));
      return;
    }

    let cancelled = false;
    setSrc(null);

    const orderKey = sequentialKey ?? previewOrderKey(url, width);
    void acquireSequentialPreview(url, width, orderKey).then((resolved) => {
      if (!cancelled && resolved) setSrc(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [url, width, enabled, sequentialKey]);

  React.useEffect(() => {
    if (broken) onBroken?.();
  }, [broken, onBroken]);

  if (!enabled || broken || !src) {
    return (
      <span
        aria-hidden
        className={
          (className ?? '') +
          ' block h-full w-full min-h-[2.5rem] bg-gradient-to-br from-black/[0.06] to-black/[0.12] dark:from-white/[0.05] dark:to-white/[0.10]'
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

function previewOrderKey(url: string, width: number): string {
  return `z|${url.slice(-24)}|w${width}`;
}
