'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@/components/page-header';
import {
  finalizeBatch,
  getBatch,
  renameItem,
  reprocessItem,
  resolveMediaUrl,
  type Batch,
  type BatchItem,
} from '@/lib/api';

const STEPS = ['Processing', 'Review', 'Finalize'] as const;

function previewUrl(item: BatchItem): string | null {
  return resolveMediaUrl(item.final_url || item.processed_url || item.original_url);
}

export default function BatchWorkflowPage() {
  const params = useParams<{ batchId: string }>();
  const batchId = params.batchId;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const batchRes = await getBatch(batchId);
    setBatch(batchRes.batch);
    setItems(batchRes.items);
  }, [batchId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await refresh();
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load batch');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!batch || batch.status === 'finalized' || batch.status === 'failed') return;
    const timer = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [batch, refresh]);

  const activeStep = useMemo(() => {
    if (!batch) return 0;
    if (batch.status === 'processing' || batch.status === 'draft') return 0;
    if (batch.status === 'review' || batch.status === 'background') return 1;
    return 2;
  }, [batch]);

  async function handleRename(item: BatchItem, name: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await renameItem(item.id, name);
      setItems((prev) => prev.map((row) => (row.id === item.id ? res.item : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleReprocess(itemId: string) {
    setBusy(true);
    try {
      await reprocessItem(itemId);
      setMessage('Reprocessing started');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reprocess failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalize() {
    setBusy(true);
    setError(null);
    try {
      const res = await finalizeBatch(batchId);
      setBatch(res.batch);
      setMessage(`Finalized ${res.outputs.length} image(s).`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Finalize failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-brand-medium-gray">Loading batch…</p>;
  if (!batch) return <p className="text-sm text-red-700">Batch not found.</p>;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Batch workflow"
        title={batch.name}
        description={`Source: ${batch.source} · 1080 × 1440 · default background applied`}
        actions={
          <Link href="/" className="btn-outline h-9 px-3 text-xs">
            ← Import
          </Link>
        }
      />

      <section className="dash-panel">
        <div className="dash-panel-body">
          <ol className="grid gap-2 sm:grid-cols-3">
            {STEPS.map((label, idx) => (
              <li
                key={label}
                className={`rounded-xl border px-3 py-2 text-xs sm:text-sm ${
                  idx <= activeStep
                    ? 'border-brand-burgundy/40 bg-brand-burgundy/5 text-brand-burgundy'
                    : 'border-brand-medium-gray/20 bg-brand-white text-brand-dark-gray'
                }`}
              >
                <span className="font-medium">
                  {idx + 1}. {label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="dash-panel">
        <div className="dash-panel-body space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-brand-black">Review & edit</h2>
            <span className="text-xs text-brand-medium-gray">{items.length} images</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => {
              const preview = previewUrl(item);
              return (
                <article key={item.id} className="overflow-hidden rounded-xl border border-brand-medium-gray/20">
                  <div className="relative aspect-[3/4] bg-brand-light-gray/60">
                    {preview ? (
                      <Image src={preview} alt={item.display_name} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-brand-medium-gray">—</div>
                    )}
                  </div>
                  <div className="space-y-2 p-2.5">
                    <input
                      className="field-input py-1.5 text-xs"
                      defaultValue={item.display_name}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value && value !== item.display_name) void handleRename(item, value);
                      }}
                      disabled={busy}
                    />
                    {item.error && <p className="text-[10px] text-red-600">{item.error}</p>}
                    <button
                      type="button"
                      className="btn-outline w-full py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => void handleReprocess(item.id)}
                    >
                      Reprocess
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="dash-panel">
        <div className="dash-panel-body flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-brand-black">Finalize</h2>
            <p className="mt-1 text-xs text-brand-medium-gray">
              Publish to Outputs. Change backgrounds later from the Outputs page.
            </p>
          </div>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void handleFinalize()}>
            Save final outputs
          </button>
        </div>
      </section>

      {message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
