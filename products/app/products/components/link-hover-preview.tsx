'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  DRIVE_IMAGE_WIDTH_HOVER,
  DRIVE_IMAGE_WIDTH_THUMB,
  isVideoUrl,
  getDriveDirectLink,
} from '../lib/product-utils';
import {
  isPreviewLoadBlocked,
  prefetchMediaPreview,
  registerPreviewFailed,
  resolvePreviewSrc,
} from '../lib/media-preview-cache';
import type { LinkHoverState } from '../types/shared-types';

interface LinkHoverPreviewProps {
  state: LinkHoverState | null;
}

function normalizePreviewSrc(src: string | null | undefined): string | null {
  return src && src.trim() ? src : null;
}

function HoverPreviewImage({ url }: { url: string }) {
  const [src, setSrc] = React.useState<string | null>(() =>
    normalizePreviewSrc(
      resolvePreviewSrc(url, DRIVE_IMAGE_WIDTH_HOVER) ||
      resolvePreviewSrc(url, DRIVE_IMAGE_WIDTH_THUMB),
    ),
  );

  React.useEffect(() => {
    const hover = resolvePreviewSrc(url, DRIVE_IMAGE_WIDTH_HOVER);
    const thumb = resolvePreviewSrc(url, DRIVE_IMAGE_WIDTH_THUMB);
    const resolved = normalizePreviewSrc(hover || thumb);
    if (resolved) {
      setSrc(resolved);
    } else if (!isPreviewLoadBlocked(url, DRIVE_IMAGE_WIDTH_HOVER)) {
      // First paint: use lh3 direct link only when not in the negative cache.
      const direct = normalizePreviewSrc(getDriveDirectLink(url, DRIVE_IMAGE_WIDTH_HOVER));
      setSrc(direct);
    } else {
      setSrc(null);
    }
    let cancelled = false;
    if (!isPreviewLoadBlocked(url, DRIVE_IMAGE_WIDTH_HOVER)) {
      void prefetchMediaPreview(url, DRIVE_IMAGE_WIDTH_HOVER).then((loaded) => {
        if (cancelled || !loaded) return;
        setSrc(loaded);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!src) return null;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt="Preview"
      loading="eager"
      decoding="async"
      referrerPolicy="no-referrer"
      className="h-full w-full object-cover"
      onError={() => {
        // Hover size only — do not mark thumb failed if a smaller cached size still works.
        registerPreviewFailed(url, DRIVE_IMAGE_WIDTH_HOVER);
      }}
    />
  );
}

export function LinkHoverPreview({ state }: LinkHoverPreviewProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!state?.url) return;
    void prefetchMediaPreview(state.url, DRIVE_IMAGE_WIDTH_THUMB);
    void prefetchMediaPreview(state.url, DRIVE_IMAGE_WIDTH_HOVER);
  }, [state?.url]);

  if (!mounted || !state) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999] animate-fade-in"
      style={{
        left: Math.min(state.x + 20, window.innerWidth - 225),
        top: Math.min(state.y + 20, window.innerHeight - 245),
      }}
    >
      <div className="overflow-hidden rounded-xl border border-black/10 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/20 dark:bg-black/85">
        <div className="relative h-[200px] w-[200px] overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">
          {isVideoUrl(state.url) ? (
            <div className="flex h-full w-full items-center justify-center">
              <HoverPreviewImage url={state.url} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/50 bg-white/30 backdrop-blur-md">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <HoverPreviewImage url={state.url} />
          )}
        </div>
        <div className="mt-1.5 px-1.5 pb-1">
          <div className="truncate text-[11px] font-bold text-black/80 dark:text-white/90">
            {state.title}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="rounded bg-black/5 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-tighter text-black/50 dark:bg-white/10 dark:text-white/50">
              Code: {state.code}
            </span>
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-tighter text-emerald-700 dark:text-emerald-400">
              Var: {state.variant}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
