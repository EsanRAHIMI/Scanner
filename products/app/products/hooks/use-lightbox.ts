import { useState, useCallback, useEffect, useMemo } from 'react';
import type { GalleryItem } from '../types/shared-types';
import {
  buildGalleryOpenUrlIndexMap,
  resolveGalleryIndexFromOpenMap,
  sameGoogleHostedMediaUrl,
} from '../lib/product-utils';
import { markLightboxTrace } from '../lib/lightbox-perf';

export function useLightbox(visibleGalleryItems: GalleryItem[]) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const openUrlIndexMap = useMemo(
    () => buildGalleryOpenUrlIndexMap(visibleGalleryItems),
    [visibleGalleryItems],
  );

  const openPreviewByUrl = useCallback(
    (url: string) => {
      markLightboxTrace('openPreviewByUrl:start');
      const lookupStart = performance.now();
      let idx = resolveGalleryIndexFromOpenMap(openUrlIndexMap, url);
      markLightboxTrace(
        'lookup:openUrlIndexMap',
        `duration=${(performance.now() - lookupStart).toFixed(2)}ms hit=${idx >= 0}`,
      );
      if (idx < 0) {
        const fallbackStart = performance.now();
        const clicked = url.trim();
        idx = visibleGalleryItems.findIndex((i) =>
          i.allMedia.some(
            (m) =>
              sameGoogleHostedMediaUrl(clicked, m.url) ||
              sameGoogleHostedMediaUrl(clicked, m.originalUrl),
          ),
        );
        markLightboxTrace(
          'lookup:fallback-scan',
          `duration=${(performance.now() - fallbackStart).toFixed(2)}ms hit=${idx >= 0}`,
        );
      }
      if (idx >= 0) {
        markLightboxTrace('lightbox:setState:start', `index=${idx}`);
        setPreviewIndex(idx);
        setPreviewId(visibleGalleryItems[idx].id);
        markLightboxTrace('openPreviewByUrl:end');
      }
    },
    [openUrlIndexMap, visibleGalleryItems],
  );

  const closePreview = useCallback(() => {
    setPreviewIndex(null);
    setPreviewId(null);
  }, []);

  const goPrev = useCallback(() => {
    setPreviewIndex((prev) => {
      if (prev === null) return null;
      const n = visibleGalleryItems.length;
      if (n <= 1) return prev;
      const newIdx = (prev - 1 + n) % n;
      setPreviewId(visibleGalleryItems[newIdx]?.id ?? null);
      return newIdx;
    });
  }, [visibleGalleryItems]);

  const goNext = useCallback(() => {
    setPreviewIndex((prev) => {
      if (prev === null) return null;
      const n = visibleGalleryItems.length;
      if (n <= 1) return prev;
      const newIdx = (prev + 1) % n;
      setPreviewId(visibleGalleryItems[newIdx]?.id ?? null);
      return newIdx;
    });
  }, [visibleGalleryItems]);

  useEffect(() => {
    if (previewIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const blockedKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
      if (blockedKeys.includes(e.key)) {
        e.preventDefault();
      }

      // Escape is handled by SocialFeed / LightboxViewer so close can restore list scroll.
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [goNext, goPrev, previewIndex]);

  useEffect(() => {
    if (previewIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [previewIndex]);

  return {
    previewIndex,
    setPreviewIndex,
    previewId,
    setPreviewId,
    openPreviewByUrl,
    closePreview,
    goPrev,
    goNext,
  };
}
