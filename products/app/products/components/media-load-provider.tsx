'use client';

import * as React from 'react';

import { resetSequentialMediaQueue } from '../lib/media-preview-cache';

/** Extra rows below the bottom visible row to prefetch (on top of all visible rows). */
export const MEDIA_LOAD_LOOKAHEAD = 6;

/** Viewport max row moved more than this in one step → restart the sequential queue. */
const ANCHOR_JUMP_THRESHOLD = MEDIA_LOAD_LOOKAHEAD + 2;

type VisibleRange = { min: number; max: number };

export type MediaRowLoadTier = 'bootstrap' | 'visible' | 'lookahead' | 'off';

type MediaLoadContextValue = {
  visibleRange: VisibleRange;
  scrollRootEl: HTMLElement | null;
  mediaLoadGeneration: number;
  registerRowVisibility: (rowIndex: number, isVisible: boolean) => void;
  shouldLoadRow: (rowIndex: number) => boolean;
  getRowLoadTier: (rowIndex: number) => MediaRowLoadTier;
};

const MediaLoadContext = React.createContext<MediaLoadContextValue | null>(null);

const EMPTY_RANGE: VisibleRange = { min: 0, max: 0 };

function rangeFromVisible(visible: Set<number>): VisibleRange | null {
  if (visible.size === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const index of visible) {
    if (index < min) min = index;
    if (index > max) max = index;
  }
  return { min, max };
}

export function MediaLoadProvider({
  children,
  scrollRootRef,
  listResetKey,
}: {
  children: React.ReactNode;
  scrollRootRef: React.RefObject<HTMLElement | null>;
  listResetKey: string;
}) {
  const [visibleRange, setVisibleRange] = React.useState<VisibleRange>(EMPTY_RANGE);
  const [visibleRowCount, setVisibleRowCount] = React.useState(0);
  const [mediaLoadGeneration, setMediaLoadGeneration] = React.useState(0);
  const [scrollRootEl, setScrollRootEl] = React.useState<HTMLElement | null>(null);
  const visibleRowsRef = React.useRef<Set<number>>(new Set());
  const prevRangeRef = React.useRef<VisibleRange>(EMPTY_RANGE);
  const prevListResetKeyRef = React.useRef(listResetKey);

  const bumpMediaQueue = React.useCallback(() => {
    resetSequentialMediaQueue();
    setMediaLoadGeneration((g) => g + 1);
  }, []);

  const restartForNewList = React.useCallback(() => {
    visibleRowsRef.current = new Set();
    prevRangeRef.current = EMPTY_RANGE;
    setVisibleRange(EMPTY_RANGE);
    setVisibleRowCount(0);
    bumpMediaQueue();
  }, [bumpMediaQueue]);

  React.useEffect(() => {
    if (prevListResetKeyRef.current === listResetKey) return;
    prevListResetKeyRef.current = listResetKey;
    restartForNewList();
  }, [listResetKey, restartForNewList]);

  React.useEffect(() => {
    restartForNewList();
  }, [scrollRootRef, restartForNewList]);

  React.useLayoutEffect(() => {
    let frame = 0;
    const syncScrollRoot = () => {
      const next = scrollRootRef.current;
      setScrollRootEl((prev) => (prev === next ? prev : next));
    };
    syncScrollRoot();
    frame = requestAnimationFrame(syncScrollRoot);
    return () => cancelAnimationFrame(frame);
  });

  const registerRowVisibility = React.useCallback(
    (rowIndex: number, isVisible: boolean) => {
      if (!Number.isFinite(rowIndex) || rowIndex < 0) return;

      const visible = visibleRowsRef.current;
      if (isVisible) visible.add(rowIndex);
      else visible.delete(rowIndex);

      const nextRange = rangeFromVisible(visible);
      if (!nextRange) return;

      const prev = prevRangeRef.current;
      const jumped =
        nextRange.min < prev.min ||
        nextRange.max > prev.max + ANCHOR_JUMP_THRESHOLD ||
        (prev.max === 0 && nextRange.min > ANCHOR_JUMP_THRESHOLD);

      if (jumped && prevListResetKeyRef.current === listResetKey) {
        bumpMediaQueue();
      }

      prevRangeRef.current = nextRange;
      setVisibleRange(nextRange);
      setVisibleRowCount(visible.size);
    },
    [bumpMediaQueue, listResetKey],
  );

  const shouldLoadRow = React.useCallback(
    (rowIndex: number) => {
      if (!Number.isFinite(rowIndex) || rowIndex < 0) return false;
      return getRowLoadTierInternal(rowIndex, visibleRange, visibleRowCount) !== 'off';
    },
    [visibleRange, visibleRowCount],
  );

  const getRowLoadTier = React.useCallback(
    (rowIndex: number) => getRowLoadTierInternal(rowIndex, visibleRange, visibleRowCount),
    [visibleRange, visibleRowCount],
  );

  const value = React.useMemo(
    () => ({
      visibleRange,
      scrollRootEl,
      mediaLoadGeneration,
      registerRowVisibility,
      shouldLoadRow,
      getRowLoadTier,
    }),
    [visibleRange, scrollRootEl, mediaLoadGeneration, registerRowVisibility, shouldLoadRow, getRowLoadTier],
  );

  return <MediaLoadContext.Provider value={value}>{children}</MediaLoadContext.Provider>;
}

function getRowLoadTierInternal(
  rowIndex: number,
  visibleRange: VisibleRange,
  visibleRowCount: number,
): MediaRowLoadTier {
  if (!Number.isFinite(rowIndex) || rowIndex < 0) return 'off';
  if (visibleRowCount === 0) return rowIndex <= 12 ? 'bootstrap' : 'off';
  const { min, max } = visibleRange;
  if (rowIndex >= min && rowIndex <= max) return 'visible';
  if (rowIndex <= max + MEDIA_LOAD_LOOKAHEAD) return 'lookahead';
  return 'off';
}

export function useMediaLoad() {
  const ctx = React.useContext(MediaLoadContext);
  if (!ctx) {
    return {
      visibleRange: EMPTY_RANGE,
      scrollRootEl: null,
      mediaLoadGeneration: 0,
      registerRowVisibility: () => {},
      shouldLoadRow: () => true,
      getRowLoadTier: () => 'visible' as MediaRowLoadTier,
    };
  }
  return ctx;
}

/** Attach to a row/card root — reports enter/leave visibility for the load window. */
export function useMediaRowAnchor(rowIndex: number) {
  const { registerRowVisibility, scrollRootEl } = useMediaLoad();
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          registerRowVisibility(rowIndex, entry.isIntersecting);
        }
      },
      {
        root: scrollRootEl,
        rootMargin: scrollRootEl ? '120px 0px 360px 0px' : '160px 0px 480px 0px',
        threshold: 0,
      },
    );

    observer.observe(el);
    return () => {
      registerRowVisibility(rowIndex, false);
      observer.disconnect();
    };
  }, [rowIndex, registerRowVisibility, scrollRootEl]);

  return ref;
}

export function useMediaLoadGate(rowIndex: number | undefined): boolean {
  const { shouldLoadRow } = useMediaLoad();
  if (rowIndex === undefined) return true;
  return shouldLoadRow(rowIndex);
}

export function useMediaRowLoadTier(rowIndex: number | undefined): MediaRowLoadTier {
  const { getRowLoadTier } = useMediaLoad();
  if (rowIndex === undefined) return 'visible';
  return getRowLoadTier(rowIndex);
}

export function useMediaLoadGeneration(): number {
  return useMediaLoad().mediaLoadGeneration;
}

export function GalleryMediaAnchor({
  rowIndex,
  children,
  className,
}: {
  rowIndex: number;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useMediaRowAnchor(rowIndex);
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      data-media-row-index={rowIndex}
      className={className}
    >
      {children}
    </div>
  );
}
