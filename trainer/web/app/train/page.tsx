'use client';

import * as React from 'react';

import { apiJson } from '@/lib/api';
import { ErrorBanner, PageHeader } from '@/lib/trainer-ui';
import type { ExportResponse, TrainStartResponse, TrainStatusResponse } from '@/types/trainer';

export default function TrainPage() {
  const [epochs, setEpochs] = React.useState(50);
  const [batch, setBatch] = React.useState(8);
  const [imgsz, setImgsz] = React.useState(640);

  const [jobId, setJobId] = React.useState<string>('');
  const [status, setStatus] = React.useState<TrainStatusResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [exportResult, setExportResult] = React.useState<ExportResponse | null>(null);

  const poll = React.useCallback(async () => {
    if (!jobId) return;
    try {
      const s = await apiJson<TrainStatusResponse>(`/train/${encodeURIComponent(jobId)}?lines=160`);
      setStatus(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to poll');
    }
  }, [jobId]);

  React.useEffect(() => {
    if (!jobId) return;
    const t = window.setInterval(() => {
      void poll();
    }, 2000);
    return () => window.clearInterval(t);
  }, [jobId, poll]);

  const start = React.useCallback(async () => {
    setStarting(true);
    setError(null);
    setStatus(null);
    try {
      const res = await apiJson<TrainStartResponse>('/train', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ epochs, batch, imgsz }),
      });
      setJobId(res.job_id);
      const s = await apiJson<TrainStatusResponse>(`/train/${encodeURIComponent(res.job_id)}?lines=40`);
      setStatus(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
    } finally {
      setStarting(false);
    }
  }, [batch, epochs, imgsz]);

  const exportDataset = React.useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await apiJson<ExportResponse>('/export', { method: 'POST' });
      setExportResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, []);

  const publish = React.useCallback(async () => {
    if (!jobId) return;
    setPublishing(true);
    setError(null);
    try {
      await apiJson(`/train/${encodeURIComponent(jobId)}/publish`, { method: 'POST' });
      await poll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }, [jobId, poll]);

  return (
    <main className="min-h-0 flex-1 space-y-6 overflow-y-auto scrollbar-minimal pr-1 pb-8 animate-fade-in">
      <PageHeader
        eyebrow="Model training"
        title="Train"
        description="Requires dataset export on the server. Training runs in the background and writes logs."
      />

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="dash-panel p-6">
          <h2 className="text-sm font-semibold text-brand-black">Parameters</h2>

          <div className="mt-4 space-y-3">
            <label className="block space-y-1.5">
              <span className="field-label">Epochs</span>
              <input className="field-input" type="number" min={1} value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} />
            </label>

            <label className="block space-y-1.5">
              <span className="field-label">Batch</span>
              <input className="field-input" type="number" min={1} value={batch} onChange={(e) => setBatch(Number(e.target.value))} />
            </label>

            <label className="block space-y-1.5">
              <span className="field-label">Image size</span>
              <input className="field-input" type="number" min={64} value={imgsz} onChange={(e) => setImgsz(Number(e.target.value))} />
            </label>

            <button className="btn-primary w-full" onClick={() => void start()} disabled={starting} type="button">
              {starting ? 'Starting…' : 'Start training'}
            </button>

            <button className="btn-outline w-full" onClick={() => void exportDataset()} disabled={exporting} type="button">
              {exporting ? 'Exporting…' : 'Export dataset (YOLO)'}
            </button>

            {exportResult ? (
              <div className="rounded-xl border border-brand-light-gray bg-brand-light-gray/50 p-3 text-xs text-brand-dark-gray">
                Exported: <span className="font-semibold text-brand-black">{exportResult.dataset}</span>
                <div className="mt-1 break-words">{exportResult.path}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="dash-panel p-6 lg:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-brand-black">Job</h2>
              <p className="text-xs text-brand-dark-gray">{jobId || 'No job running'}</p>
            </div>

            <button className="btn-outline" onClick={() => void poll()} disabled={!jobId} type="button">
              Refresh
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-brand-light-gray bg-brand-light-gray/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-medium-gray">Status</p>
              <p className="mt-1 text-sm font-semibold text-brand-black">{status?.status ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-brand-light-gray bg-brand-light-gray/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-medium-gray">best.pt</p>
              <p className="mt-1 break-words text-xs text-brand-dark-gray">{status?.best_pt ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-brand-light-gray bg-brand-light-gray/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-medium-gray">Metrics</p>
              <p className="mt-1 text-xs text-brand-dark-gray">
                {status?.metrics ? JSON.stringify(status.metrics) : '—'}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold text-brand-black">Logs</p>
            <pre className="mt-2 max-h-[420px] overflow-auto rounded-xl bg-brand-black p-4 text-xs text-brand-white scrollbar-minimal">
              {(status?.log ?? []).join('\n')}
            </pre>
          </div>

          <div className="mt-4">
            <button
              className="btn-primary"
              onClick={() => void publish()}
              disabled={!jobId || publishing || !status?.best_pt || status.status !== 'finished'}
              type="button"
            >
              {publishing ? 'Publishing…' : 'Publish to backend/models/best.pt'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
