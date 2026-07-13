'use client';

import * as React from 'react';
import {
  acquireSequentialPreview,
  isPreviewLoaded,
  registerPreviewFailed,
  registerPreviewLoaded,
  resolvePreviewSrc,
  wasPreviewEverLoaded,
} from '../lib/media-preview-cache';
import { getDriveDirectLink } from '../lib/product-utils';
import { useMediaLoadGeneration, useMediaRowLoadTier } from './media-load-provider';
import type { MediaRowLoadTier } from './media-load-provider';

interface CachedMediaPreviewProps {
  url: string;
  width: number;
  className?: string;
  alt?: string;
  onBroken?: () => void;
  priority?: boolean;
  /** When false, skip new network work — but keep showing an already-loaded preview. */
  enabled?: boolean;
  sequentialKey?: string;
  mediaRowIndex?: number;
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
  mediaRowIndex,
}: CachedMediaPreviewProps) {
  const mediaLoadGeneration = useMediaLoadGeneration();
  const loadTier = useMediaRowLoadTier(mediaRowIndex);
  const [src, setSrc] = React.useState<string | null>(() => initialPreviewSrc(url, width));
  const [broken, setBroken] = React.useState(false);

  const cachedSrc = isPreviewLoaded(url, width) ? resolvePreviewSrc(url, width) : '';
  const warmSrc =
    !cachedSrc && wasPreviewEverLoaded(url, width) ? getDriveDirectLink(url, width) : '';
  const displaySrc = cachedSrc || src || warmSrc;

  React.useEffect(() => {
    setBroken(false);

    if (isPreviewLoaded(url, width)) {
      setSrc(resolvePreviewSrc(url, width));
      return;
    }

    if (wasPreviewEverLoaded(url, width)) {
      setSrc(getDriveDirectLink(url, width));
      return;
    }

    if (!enabled) return;

    let cancelled = false;

    const orderKey = sequentialKey ?? previewOrderKey(url, width);
    void acquireSequentialPreview(url, width, orderKey, effectiveLoadTier(loadTier)).then((resolved) => {
      if (!cancelled && resolved) setSrc(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [url, width, enabled, sequentialKey, mediaLoadGeneration, loadTier]);

  React.useEffect(() => {
    if (broken) onBroken?.();
  }, [broken, onBroken]);

  if (broken || !displaySrc) {
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
      src={displaySrc}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
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

function initialPreviewSrc(url: string, width: number): string | null {
  if (isPreviewLoaded(url, width)) return resolvePreviewSrc(url, width);
  if (wasPreviewEverLoaded(url, width)) return getDriveDirectLink(url, width);
  return null;
}

function effectiveLoadTier(tier: MediaRowLoadTier): MediaRowLoadTier {
  return tier === 'off' ? 'lookahead' : tier;
}

function previewOrderKey(url: string, width: number): string {
  return `z|${url.slice(-24)}|w${width}`;
}
