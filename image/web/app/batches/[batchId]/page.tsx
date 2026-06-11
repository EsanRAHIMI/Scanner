'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BatchProcessingState } from '@/components/batch-processing-state';
import { ItemProcessingInfo } from '@/components/item-processing-info';
import { PageHeader } from '@/components/page-header';
import { WorkflowSteps } from '@/components/workflow-steps';
import {
  finalizeBatch,
  getBatch,
  renameItem,
  reprocessItem,
  resumeBatchProcessing,
  resolveMediaUrl,
  type Batch,
  type BatchItem,
} from '@/lib/api';

const STEPS = ['Processing', 'Review', 'Finalize'] as const;

function previewUrl(item: BatchItem): string | null {
  return resolveMediaUrl(item.final_url || item.processed_url || item.original_url);
}

function isProcessingBatch(status: Batch['status'] | undefined) {
  return status === 'processing' || status === 'draft';
}

export default function BatchWorkflowPage() {
  const params = useParams<{ batchId: string }>();
  const batchId = params.batchId;
  const router = useRouter();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showReady, setShowReady] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);
  const [processingSince, setProcessingSince] = useState<number | null>(null);
  const prevActiveStep = useRef(0);
  const reviewRef = useRef<HTMLElement | null>(null);
  const finalizeRef = useRef<HTMLElement | null>(null);

  const refresh = useCallback(async () => {
    const batchRes = await getBatch(batchId);
    setBatch(batchRes.batch);
    setItems(batchRes.items);
    setPollError(null);
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

  const processing = isProcessingBatch(batch?.status);
  const doneCount = items.filter((item) =>
    ['processed', 'reviewed', 'background_applied', 'finalized'].includes(item.status),
  ).length;
  const failedBatch = batch?.status === 'failed';
  const failedItems = items.filter((item) => item.status === 'failed');
  const stuckProcessing =
    processing &&
    doneCount === 0 &&
    processingSince !== null &&
    Date.now() - processingSince > 3 * 60 * 1000;

  useEffect(() => {
    if (processing && processingSince === null) {
      setProcessingSince(Date.now());
    }
    if (!processing) {
      setProcessingSince(null);
    }
  }, [processing, processingSince]);

  useEffect(() => {
    if (batch?.status === 'finalized') {
      router.replace('/outputs');
    }
  }, [batch?.status, router]);

  useEffect(() => {
    if (!batch || batch.status === 'finalized' || batch.status === 'failed') return;
    const intervalMs = processing ? 2000 : 3000;
    const timer = setInterval(() => {
      void refresh().catch((err) => {
        const message = err instanceof Error ? err.message : 'Connection error';
        if (message.includes('502') || message.includes('503') || message.includes('504')) {
          setPollError('Server busy or restarting — still processing in background. Retrying…');
        } else {
          setPollError(message);
        }
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [batch, processing, refresh]);

  const activeStep = useMemo(() => {
    if (!batch) return 0;
    if (finalizing) return 2;
    if (isProcessingBatch(batch.status)) return 0;
    if (batch.status === 'review' || batch.status === 'background') return 1;
    return 2;
  }, [batch, finalizing]);

  const loadingStep = processing ? 0 : finalizing ? 2 : null;

  useEffect(() => {
    if (prevActiveStep.current === 0 && activeStep === 1) {
      setShowReady(true);
      const timer = window.setTimeout(() => setShowReady(false), 1400);
      prevActiveStep.current = activeStep;
      return () => window.clearTimeout(timer);
    }
    prevActiveStep.current = activeStep;
    return undefined;
  }, [activeStep]);

  const showReview = !processing && !showReady && !finalizing;

  useEffect(() => {
    if (!showReview || !reviewRef.current) return;
    const timer = window.setTimeout(() => {
      reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [showReview]);

  async function handleResumeProcessing() {
    setResuming(true);
    setError(null);
    setPollError(null);
    try {
      await resumeBatchProcessing(batchId);
      setProcessingSince(Date.now());
      await refresh();
      setMessage('Processing resumed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume processing');
    } finally {
      setResuming(false);
    }
  }

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
    setFinalizing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await finalizeBatch(batchId);
      setBatch(res.batch);
      router.push('/outputs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Finalize failed');
      setFinalizing(false);
    } finally {
      setBusy(false);
    }
  }

  function scrollToFinalize() {
    finalizeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Batch workflow" title="Loading batch…" />
        <section className="dash-panel">
          <div className="dash-panel-body flex min-h-[280px] items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="relative flex h-12 w-12 items-center justify-center">
                <span className="absolute inset-0 rounded-full border border-brand-burgundy/15" />
                <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-burgundy processing-ring" />
              </span>
              <p className="text-sm text-brand-medium-gray">Opening workflow…</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!batch) return <p className="text-sm text-red-700">Batch not found.</p>;

  const showProcessingPanel = processing || showReady || finalizing;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Batch workflow"
        title={batch.name}
        description={
          processing
            ? 'Processing runs automatically. Review and Finalize unlock when this step finishes.'
            : finalizing
              ? 'Publishing your images to Final outputs…'
              : activeStep === 1
                ? 'Review your images below, then save them from the Finalize section.'
                : `Source: ${batch.source} · 1080 × 1440 · default background applied`
        }
        actions={
          <Link href="/" className="btn-outline h-9 px-3 text-xs">
            ← Import
          </Link>
        }
      />

      <section className="dash-panel">
        <div className="dash-panel-body space-y-3">
          <WorkflowSteps steps={STEPS} activeStep={activeStep} loadingStep={loadingStep} />
          {processing ? (
            <p className="rounded-xl bg-brand-burgundy/5 px-3 py-2 text-xs text-brand-dark-gray">
              <span className="font-medium text-brand-burgundy">Automatic workflow:</span> you do not need to click
              Review or Finalize yet. This page will move to review on its own. First image can take several minutes on
              the server (AI model load).
            </p>
          ) : null}
          {pollError ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{pollError}</p>
          ) : null}
          {failedBatch ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200/80 bg-red-50 px-3 py-2.5">
              <div className="text-xs text-red-900">
                <p className="font-semibold">Processing failed</p>
                <p className="mt-0.5">
                  {failedItems[0]?.error ?? 'The server restarted during cutout. Resume to try again.'}
                </p>
              </div>
              <button
                type="button"
                className="btn-primary h-8 px-3 text-xs"
                disabled={resuming}
                onClick={() => void handleResumeProcessing()}
              >
                {resuming ? 'Starting…' : 'Resume processing'}
              </button>
            </div>
          ) : null}
          {stuckProcessing && !failedBatch ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5">
              <p className="text-xs text-amber-900">
                Processing is taking longer than expected. The server may have restarted — try resuming.
              </p>
              <button
                type="button"
                className="btn-outline h-8 px-3 text-xs"
                disabled={resuming}
                onClick={() => void handleResumeProcessing()}
              >
                {resuming ? 'Resuming…' : 'Resume processing'}
              </button>
            </div>
          ) : null}
          {showReview ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2.5">
              <p className="text-xs text-emerald-900">
                <span className="font-semibold">Step 2 is open.</span> Check previews and names, then continue to
                Finalize.
              </p>
              <button type="button" className="btn-primary h-8 px-3 text-xs" onClick={scrollToFinalize}>
                Go to Finalize ↓
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {showProcessingPanel ? (
        finalizing ? (
          <section className="dash-panel">
            <div className="dash-panel-body flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
              <span className="relative flex h-14 w-14 items-center justify-center">
                <span className="absolute inset-0 rounded-full border border-brand-burgundy/15" />
                <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-burgundy processing-ring" />
              </span>
              <div>
                <p className="text-sm font-semibold text-brand-black">Saving final outputs</p>
                <p className="mt-1 text-xs text-brand-medium-gray">You will be redirected to Final outputs automatically.</p>
              </div>
            </div>
          </section>
        ) : (
          <BatchProcessingState items={items} showReady={showReady} />
        )
      ) : null}

      {showReview ? (
        <section ref={reviewRef} className="dash-panel processing-review-enter scroll-mt-6">
          <div className="dash-panel-body space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-brand-black">Review & edit</h2>
                <p className="mt-1 text-xs text-brand-medium-gray">
                  Rename files if needed. When you are happy, continue to Finalize below.
                </p>
              </div>
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
                    <ItemProcessingInfo item={item} />
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
      ) : null}

      {showReview ? (
        <section ref={finalizeRef} className="dash-panel processing-review-enter scroll-mt-6 ring-1 ring-brand-burgundy/15">
          <div className="dash-panel-body space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-burgundy">Step 3</p>
                <h2 className="mt-1 text-sm font-semibold text-brand-black">Finalize & publish</h2>
                <p className="mt-1 text-xs text-brand-medium-gray">
                  Click the button to publish this batch to <span className="font-medium">Final outputs</span>. You will
                  be redirected there automatically.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary min-w-[12rem] px-5"
                disabled={busy}
                onClick={() => void handleFinalize()}
              >
                Save final outputs
              </button>
            </div>
            <p className="text-[11px] text-brand-medium-gray">
              Need to change backgrounds later? Open <Link href="/outputs" className="font-medium text-brand-burgundy hover:underline">Final outputs</Link> after publishing.
            </p>
          </div>
        </section>
      ) : null}

      {message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
