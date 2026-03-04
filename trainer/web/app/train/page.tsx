'use client';

import * as React from 'react';

import { apiJson } from '@/lib/api';
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
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Train</h1>
        <p className="mt-1 text-sm text-black/60">
          Requires dataset export on the server. Training runs in the background and writes logs.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="text-sm font-medium">Parameters</div>

          <div className="mt-4 space-y-3">
            <label className="block">
              <div className="text-xs text-black/50">Epochs</div>
              <input
                className="mt-1 w-full rounded-md border border-black/15 px-3 py-2 text-sm"
                type="number"
                min={1}
                value={epochs}
                onChange={(e) => setEpochs(Number(e.target.value))}
              />
            </label>

            <label className="block">
              <div className="text-xs text-black/50">Batch</div>
              <input
                className="mt-1 w-full rounded-md border border-black/15 px-3 py-2 text-sm"
                type="number"
                min={1}
                value={batch}
                onChange={(e) => setBatch(Number(e.target.value))}
              />
            </label>

            <label className="block">
              <div className="text-xs text-black/50">Image size</div>
              <input
                className="mt-1 w-full rounded-md border border-black/15 px-3 py-2 text-sm"
                type="number"
                min={64}
                value={imgsz}
                onChange={(e) => setImgsz(Number(e.target.value))}
              />
            </label>

            <button
              className="w-full rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/90 disabled:opacity-50"
              onClick={() => void start()}
              disabled={starting}
              type="button"
            >
              {starting ? 'Starting…' : 'Start training'}
            </button>

            <button
              className="w-full rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
              onClick={() => void exportDataset()}
              disabled={exporting}
              type="button"
            >
              {exporting ? 'Exporting…' : 'Export dataset (YOLO)'}
            </button>

            {exportResult ? (
              <div className="rounded-lg bg-black/5 p-3 text-xs text-black/70">
                Exported: <span className="font-medium">{exportResult.dataset}</span>
                <div className="mt-1 break-words">{exportResult.path}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium">Job</div>
              <div className="text-xs text-black/50">{jobId || 'No job running'}</div>
            </div>

            <button
              className="rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
              onClick={() => void poll()}
              disabled={!jobId}
              type="button"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-black/5 p-3">
              <div className="text-xs text-black/50">Status</div>
              <div className="mt-1 text-sm font-medium">{status?.status ?? '—'}</div>
            </div>
            <div className="rounded-lg bg-black/5 p-3">
              <div className="text-xs text-black/50">best.pt</div>
              <div className="mt-1 break-words text-xs text-black/70">{status?.best_pt ?? '—'}</div>
            </div>
            <div className="rounded-lg bg-black/5 p-3">
              <div className="text-xs text-black/50">Metrics</div>
              <div className="mt-1 text-xs text-black/70">
                {status?.metrics ? JSON.stringify(status.metrics) : '—'}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium">Logs</div>
            <pre className="mt-2 max-h-[420px] overflow-auto rounded-lg bg-black p-4 text-xs text-white">
              {(status?.log ?? []).join('\n')}
            </pre>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/90 disabled:opacity-50"
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
