'use client';

import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';

import {
  previewRembg,
  REMBG_MODEL_OPTIONS,
  type RuntimeInfo,
  type SystemSettings,
  type WatermarkInfo,
} from '@/lib/api';

type RembgModelId = (typeof REMBG_MODEL_OPTIONS)[number]['id'];

const MODEL_HINTS: Record<RembgModelId, string> = {
  'birefnet-general': 'Best for chandeliers — thin arms, crystals, metal frames.',
  'bria-rmbg': 'Cleaner on simple shapes; may clip fine wires and small drops.',
  'isnet-general-use': 'Balanced all-rounder; less detail than BiRefNet on crystals.',
  u2net: 'Fast and light; struggles with dense crystal clusters.',
};

const CHECKERBOARD = {
  backgroundImage:
    'linear-gradient(45deg, #ececec 25%, transparent 25%), linear-gradient(-45deg, #ececec 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ececec 75%), linear-gradient(-45deg, transparent 75%, #ececec 75%)',
  backgroundSize: '12px 12px',
  backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
} as const;

function StatusDot({ ok, warn }: { ok?: boolean; warn?: boolean }) {
  const tone = ok ? 'bg-emerald-500' : warn ? 'bg-amber-500' : 'bg-brand-medium-gray/50';
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} />;
}

function StatusStrip({
  runtime,
  settings,
}: {
  runtime: RuntimeInfo;
  settings: SystemSettings;
}) {
  const items = [
    {
      label: runtime.storage.s3_enabled ? 'S3 connected' : 'S3 off',
      ok: runtime.storage.s3_enabled,
    },
    {
      label: !runtime.mongodb.enabled
        ? 'MongoDB off'
        : runtime.mongodb.ok
          ? 'MongoDB ok'
          : 'MongoDB unreachable',
      ok: runtime.mongodb.enabled && runtime.mongodb.ok,
      warn: runtime.mongodb.enabled && !runtime.mongodb.ok,
    },
    {
      label: runtime.rembg.loaded_model ?? settings.rembg_model,
      ok: Boolean(runtime.rembg.loaded_model),
    },
    {
      label: `${runtime.output_width}×${runtime.output_height}`,
      ok: true,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-brand-medium-gray/15 bg-brand-light-gray/30 px-4 py-3">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2 text-xs text-brand-dark-gray">
          <StatusDot ok={item.ok} warn={item.warn} />
          <span className="font-medium text-brand-black">{item.label}</span>
        </span>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? 'bg-brand-burgundy' : 'bg-brand-medium-gray/35'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function SettingRow({
  label,
  hint,
  valueLabel,
  children,
  nested,
}: {
  label: string;
  hint?: string;
  valueLabel?: string;
  children: ReactNode;
  nested?: boolean;
}) {
  return (
    <div
      className={`grid gap-3 border-b border-brand-medium-gray/10 py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 ${
        nested ? 'ml-3 border-l border-brand-medium-gray/15 pl-4 sm:ml-4' : ''
      }`}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-brand-black">{label}</p>
          {valueLabel ? (
            <span className="rounded-md bg-brand-light-gray/80 px-1.5 py-0.5 font-mono text-[10px] text-brand-dark-gray">
              {valueLabel}
            </span>
          ) : null}
        </div>
        {hint ? <p className="text-xs leading-relaxed text-brand-medium-gray">{hint}</p> : null}
      </div>
      <div className="w-full sm:w-auto sm:min-w-[11rem] sm:max-w-[14rem]">{children}</div>
    </div>
  );
}

function SliderControl({
  min,
  max,
  step = 1,
  value,
  disabled,
  onChange,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-brand-medium-gray/25 accent-brand-burgundy disabled:cursor-not-allowed disabled:opacity-40 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-burgundy"
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function InfoTile({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-brand-medium-gray/12 bg-brand-white px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-brand-medium-gray">{label}</p>
      <p className={`mt-0.5 text-xs font-medium text-brand-black ${mono ? 'truncate font-mono' : ''}`} title={value}>
        {value}
      </p>
    </div>
  );
}

function PreviewLightbox({
  src,
  model,
  onClose,
}: {
  src: string;
  model: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/70 p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Cutout preview enlarged"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[min(90vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-brand-medium-gray/20 bg-brand-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-brand-medium-gray/10 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-brand-black">Cutout preview</p>
            {model ? (
              <p className="mt-0.5 text-xs text-brand-medium-gray">
                Model: <span className="font-mono text-brand-black">{model}</span>
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="btn-outline shrink-0 px-3 py-1.5 text-xs"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div
          className="relative min-h-[50vh] flex-1"
          style={CHECKERBOARD}
        >
          <Image src={src} alt="Cutout preview enlarged" fill className="object-contain p-6" unoptimized />
        </div>
      </div>
    </div>
  );
}

function Accordion({
  title,
  description,
  open,
  onToggle,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-brand-medium-gray/15 bg-brand-white">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-brand-light-gray/25"
        onClick={onToggle}
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-medium text-brand-black">{title}</p>
          {description ? <p className="mt-0.5 text-xs text-brand-medium-gray">{description}</p> : null}
        </div>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-medium-gray/20 text-brand-medium-gray transition-transform duration-200 ${
            open ? 'rotate-180 bg-brand-burgundy/5' : ''
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-brand-medium-gray/10 px-4 py-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

type RuntimePanelProps = {
  runtime: RuntimeInfo;
  settings: SystemSettings;
  watermark: WatermarkInfo;
  saving?: boolean;
  onSave?: (patch: Partial<SystemSettings>) => Promise<void>;
};

export function RuntimePanel({ runtime, settings, watermark, saving = false, onSave }: RuntimePanelProps) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewModel, setPreviewModel] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [technicalOpen, setTechnicalOpen] = useState(false);

  const mattingDisabled = settings.rembg_preserve_detail;
  const canEdit = Boolean(onSave);
  const modelHint =
    MODEL_HINTS[settings.rembg_model as RembgModelId] ?? 'AI model that draws the subject mask.';

  async function handlePreview(file: File | null) {
    if (!file) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const res = await previewRembg(file);
      setPreviewSrc(`data:image/png;base64,${res.preview_base64}`);
      setPreviewModel(res.loaded_model);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  }

  function save(patch: Partial<SystemSettings>) {
    if (onSave) void onSave(patch);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-brand-black">Runtime</h2>
        <p className="mt-1 text-xs text-brand-medium-gray">Cutout engine, live status, and server infrastructure.</p>
      </div>

      <StatusStrip runtime={runtime} settings={settings} />

      <section className="overflow-hidden rounded-xl border border-brand-medium-gray/15 bg-brand-white">
        <div className="border-b border-brand-medium-gray/10 px-4 py-4 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-burgundy">Cutout</p>
          <h3 className="mt-1 text-sm font-semibold text-brand-black">Background removal</h3>
          <p className="mt-0.5 text-xs text-brand-medium-gray">Model and edge quality for chandelier product shots.</p>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_240px] lg:divide-x lg:divide-brand-medium-gray/10">
          <div className="px-4 sm:px-5">
            <SettingRow label="Model" hint={modelHint}>
              <select
                className="field-input py-2 text-xs"
                value={settings.rembg_model}
                disabled={saving || !canEdit}
                onChange={(e) => save({ rembg_model: e.target.value })}
              >
                {REMBG_MODEL_OPTIONS.map(({ rank, id }) => (
                  <option key={id} value={id}>
                    {rank}. {id}
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingRow
              label="Preserve detail"
              hint="Keeps thin arms, crystal tips, and chain links. Off = smoother mask, may eat fine parts."
            >
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-xs text-brand-medium-gray">
                  {settings.rembg_preserve_detail ? 'On' : 'Off'}
                </span>
                <Toggle
                  label="Preserve detail"
                  checked={settings.rembg_preserve_detail}
                  disabled={saving || !canEdit}
                  onChange={(value) => save({ rembg_preserve_detail: value })}
                />
              </div>
            </SettingRow>

            <SettingRow
              label="Mask dilate"
              hint="Grows the mask slightly. Low fixes gaps between crystals; high can swallow thin arms."
              valueLabel={`${settings.rembg_mask_dilate}px`}
            >
              <SliderControl
                min={0}
                max={5}
                value={settings.rembg_mask_dilate}
                disabled={saving || !canEdit || !settings.rembg_preserve_detail}
                onChange={(value) => save({ rembg_mask_dilate: value })}
              />
            </SettingRow>

            <SettingRow
              label="Alpha matting"
              hint={
                mattingDisabled
                  ? 'Unavailable while preserve detail is on — matting blurs fine crystal edges.'
                  : 'Soft edge fade. Good for solid bodies; worse for dangling crystals.'
              }
            >
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-xs text-brand-medium-gray">
                  {settings.rembg_alpha_matting ? 'On' : 'Off'}
                </span>
                <Toggle
                  label="Alpha matting"
                  checked={settings.rembg_alpha_matting}
                  disabled={saving || !canEdit || mattingDisabled}
                  onChange={(value) => save({ rembg_alpha_matting: value })}
                />
              </div>
            </SettingRow>

            {!mattingDisabled && settings.rembg_alpha_matting ? (
              <div className="border-b border-brand-medium-gray/10 pb-1">
                <SettingRow
                  nested
                  label="Foreground"
                  hint="Higher keeps more bright metal and crystal highlights."
                  valueLabel={String(settings.rembg_foreground_threshold)}
                >
                  <SliderControl
                    min={0}
                    max={255}
                    value={settings.rembg_foreground_threshold}
                    disabled={saving || !canEdit}
                    onChange={(value) => save({ rembg_foreground_threshold: value })}
                  />
                </SettingRow>
                <SettingRow
                  nested
                  label="Background"
                  hint="Lower removes more pale wall bleed behind the chandelier."
                  valueLabel={String(settings.rembg_background_threshold)}
                >
                  <SliderControl
                    min={0}
                    max={255}
                    value={settings.rembg_background_threshold}
                    disabled={saving || !canEdit}
                    onChange={(value) => save({ rembg_background_threshold: value })}
                  />
                </SettingRow>
                <SettingRow
                  nested
                  label="Erode"
                  hint="Shrinks soft fringe — less halo, but thin tips may disappear."
                  valueLabel={String(settings.rembg_erode_size)}
                >
                  <SliderControl
                    min={0}
                    max={20}
                    value={settings.rembg_erode_size}
                    disabled={saving || !canEdit}
                    onChange={(value) => save({ rembg_erode_size: value })}
                  />
                </SettingRow>
              </div>
            ) : null}

            <SettingRow
              label="Infer size"
              hint="Upscale before AI runs. Higher = sharper small crystals, slower per image."
              valueLabel={`${settings.rembg_min_dimension}px`}
            >
              <SliderControl
                min={800}
                max={4096}
                step={100}
                value={settings.rembg_min_dimension}
                disabled={saving || !canEdit}
                onChange={(value) => save({ rembg_min_dimension: value })}
              />
            </SettingRow>

            <div className="grid grid-cols-2 gap-2 py-4 sm:grid-cols-3">
              <InfoTile
                label="Loaded model"
                value={runtime.rembg.loaded_model ?? 'On first image'}
                mono
              />
              <InfoTile label="Max infer" value={`${runtime.rembg.max_dimension}px`} mono />
              <InfoTile
                label="ONNX"
                value={runtime.rembg.onnx_providers[0] ?? '—'}
                mono
              />
            </div>
          </div>

          <aside className="flex flex-col bg-brand-light-gray/20 p-4 lg:p-5">
            <p className="text-xs font-medium text-brand-black">Test preview</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-brand-medium-gray">
              Upload a chandelier sample to validate current settings.
            </p>

            {previewSrc ? (
              <button
                type="button"
                className="group relative mt-4 aspect-square w-full overflow-hidden rounded-xl border border-brand-medium-gray/15 transition hover:border-brand-burgundy/35 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-burgundy/30"
                style={CHECKERBOARD}
                onClick={() => setPreviewOpen(true)}
                aria-label="Open cutout preview full size"
              >
                <Image src={previewSrc} alt="Cutout preview" fill className="object-contain p-2" unoptimized />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-black/50 to-transparent px-2 py-2 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                  Click to enlarge
                </span>
              </button>
            ) : (
              <div
                className="relative mt-4 aspect-square w-full overflow-hidden rounded-xl border border-brand-medium-gray/15"
                style={CHECKERBOARD}
              >
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                  <span className="text-2xl text-brand-medium-gray/40">◇</span>
                  <p className="text-[10px] text-brand-medium-gray">No preview yet</p>
                </div>
              </div>
            )}

            <label className="btn-outline mt-4 w-full cursor-pointer justify-center py-2 text-xs">
              {previewing ? 'Processing…' : 'Upload test image'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={previewing || saving}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = '';
                  void handlePreview(file);
                }}
              />
            </label>

            {previewError ? <p className="mt-2 text-[10px] text-red-600">{previewError}</p> : null}
            {previewModel ? (
              <p className="mt-2 text-[10px] text-brand-medium-gray">
                Model used: <span className="font-mono text-brand-black">{previewModel}</span>
              </p>
            ) : null}
          </aside>
        </div>
      </section>

      <Accordion
        title="System & infrastructure"
        description="Server environment, storage, integrations, and package versions"
        open={technicalOpen}
        onToggle={() => setTechnicalOpen((v) => !v)}
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-brand-medium-gray">Environment</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <InfoTile label="Hostname" value={runtime.deploy.hostname} />
              <InfoTile
                label="Runtime"
                value={runtime.deploy.in_container ? 'Container' : 'Local machine'}
              />
              <InfoTile label="Python" value={runtime.deploy.python_version} mono />
              <InfoTile label="Canvas" value={`${runtime.output_width}×${runtime.output_height}`} mono />
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-brand-medium-gray">Storage</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <InfoTile
                label="Amazon S3"
                value={runtime.storage.s3_enabled ? runtime.storage.s3_bucket ?? 'On' : 'Off'}
              />
              <InfoTile label="Region" value={runtime.storage.s3_region} mono />
              <InfoTile label="CDN" value={runtime.storage.s3_public_base_url ?? '—'} mono />
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-brand-medium-gray">Integrations</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <InfoTile
                label="MongoDB"
                value={
                  runtime.mongodb.enabled
                    ? `${runtime.mongodb.ok ? 'Connected' : 'Unreachable'} · ${runtime.mongodb.db}`
                    : 'Not configured'
                }
              />
              <InfoTile
                label="Google Drive"
                value={runtime.google_drive_configured ? 'Configured' : 'Not configured'}
              />
              <InfoTile
                label="Watermark"
                value={watermark.configured ? watermark.name : 'Not configured'}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-brand-medium-gray">Libraries</p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['rembg', runtime.libraries.rembg],
                  ['pillow', runtime.libraries.pillow],
                  ['onnxruntime', runtime.libraries.onnxruntime],
                  ['numpy', runtime.libraries.numpy],
                  ['pymongo', runtime.libraries.pymongo],
                  ['fastapi', runtime.libraries.fastapi],
                  ['boto3', runtime.libraries.boto3],
                ] as const
              ).map(([name, version]) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-medium-gray/15 bg-brand-light-gray/40 px-2.5 py-1 text-[10px]"
                >
                  <span className="font-medium text-brand-dark-gray">{name}</span>
                  <span className="font-mono text-brand-black">{version ?? '—'}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Accordion>

      {previewOpen && previewSrc ? (
        <PreviewLightbox
          src={previewSrc}
          model={previewModel}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}
