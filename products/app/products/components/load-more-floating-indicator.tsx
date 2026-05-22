'use client';

import * as React from 'react';

export interface LoadMoreFloatingIndicatorProps {
  pending: boolean;
  remainingCount: number;
  /** Shown while loading (default: "Loading more rows") */
  loadingLabel?: string;
  /** Prefix when idle (default: "Scroll for more") */
  idlePrefix?: string;
}

/** Floating load-more pill — stays at bottom of list panel while scrolling. */
export function LoadMoreFloatingIndicator({
  pending,
  remainingCount,
  loadingLabel = 'Loading more rows',
  idlePrefix = 'Scroll for more',
}: LoadMoreFloatingIndicatorProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-white via-white/80 to-transparent px-3 pb-3 pt-8 dark:from-zinc-950 dark:via-zinc-950/85 dark:to-transparent"
      aria-live="polite"
      aria-busy={pending}
    >
      <div
        className={
          'flex max-w-[min(100%,20rem)] items-center gap-2.5 rounded-full border px-4 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-all duration-300 ' +
          (pending
            ? 'border-emerald-500/20 bg-white/90 dark:border-emerald-400/25 dark:bg-zinc-900/90'
            : 'border-black/[0.06] bg-white/75 dark:border-white/10 dark:bg-zinc-900/70')
        }
      >
        {pending ? (
          <>
            <span className="flex shrink-0 items-center gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1 w-1 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-load-more-dot"
                  style={{ animationDelay: `${i * 0.14}s` }}
                />
              ))}
            </span>
            <span className="truncate text-[10px] font-medium tracking-wide text-black/60 dark:text-white/60">
              {loadingLabel}
            </span>
          </>
        ) : (
          <>
            <span
              className="h-px w-5 shrink-0 bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent animate-load-more-shimmer dark:via-emerald-400/60"
              aria-hidden
            />
            <span className="truncate text-[10px] font-medium tracking-wide text-black/45 dark:text-white/45">
              {idlePrefix}
              <span className="text-black/30 dark:text-white/30"> · </span>
              {remainingCount.toLocaleString()} not shown
            </span>
          </>
        )}
      </div>
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
