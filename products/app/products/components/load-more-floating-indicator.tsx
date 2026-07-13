'use client';

import * as React from 'react';

export interface LoadMoreFloatingIndicatorProps {
  pending: boolean;
  remainingCount: number;
  /** User scrolled to the bottom and every row is loaded. */
  atEnd?: boolean;
  /** True when server has more pages (or we expect more pages). */
  hasMoreOnServer?: boolean;
  /** True while a next-page request is in flight. */
  serverLoading?: boolean;
  /** Loaded rows in current filtered list. */
  loadedCount?: number;
  /** Rows currently rendered in viewport list window. */
  visibleCount?: number;
  onJumpToTop?: () => void;
  loadingLabel?: string;
}

/** Minimal hint beside the vertical scrollbar (bottom-right of the scroll panel). */
export function LoadMoreFloatingIndicator({
  pending,
  remainingCount,
  atEnd = false,
  hasMoreOnServer = false,
  serverLoading = false,
  loadedCount,
  visibleCount,
  onJumpToTop,
  loadingLabel = 'Loading…',
}: LoadMoreFloatingIndicatorProps) {
  const showMore = remainingCount > 0;
  const showServerMore = hasMoreOnServer || serverLoading;
  const showingServerLoad = serverLoading && !showMore;
  const statusText =
    typeof visibleCount === 'number' && typeof loadedCount === 'number'
      ? `${visibleCount.toLocaleString()} / ${loadedCount.toLocaleString()}`
      : typeof loadedCount === 'number'
        ? `${loadedCount.toLocaleString()} loaded`
        : null;

  if (!showMore && !atEnd && !showServerMore) return null;

  return (
    <div
      className="pointer-events-none absolute bottom-2 right-2 z-20 flex items-center gap-1.5 pr-0.5 text-[10px] font-medium leading-none text-black/40 dark:text-white/38"
      aria-live="polite"
      aria-busy={pending}
    >
      {pending || showingServerLoad ? (
        <>
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent opacity-80"
            aria-hidden
          />
          <span>{showingServerLoad ? 'Loading more products…' : loadingLabel}</span>
        </>
      ) : showMore ? (
        <>
          <svg
            className="h-3 w-3 shrink-0 opacity-55"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            aria-hidden
          >
            <path d="M8 3v7M5 7l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="tabular-nums">{remainingCount.toLocaleString()} more</span>
          {statusText ? <span className="opacity-70">({statusText})</span> : null}
        </>
      ) : showServerMore ? (
        <>
          <svg
            className="h-3 w-3 shrink-0 opacity-55"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            aria-hidden
          >
            <path d="M8 3v7M5 7l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Scroll to load more</span>
          {statusText ? <span className="opacity-70">({statusText})</span> : null}
        </>
      ) : (
        <>
          <span className="text-black/35 dark:text-white/32">End of list</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onJumpToTop?.();
            }}
            className="pointer-events-auto inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-black/50 transition-colors hover:text-emerald-600 dark:text-white/45 dark:hover:text-emerald-400"
            title="Jump to top"
            aria-label="Jump to top"
          >
            <svg
              className="h-3 w-3 shrink-0"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden
            >
              <path d="M8 13V6M5 9l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Top</span>
          </button>
        </>
      )}
    </div>
  );
}

/** Spacer at end of scroll content (load-more is driven by scroll position, not intersection). */
export function LoadMoreScrollSentinel({
  sentinelRef,
}: {
  sentinelRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <div className="h-12 shrink-0" aria-hidden />
      <div ref={sentinelRef} className="h-px w-full min-w-full shrink-0 opacity-0" aria-hidden />
    </>
  );
}
