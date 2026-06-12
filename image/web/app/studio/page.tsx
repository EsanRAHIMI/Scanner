'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ProcessingScreen } from '@/components/processing-screen';
import { PageHeader } from '@/components/page-header';
import {
  finalizeBatch,
  getBatch,
  importImages,
  listPresets,
  resolveMediaUrl,
  retryItem,
  type BatchItem,
  type OutputRow,
  type Preset,
} from '@/lib/api';

const CHECKERBOARD = {
  backgroundImage:
    'linear-gradient(45deg, #ececec 25%, transparent 25%), linear-gradient(-45deg, #ececec 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ececec 75%), linear-gradient(-45deg, transparent 75%, #ececec 75%)',
  backgroundSize: '14px 14px',
  backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0',
} as const;

const PRESET_DESC: Record<string, string> = {
  fast_preview: 'Quickest look. Light model, minimal outputs — ideal on a MacBook.',
  website_product: 'Clean product on background + web image. Balanced quality.',
  premium_cutout: 'Best edges: matting + halo removal. Transparent masters.',
  social_media: 'Branded + web formats sized for social feeds.',
  transparent_master: 'High-detail transparent PNG/WebP masters.',
  full_brand_package: 'Everything: premium cutout + all renditions + branded.',
};

const STEPS = ['Upload', 'Style', 'Process', 'Review', 'Finalize'] as const;

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {STEPS.map((label, i) => {
        const state = i < step ? 'done' : i === step ? 'active' : 'todo';
        return (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                state === 'done'
                  ? 'bg-emerald-500 text-white'
                  : state === 'active'
                    ? 'bg-brand-burgundy text-white'
                    : 'bg-brand-light-gray/70 text-brand-medium-gray'
              }`}
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span className={state === 'active' ? 'font-medium text-brand-black' : 'text-brand-medium-gray'}>{label}</span>
            {i < STEPS.length - 1 ? <span className="text-brand-medium-gray/40">›</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function Tile({ label, src, transparent, onZoom }: { label: string; src: string | null; transparent?: boolean; onZoom: (s: string) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-brand-medium-gray/15 bg-brand-white">
      <div className="border-b border-brand-medium-gray/10 px-3 py-1.5 text-[11px] font-medium text-brand-black">{label}</div>
      <button
        type="button"
        className="relative block aspect-square w-full bg-brand-light-gray/40"
        style={transparent ? CHECKERBOARD : undefined}
        onClick={() => src && onZoom(src)}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label} className="h-full w-full object-contain p-2" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-brand-medium-gray">—</div>
        )}
      </button>
    </div>
  );
}

export default function StudioPage() {
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetId, setPresetId] = useState<string>('website_product');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [outputs, setOutputs] = useState<OutputRow[]>([]);
  const [view, setView] = useState<'cutout' | 'branded'>('branded');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    listPresets()
      .then((r) => setPresets(r.presets))
      .catch(() => setPresets([]));
  }, []);

  const previews = useMemo(() => files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  async function startProcessing() {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await importImages(files, { preset: presetId, autoProcess: true });
      setBatchId(res.batch_id);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function loadReview() {
    if (!batchId) return;
    try {
      const res = await getBatch(batchId);
      setItems(res.items);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results');
    }
  }

  async function handleFinalize() {
    if (!batchId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await finalizeBatch(batchId);
      setOutputs(res.outputs);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Finalize failed');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep(0);
    setFiles([]);
    setBatchId(null);
    setItems([]);
    setOutputs([]);
    setError(null);
  }

  const activePreset = presets.find((p) => p.id === presetId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Image Studio"
        description="Prepare product images step by step — upload, choose a style, process, review, finalize."
        actions={<Link href="/settings" className="btn-outline px-3 py-1.5 text-xs">Advanced settings</Link>}
      />

      <section className="dash-panel">
        <div className="dash-panel-body"><Stepper step={step} /></div>
      </section>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {/* Step 1 — Upload */}
      {step === 0 ? (
        <section className="dash-panel">
          <div className="dash-panel-body space-y-4">
            <h2 className="text-sm font-semibold text-brand-black">1 · Upload images</h2>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-medium-gray/30 bg-brand-light-gray/20 px-6 py-10 text-center transition hover:border-brand-burgundy/40">
              <span className="text-2xl text-brand-medium-gray/50">⬆</span>
              <span className="text-sm font-medium text-brand-black">Click to choose chandelier photos</span>
              <span className="text-xs text-brand-medium-gray">JPG / PNG · multiple allowed</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </label>

            {previews.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
                {previews.map((p) => (
                  <div key={p.url} className="overflow-hidden rounded-lg border border-brand-medium-gray/15">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.name} className="aspect-square w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex justify-end">
              <button type="button" className="btn-primary px-4 py-2 text-sm" disabled={files.length === 0} onClick={() => setStep(1)}>
                Continue ({files.length})
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* Step 2 — Style / preset */}
      {step === 1 ? (
        <section className="dash-panel">
          <div className="dash-panel-body space-y-4">
            <h2 className="text-sm font-semibold text-brand-black">2 · Choose output style</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {presets.map((p) => {
                const selected = p.id === presetId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPresetId(p.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      selected ? 'border-brand-burgundy ring-1 ring-brand-burgundy/25 bg-brand-burgundy/5' : 'border-brand-medium-gray/20 hover:border-brand-burgundy/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-brand-black">{p.label}</p>
                      <span className="rounded-full bg-brand-light-gray/80 px-2 py-0.5 text-[10px] font-medium text-brand-dark-gray">{p.quality}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-brand-medium-gray">{PRESET_DESC[p.id] ?? ''}</p>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between">
              <button type="button" className="btn-outline px-4 py-2 text-sm" onClick={() => setStep(0)}>Back</button>
              <button type="button" className="btn-primary px-4 py-2 text-sm" disabled={busy || !activePreset} onClick={() => void startProcessing()}>
                {busy ? 'Uploading…' : 'Process images'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* Step 3 — Process */}
      {step === 2 && batchId ? (
        <section className="dash-panel">
          <div className="dash-panel-body space-y-4">
            <h2 className="text-sm font-semibold text-brand-black">3 · Processing</h2>
            <ProcessingScreen batchId={batchId} onAllComplete={() => void loadReview()} />
            <div className="flex justify-end">
              <button type="button" className="btn-outline px-4 py-2 text-sm" onClick={() => void loadReview()}>
                Go to review
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* Step 4 — Review */}
      {step === 3 ? (
        <section className="dash-panel">
          <div className="dash-panel-body space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-brand-black">4 · Review</h2>
              <div className="inline-flex overflow-hidden rounded-full border border-brand-medium-gray/25 text-[11px]">
                {(['cutout', 'branded'] as const).map((v) => (
                  <button key={v} type="button" className={`px-3 py-1 ${view === v ? 'bg-brand-burgundy text-white' : 'text-brand-medium-gray'}`} onClick={() => setView(v)}>
                    {v === 'cutout' ? 'Cutout' : 'Branded'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {items.map((it) => {
                const original = resolveMediaUrl(it.original_url);
                const cutout = resolveMediaUrl(it.processed_url);
                const branded = resolveMediaUrl(it.final_url);
                const failed = it.status === 'failed';
                return (
                  <div key={it.id} className="rounded-xl border border-brand-medium-gray/15 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-brand-black">{it.display_name}</p>
                      {failed ? (
                        <button type="button" className="btn-outline px-2.5 py-1 text-[10px]" onClick={() => void retryItem(it.id)}>Retry</button>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">ready</span>
                      )}
                    </div>
                    {failed ? (
                      <p className="text-xs text-red-600">{it.error ?? 'Processing failed'}</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <Tile label="Original" src={original} onZoom={setZoom} />
                        <Tile label="Cutout" src={cutout} transparent onZoom={setZoom} />
                        <Tile label="Branded" src={branded} onZoom={setZoom} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between">
              <button type="button" className="btn-outline px-4 py-2 text-sm" onClick={() => void loadReview()}>Refresh</button>
              <button type="button" className="btn-primary px-4 py-2 text-sm" disabled={busy} onClick={() => void handleFinalize()}>
                {busy ? 'Finalizing…' : 'Approve & finalize'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* Step 5 — Finalize / download */}
      {step === 4 ? (
        <section className="dash-panel">
          <div className="dash-panel-body space-y-4">
            <h2 className="text-sm font-semibold text-brand-black">5 · Done — download &amp; publish</h2>
            <p className="text-xs text-brand-medium-gray">{outputs.length} image{outputs.length === 1 ? '' : 's'} finalized.</p>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {outputs.map((o) => {
                const preview = resolveMediaUrl(o.final_url);
                return (
                  <article key={o.id} className="overflow-hidden rounded-xl border border-brand-medium-gray/15 bg-brand-white">
                    <a href={preview ?? o.final_url} target="_blank" rel="noreferrer" className="relative block aspect-[3/4] bg-brand-light-gray/50">
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt={o.file_name} className="h-full w-full object-cover" />
                      ) : null}
                    </a>
                    <div className="space-y-1 p-2.5">
                      <p className="truncate text-[11px] font-medium" title={o.file_name}>{o.file_name}</p>
                      {o.rendition_urls && Object.keys(o.rendition_urls).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(o.rendition_urls).map(([name, url]) => (
                            <a key={name} href={resolveMediaUrl(url) ?? url} target="_blank" rel="noreferrer" className="rounded-full border border-brand-medium-gray/25 px-1.5 py-0.5 text-[9px] text-brand-dark-gray hover:border-brand-burgundy/40 hover:text-brand-burgundy">
                              {name.replace('_', ' ')}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="flex justify-between">
              <Link href="/outputs" className="btn-outline px-4 py-2 text-sm">View all outputs</Link>
              <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={reset}>Start new batch</button>
            </div>
          </div>
        </section>
      ) : null}

      {zoom ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setZoom(null)}>
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-brand-white" style={CHECKERBOARD} onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom} alt="Enlarged" className="mx-auto max-h-[88vh] w-auto object-contain p-4" />
            <button type="button" className="btn-outline absolute right-3 top-3 bg-brand-white px-3 py-1.5 text-xs" onClick={() => setZoom(null)}>Close</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
