'use client';

import { useEffect, useMemo, useState } from 'react';

import type { BatchItem } from '@/lib/api';

const PHASES = [
  { min: 0, title: 'Preparing images', detail: 'Reading imported files' },
  { min: 12, title: 'Removing backgrounds', detail: 'AI cutout and cleanup' },
  { min: 40, title: 'Centering products', detail: 'Fitting to 1080 × 1440 canvas' },
  { min: 68, title: 'Applying template', detail: 'Background and watermark' },
  { min: 88, title: 'Almost ready', detail: 'Building review previews' },
] as const;

type BatchProcessingStateProps = {
  items: BatchItem[];
  showReady?: boolean;
};

function itemTileStatus(status: BatchItem['status']): 'pending' | 'active' | 'done' | 'failed' {
  if (status === 'processing') return 'active';
  if (status === 'failed') return 'failed';
  if (status === 'imported') return 'pending';
  return 'done';
}

function phaseForProgress(percent: number) {
  let current = PHASES[0];
  for (const phase of PHASES) {
    if (percent >= phase.min) current = phase;
  }
  return current;
}

export function BatchProcessingState({ items, showReady = false }: BatchProcessingStateProps) {
  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((item) =>
      ['processed', 'reviewed', 'background_applied', 'finalized'].includes(item.status),
    ).length;
    const active = items.filter((item) => item.status === 'processing').length;
    const failed = items.filter((item) => item.status === 'failed').length;
    const pending = Math.max(0, total - done - active - failed);
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, active, failed, pending, percent };
  }, [items]);

  const phase = phaseForProgress(showReady ? 100 : stats.percent);
  const [displayPercent, setDisplayPercent] = useState(stats.percent);

  useEffect(() => {
    const target = showReady ? 100 : stats.percent;
    const timer = window.setTimeout(() => setDisplayPercent(target), 40);
    return () => window.clearTimeout(timer);
  }, [showReady, stats.percent]);

  if (showReady) {
    return (
      <section className="dash-panel">
        <div className="dash-panel-body flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 processing-ready-pop">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-black">Ready for review</p>
            <p className="mt-1 text-xs text-brand-medium-gray">
              {stats.done} of {stats.total} images processed
            </p>
            <p className="mt-2 text-xs text-brand-dark-gray">Opening review below — no button needed.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="dash-panel">
      <div className="dash-panel-body space-y-6">
        <div className="flex flex-col items-center gap-5 py-4 text-center sm:py-8">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-brand-burgundy/15" />
            <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-burgundy processing-ring" />
            <span className="text-sm font-semibold tabular-nums text-brand-burgundy">{displayPercent}%</span>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold text-brand-black">{phase.title}</p>
            <p className="text-xs text-brand-medium-gray">{phase.detail}</p>
          </div>

          <div className="w-full max-w-md space-y-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-brand-light-gray">
              <div
                className="h-full rounded-full bg-brand-burgundy transition-[width] duration-700 ease-out"
                style={{ width: `${displayPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-brand-medium-gray">
              <span>
                {stats.done} of {stats.total} images
              </span>
              {stats.active > 0 ? <span>{stats.active} in progress</span> : <span>Step 1 → 2</span>}
            </div>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="border-t border-brand-medium-gray/15 pt-5">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-brand-medium-gray">
              Batch progress
            </p>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
              {items.map((item) => {
                const tile = itemTileStatus(item.status);
                return (
                  <div
                    key={item.id}
                    title={item.display_name}
                    className={`aspect-[3/4] rounded-md border transition-colors duration-500 ${
                      tile === 'done'
                        ? 'border-brand-burgundy/30 bg-brand-burgundy/10'
                        : tile === 'active'
                          ? 'border-brand-burgundy/50 bg-brand-burgundy/5 processing-tile-active'
                          : tile === 'failed'
                            ? 'border-red-300/60 bg-red-50'
                            : 'border-brand-medium-gray/20 bg-brand-light-gray/70 processing-tile-pending'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
