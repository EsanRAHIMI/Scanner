import { useState, useCallback, useEffect } from 'react';
import type { GalleryItem } from '../types/shared-types';

export function useLightbox(visibleGalleryItems: GalleryItem[]) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const openPreviewByUrl = useCallback((url: string) => {
    const idx = visibleGalleryItems.findIndex(i => i.allMedia.some(m => m.url === url || m.originalUrl === url));
    if (idx >= 0) {
      setPreviewIndex(idx);
      setPreviewId(visibleGalleryItems[idx].id);
    }
  }, [visibleGalleryItems]);

  const closePreview = useCallback(() => {
    setPreviewIndex(null);
    setPreviewId(null);
  }, []);

  const goPrev = useCallback(() => {
    setPreviewIndex(prev => {
      if (prev === null) return null;
      const n = visibleGalleryItems.length;
      if (n <= 1) return prev;
      const newIdx = (prev - 1 + n) % n;
      setPreviewId(visibleGalleryItems[newIdx]?.id ?? null);
      return newIdx;
    });
  }, [visibleGalleryItems]);

  const goNext = useCallback(() => {
    setPreviewIndex(prev => {
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

      if (e.key === 'Escape') closePreview();
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
  }, [closePreview, goNext, goPrev, previewIndex]);

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
