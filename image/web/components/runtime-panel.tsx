'use client';

import type { ReactNode } from 'react';

import type { RuntimeInfo, SystemSettings, WatermarkInfo } from '@/lib/api';

type StatusTone = 'ok' | 'warn' | 'off' | 'neutral';

const STATUS_STYLES: Record<StatusTone, string> = {
  ok: 'border-emerald-200/80 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-200/80 bg-amber-50 text-amber-900',
  off: 'border-brand-medium-gray/25 bg-brand-light-gray/50 text-brand-dark-gray',
  neutral: 'border-brand-burgundy/15 bg-brand-burgundy/5 text-brand-burgundy',
};

function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLES[tone]}`}>
      {label}
    </span>
  );
}

function RuntimeCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-brand-medium-gray/20 bg-brand-white">
      <div className="border-b border-brand-medium-gray/15 bg-brand-light-gray/35 px-4 py-3">
        <h3 className="text-xs font-semibold text-brand-black">{title}</h3>
        {description ? <p className="mt-0.5 text-[11px] text-brand-medium-gray">{description}</p> : null}
      </div>
      <dl className="divide-y divide-brand-medium-gray/10 px-4 py-1">{children}</dl>
    </section>
  );
}

function RuntimeKV({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,42%)_1fr] items-start gap-3 py-2.5 text-xs sm:grid-cols-[minmax(0,38%)_1fr]">
      <dt className="text-brand-medium-gray">{label}</dt>
      <dd className={`text-right font-medium text-brand-black ${mono ? 'break-all font-mono text-[11px]' : 'break-words'}`}>
        {value}
      </dd>
    </div>
  );
}

function LibChip({ name, version }: { name: string; version: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-medium-gray/20 bg-brand-light-gray/40 px-2.5 py-1.5 text-[11px]">
      <span className="font-medium text-brand-dark-gray">{name}</span>
      <span className="font-mono text-brand-black">{version ?? '—'}</span>
    </span>
  );
}

type RuntimePanelProps = {
  runtime: RuntimeInfo;
  settings: SystemSettings;
  watermark: WatermarkInfo;
};

export function RuntimePanel({ runtime, settings, watermark }: RuntimePanelProps) {
  const mongoLabel = !runtime.mongodb.enabled
    ? 'MongoDB off'
    : runtime.mongodb.ok
      ? `MongoDB · ${runtime.mongodb.db}`
      : 'MongoDB unreachable';

  const mongoTone: StatusTone = !runtime.mongodb.enabled ? 'off' : runtime.mongodb.ok ? 'ok' : 'warn';
  const s3Tone: StatusTone = runtime.storage.s3_enabled ? 'ok' : 'off';
  const rembgTone: StatusTone = runtime.rembg.loaded_model ? 'ok' : 'neutral';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <StatusBadge
          label={runtime.storage.s3_enabled ? `S3 · ${runtime.storage.s3_bucket}` : 'S3 off'}
          tone={s3Tone}
        />
        <StatusBadge label={mongoLabel} tone={mongoTone} />
        <StatusBadge
          label={runtime.rembg.loaded_model ?? runtime.rembg.configured_model}
          tone={rembgTone}
        />
        <StatusBadge
          label={runtime.deploy.in_container ? 'Docker' : 'Local host'}
          tone="neutral"
        />
        <StatusBadge
          label={`${runtime.output_width}×${runtime.output_height}`}
          tone="neutral"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RuntimeCard title="Environment" description="Server process and Python runtime">
          <RuntimeKV label="Hostname" value={runtime.deploy.hostname} />
          <RuntimeKV label="Runtime" value={runtime.deploy.in_container ? 'Container' : 'Local machine'} />
          <RuntimeKV label="Python" value={runtime.deploy.python_version} mono />
          <RuntimeKV label="Platform" value={runtime.deploy.platform} mono />
        </RuntimeCard>

        <RuntimeCard title="Background removal" description="From IMAGE_REMBG_* in .env">
          <RuntimeKV label="Configured model" value={runtime.rembg.configured_model} mono />
          <RuntimeKV
            label="Loaded model"
            value={runtime.rembg.loaded_model ?? 'Loads on first image'}
            mono={Boolean(runtime.rembg.loaded_model)}
          />
          <RuntimeKV label="Alpha matting" value={runtime.rembg.alpha_matting ? 'On' : 'Off'} />
          <RuntimeKV
            label="Thresholds"
            value={`FG ${runtime.rembg.foreground_threshold} · BG ${runtime.rembg.background_threshold} · erode ${runtime.rembg.erode_size}`}
            mono
          />
          <RuntimeKV
            label="Infer size"
            value={`${runtime.rembg.min_dimension}px – ${runtime.rembg.max_dimension}px`}
            mono
          />
          <RuntimeKV
            label="ONNX"
            value={runtime.rembg.onnx_providers.length ? runtime.rembg.onnx_providers.join(' · ') : '—'}
            mono
          />
        </RuntimeCard>

        <RuntimeCard title="Processing" description="Output canvas and MongoDB defaults">
          <RuntimeKV label="Canvas" value={`${runtime.output_width} × ${runtime.output_height}`} />
          <RuntimeKV label="Auto-process" value={settings.auto_process_on_import ? 'On' : 'Off'} />
          <RuntimeKV label="Subject fill" value={`${Math.round(settings.subject_fill_ratio * 100)}%`} />
          <RuntimeKV label="Default background" value={settings.default_background_id} mono />
        </RuntimeCard>

        <RuntimeCard title="Watermark" description="Applied on finalized product images">
          <RuntimeKV label="Status" value={settings.watermark_enabled ? 'Enabled' : 'Disabled'} />
          <RuntimeKV label="Asset" value={watermark.configured ? watermark.name : 'Not configured'} />
          <RuntimeKV label="Size" value={`${Math.round(settings.watermark_scale * 100)}% width`} />
          <RuntimeKV label="Opacity" value={`${Math.round(settings.watermark_opacity * 100)}%`} />
          <RuntimeKV label="Bottom margin" value={`${settings.watermark_bottom_margin_px}px`} />
        </RuntimeCard>

        <RuntimeCard title="Storage" description="S3 prefixes and local cache">
          <RuntimeKV
            label="Amazon S3"
            value={runtime.storage.s3_enabled ? `On · ${runtime.storage.s3_bucket}` : 'Off'}
          />
          <RuntimeKV label="Region" value={runtime.storage.s3_region} mono />
          <RuntimeKV label="CDN base" value={runtime.storage.s3_public_base_url ?? '—'} mono />
          <RuntimeKV
            label="Prefixes"
            value={`${runtime.storage.upload_prefix} / ${runtime.storage.processed_prefix} / ${runtime.storage.final_prefix}`}
            mono
          />
          <RuntimeKV
            label="Assets"
            value={`${runtime.storage.backgrounds_prefix} / ${runtime.storage.watermarks_prefix}`}
            mono
          />
          <RuntimeKV label="Local cache" value={runtime.storage.local_storage_root} mono />
        </RuntimeCard>

        <RuntimeCard title="Integrations" description="External services">
          <RuntimeKV
            label="MongoDB"
            value={
              runtime.mongodb.enabled
                ? `${runtime.mongodb.ok ? 'Connected' : 'Unreachable'} · ${runtime.mongodb.db}`
                : 'Not configured'
            }
          />
          <RuntimeKV
            label="Google Drive"
            value={runtime.google_drive_configured ? 'Configured' : 'Not configured'}
          />
        </RuntimeCard>
      </div>

      <RuntimeCard title="Libraries" description="Installed package versions on the API server">
        <div className="flex flex-wrap gap-2 py-3">
          <LibChip name="rembg" version={runtime.libraries.rembg} />
          <LibChip name="pillow" version={runtime.libraries.pillow} />
          <LibChip name="onnxruntime" version={runtime.libraries.onnxruntime} />
          <LibChip name="numpy" version={runtime.libraries.numpy} />
          <LibChip name="pymongo" version={runtime.libraries.pymongo} />
          <LibChip name="fastapi" version={runtime.libraries.fastapi} />
          <LibChip name="boto3" version={runtime.libraries.boto3} />
        </div>
      </RuntimeCard>
    </div>
  );
}
