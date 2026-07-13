'use client';

import { useEffect, useState } from 'react';

import { COMPARE_MODES, cutoutCompare, type CutoutPreviewResult } from '@/lib/api';

const CHECKERBOARD = {
  backgroundImage:
    'linear-gradient(45deg, #ececec 25%, transparent 25%), linear-gradient(-45deg, #ececec 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ececec 75%), linear-gradient(-45deg, transparent 75%, #ececec 75%)',
  backgroundSize: '14px 14px',
  backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0',
} as const;

const MODE_LABEL: Record<string, string> = {
  fast: 'Fast',
  balanced: 'Balanced',
  premium: 'Premium',
  hybrid: 'Hybrid',
  managed: 'Managed API',
};

function confidenceTone(c: number): string {
  if (c >= 0.75) return 'text-emerald-700 bg-emerald-50';
  if (c >= 0.5) return 'text-amber-700 bg-amber-50';
  return 'text-red-700 bg-red-50';
}

function ResultCard({
  result,
  view,
  onEnlarge,
}: {
  result: CutoutPreviewResult;
  view: 'cutout' | 'branded';
  onEnlarge: (src: string) => void;
}) {
  const label = MODE_LABEL[result.mode ?? result.quality] ?? result.quality;
  if (result.error) {
    return (
      <div className="overflow-hidden rounded-xl border border-red-200 bg-red-50">
        <div className="border-b border-red-200 px-3 py-2 text-xs font-semibold text-red-700">{label}</div>
        <div className="p-3 text-[11px] text-red-700">{result.error}</div>
      </div>
    );
  }

  const src =
    view === 'branded' && result.branded_base64
      ? `data:image/jpeg;base64,${result.branded_base64}`
      : `data:image/png;base64,${result.cutout_base64}`;
  const transparent = view === 'cutout' || !result.branded_base64;

  return (
    <div className="overflow-hidden rounded-xl border border-brand-medium-gray/15 bg-brand-white">
      <div className="flex items-center justify-between gap-2 border-b border-brand-medium-gray/10 px-3 py-2">
        <span className="text-xs font-semibold text-brand-black">{label}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${confidenceTone(result.confidence)}`}>
          {Math.round(result.confidence * 100)}%
        </span>
      </div>
      <button
        type="button"
        className="relative block aspect-square w-full"
        style={transparent ? CHECKERBOARD : undefined}
        onClick={() => onEnlarge(src)}
        aria-label={`Enlarge ${label}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="h-full w-full object-contain p-2" />
        {result.escalated ? (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-brand-burgundy px-1.5 py-0.5 text-[9px] font-medium text-white">
            escalated
          </span>
        ) : null}
      </button>
      <div className="space-y-0.5 px-3 py-2 text-[10px] text-brand-medium-gray">
        <p className="truncate" title={result.provider}>
          {result.provider}
          {result.model ? ` · ${result.model}` : ''}
        </p>
        <p>{result.elapsed_ms} ms</p>
      </div>
    </div>
  );
}

export function CutoutCompare() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [modes, setModes] = useState<string[]>(['balanced', 'premium']);
  const [branded, setBranded] = useState(true);
  const [view, setView] = useState<'cutout' | 'branded'>('cutout');
  const [results, setResults] = useState<CutoutPreviewResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    };
  }, [originalUrl]);

  function pickFile(f: File | null) {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    setResults(null);
    setError(null);
    setFile(f);
    setOriginalUrl(f ? URL.createObjectURL(f) : null);
  }

  function toggleMode(mode: string) {
    setModes((prev) => (prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]));
  }

  async function run() {
    if (!file || modes.length === 0) return;
    setRunning(true);
    setError(null);
    try {
      const res = await cutoutCompare(file, modes, branded);
      setResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="dash-panel">
      <div className="dash-panel-body space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-burgundy">Compare</p>
          <h2 className="mt-1 text-sm font-semibold text-brand-black">Test & compare modes</h2>
          <p className="mt-0.5 text-xs text-brand-medium-gray">
            Upload one chandelier and compare edge quality, halos, and preserved detail across modes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="btn-outline cursor-pointer px-3 py-1.5 text-xs">
            {file ? 'Change image' : 'Upload image'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = '';
                pickFile(f);
              }}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {COMPARE_MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggleMode(m)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  modes.includes(m)
                    ? 'border-brand-burgundy bg-brand-burgundy/10 text-brand-burgundy'
                    : 'border-brand-medium-gray/25 text-brand-medium-gray hover:border-brand-burgundy/40'
                }`}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-brand-dark-gray">
            <input type="checkbox" className="h-4 w-4 accent-brand-burgundy" checked={branded} onChange={(e) => setBranded(e.target.checked)} />
            Branded output
          </label>

          <button
            type="button"
            className="btn-primary px-4 py-1.5 text-xs"
            disabled={!file || modes.length === 0 || running}
            onClick={() => void run()}
          >
            {running ? 'Processing…' : 'Compare'}
          </button>

          {results && branded ? (
            <div className="ml-auto inline-flex overflow-hidden rounded-full border border-brand-medium-gray/25 text-[11px]">
              {(['cutout', 'branded'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`px-3 py-1 ${view === v ? 'bg-brand-burgundy text-white' : 'text-brand-medium-gray'}`}
                  onClick={() => setView(v)}
                >
                  {v === 'cutout' ? 'Cutout' : 'Branded'}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

        {(originalUrl || results) && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {originalUrl ? (
              <div className="overflow-hidden rounded-xl border border-brand-medium-gray/15 bg-brand-white">
                <div className="border-b border-brand-medium-gray/10 px-3 py-2 text-xs font-semibold text-brand-black">Original</div>
                <button type="button" className="relative block aspect-square w-full bg-brand-light-gray/40" onClick={() => setLightbox(originalUrl)} aria-label="Enlarge original">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={originalUrl} alt="Original" className="h-full w-full object-contain p-2" />
                </button>
                <div className="px-3 py-2 text-[10px] text-brand-medium-gray">Input image</div>
              </div>
            ) : null}

            {results?.map((r, i) => (
              <ResultCard key={`${r.mode ?? r.quality}-${i}`} result={r} view={view} onEnlarge={setLightbox} />
            ))}
          </div>
        )}
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-brand-white" style={CHECKERBOARD} onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="Enlarged" className="mx-auto max-h-[88vh] w-auto object-contain p-4" />
            <button type="button" className="btn-outline absolute right-3 top-3 bg-brand-white px-3 py-1.5 text-xs" onClick={() => setLightbox(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
