'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getBatchProgress, retryItem, type BatchProgress } from '@/lib/api';

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function StatusPill({ status }: { status: ProgressStatus }) {
  const map: Record<ProgressStatus, string> = {
    pending: 'bg-brand-light-gray/70 text-brand-medium-gray',
    processing: 'bg-brand-burgundy/10 text-brand-burgundy',
    completed: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-red-50 text-red-700',
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${map[status]}`}>{status}</span>;
}

type ProgressStatus = 'pending' | 'processing' | 'completed' | 'failed';

export function ProcessingScreen({
  batchId,
  onAllComplete,
}: {
  batchId: string;
  onAllComplete?: (progress: BatchProgress) => void;
}) {
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const completedFiredRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const p = await getBatchProgress(batchId);
      setProgress(p);
      setError(null);
      const finished = !p.active && p.completed + p.failed >= p.total && p.total > 0;
      if (finished && !completedFiredRef.current) {
        completedFiredRef.current = true;
        onAllComplete?.(p);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    }
  }, [batchId, onAllComplete]);

  useEffect(() => {
    completedFiredRef.current = false;
    void poll();
    const id = window.setInterval(() => void poll(), 1200);
    return () => window.clearInterval(id);
  }, [poll]);

  async function handleRetry(itemId: string) {
    setRetrying(itemId);
    try {
      await retryItem(itemId);
      completedFiredRef.current = false;
      await poll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetrying(null);
    }
  }

  if (!progress) {
    return <p className="text-sm text-brand-medium-gray">{error ?? 'Starting…'}</p>;
  }

  const pct = Math.round(progress.overall_percent);
  const done = progress.completed + progress.failed;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-medium-gray/15 bg-brand-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-brand-black">
              {progress.active ? 'Processing images…' : done >= progress.total ? 'Processing complete' : 'Paused'}
            </p>
            <p className="mt-0.5 text-xs text-brand-medium-gray">
              {done} of {progress.total} done
              {progress.failed > 0 ? ` · ${progress.failed} failed` : ''}
              {progress.current ? ` · ${progress.current.stage_label}` : ''}
            </p>
          </div>
          <div className="text-right text-xs text-brand-medium-gray">
            <p className="text-lg font-semibold text-brand-black">{pct}%</p>
            <p>
              {fmtMs(progress.elapsed_ms)} elapsed
              {progress.eta_ms != null ? ` · ~${fmtMs(progress.eta_ms)} left` : ''}
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-brand-light-gray/70">
          <div
            className="h-full rounded-full bg-brand-burgundy transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

      <ul className="divide-y divide-brand-medium-gray/10 overflow-hidden rounded-xl border border-brand-medium-gray/15 bg-brand-white">
        {progress.items.map((it) => (
          <li key={it.item_id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-6 shrink-0 text-center text-[11px] text-brand-medium-gray">{it.index}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm text-brand-black" title={it.name}>{it.name}</p>
                <StatusPill status={it.status} />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-light-gray/70">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${it.status === 'failed' ? 'bg-red-400' : 'bg-brand-burgundy'}`}
                    style={{ width: `${it.percent}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-[10px] text-brand-medium-gray">
                  {it.status === 'failed' ? 'failed' : it.status === 'completed' ? 'done' : it.stage_label}
                </span>
              </div>
              {it.error ? <p className="mt-1 truncate text-[10px] text-red-600" title={it.error}>{it.error}</p> : null}
            </div>
            <span className="w-12 shrink-0 text-right text-[10px] text-brand-medium-gray">{fmtMs(it.elapsed_ms)}</span>
            {it.status === 'failed' ? (
              <button
                type="button"
                className="btn-outline shrink-0 px-2.5 py-1 text-[10px]"
                disabled={retrying === it.item_id}
                onClick={() => void handleRetry(it.item_id)}
              >
                {retrying === it.item_id ? '…' : 'Retry'}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
