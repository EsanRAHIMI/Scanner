'use client';

import { type ReactNode } from 'react';

import {
  CUTOUT_ENGINE_OPTIONS,
  MANAGED_PROVIDER_OPTIONS,
  PROCESSING_MODE_OPTIONS,
  QUALITY_MODE_OPTIONS,
  type RuntimeInfo,
  type SystemSettings,
} from '@/lib/api';

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

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 border-b border-brand-medium-gray/10 py-3.5 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-brand-black">{label}</p>
        {hint ? <p className="text-xs leading-relaxed text-brand-medium-gray">{hint}</p> : null}
      </div>
      <div className="w-full sm:w-auto sm:min-w-[12rem]">{children}</div>
    </div>
  );
}

function EffectiveBadge({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  const dot = tone === 'ok' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : 'bg-brand-medium-gray/50';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-medium-gray/15 bg-brand-light-gray/40 px-2.5 py-1 text-[10px]">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="font-medium text-brand-dark-gray">{label}</span>
      <span className="font-mono text-brand-black">{value}</span>
    </span>
  );
}

type Props = {
  settings: SystemSettings;
  runtime: RuntimeInfo;
  saving?: boolean;
  onSave: (patch: Partial<SystemSettings>) => void;
};

export function CutoutEnginePanel({ settings, runtime, saving = false, onSave }: Props) {
  const eff = runtime.cutout;
  const engine = settings.cutout_engine ?? eff?.engine ?? 'self_hosted';
  const processingMode = settings.processing_mode ?? eff?.processing_mode ?? 'cpu';
  const quality = settings.quality_mode ?? eff?.quality ?? 'balanced';
  const managedEnabled = settings.managed_api_enabled ?? eff?.managed_api_enabled ?? false;
  const managedProvider = settings.managed_api_provider ?? eff?.managed_api_provider ?? 'none';
  const threshold = settings.hybrid_escalate_below ?? 0.55;

  const rend = {
    master_png: settings.render_master_png ?? eff?.renditions.master_png ?? true,
    master_webp: settings.render_master_webp ?? eff?.renditions.master_webp ?? true,
    web_webp: settings.render_web_webp ?? eff?.renditions.web_webp ?? true,
    web_avif: settings.render_web_avif ?? eff?.renditions.web_avif ?? false,
    branded_jpeg: settings.render_branded_jpeg ?? true,
  };

  const isHybrid = engine === 'hybrid';
  const showsManaged = engine === 'managed_api' || engine === 'hybrid';

  return (
    <section className="dash-panel">
      <div className="dash-panel-body space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-burgundy">Cutout engine</p>
          <h2 className="mt-1 text-sm font-semibold text-brand-black">Processing mode & quality</h2>
          <p className="mt-0.5 text-xs text-brand-medium-gray">
            Switch engines and quality without redeploying. Defaults are CPU + balanced (today&apos;s output).
          </p>
        </div>

        {eff ? (
          <div className="flex flex-wrap gap-1.5">
            <EffectiveBadge label="active" value={`${eff.engine}/${eff.quality}/${eff.processing_mode}`} tone="ok" />
            <EffectiveBadge
              label="managed"
              value={eff.managed_api_enabled ? `${eff.managed_api_provider} ${eff.managed_api_key_set ? '· key set' : '· no key'}` : 'off'}
              tone={eff.managed_api_enabled ? (eff.managed_api_key_set ? 'ok' : 'warn') : undefined}
            />
            <EffectiveBadge label="pymatting" value={eff.pymatting_available ? 'available' : 'fallback'} tone={eff.pymatting_available ? 'ok' : 'warn'} />
          </div>
        ) : null}

        <div className="rounded-xl border border-brand-medium-gray/15 bg-brand-white px-4">
          <Row label="Engine" hint="self-hosted (local), managed API, or hybrid (local first, escalate hard images).">
            <select
              className="field-input py-2 text-xs"
              value={engine}
              disabled={saving}
              onChange={(e) => onSave({ cutout_engine: e.target.value })}
            >
              {CUTOUT_ENGINE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </Row>

          <Row label="Processing mode" hint="GPU is reserved for a future self-hosted upgrade; falls back to CPU until available.">
            <select
              className="field-input py-2 text-xs"
              value={processingMode}
              disabled={saving}
              onChange={(e) => onSave({ processing_mode: e.target.value })}
            >
              {PROCESSING_MODE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </Row>

          <Row label="Quality" hint="premium = soft-alpha matting + edge refine + halo removal. balanced = legacy. fast = lighter/quicker.">
            <select
              className="field-input py-2 text-xs"
              value={quality}
              disabled={saving}
              onChange={(e) => onSave({ quality_mode: e.target.value })}
            >
              {QUALITY_MODE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </Row>

          {showsManaged ? (
            <>
              <Row label="Managed API enabled" hint="Use a paid cutout API. The API key is set via env (IMAGE_MANAGED_API_KEY) for security.">
                <div className="flex items-center justify-end gap-3">
                  <span className="text-xs text-brand-medium-gray">{managedEnabled ? 'On' : 'Off'}</span>
                  <Toggle label="Managed API enabled" checked={managedEnabled} disabled={saving} onChange={(v) => onSave({ managed_api_enabled: v })} />
                </div>
              </Row>
              <Row label="Managed provider" hint="Which external engine to call.">
                <select
                  className="field-input py-2 text-xs"
                  value={managedProvider}
                  disabled={saving || !managedEnabled}
                  onChange={(e) => onSave({ managed_api_provider: e.target.value })}
                >
                  {MANAGED_PROVIDER_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </Row>
            </>
          ) : null}

          {isHybrid ? (
            <Row label={`Escalate below confidence (${threshold.toFixed(2)})`} hint="When the local cutout confidence is below this, hybrid retries via the managed API.">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={threshold}
                disabled={saving}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-brand-medium-gray/25 accent-brand-burgundy"
                onChange={(e) => onSave({ hybrid_escalate_below: Number(e.target.value) })}
              />
            </Row>
          ) : null}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-brand-black">Output renditions</h3>
          <p className="mt-0.5 text-xs text-brand-medium-gray">Generated automatically on finalize and available on demand.</p>
          <div className="mt-3 grid gap-2 rounded-xl border border-brand-medium-gray/15 bg-brand-white px-4 py-2">
            {([
              ['render_master_png', 'Transparent master (PNG)', rend.master_png],
              ['render_master_webp', 'Transparent master (WebP, lossless)', rend.master_webp],
              ['render_web_webp', 'Web-optimized WebP', rend.web_webp],
              ['render_web_avif', 'Web-optimized AVIF (needs plugin)', rend.web_avif],
              ['render_branded_jpeg', 'Branded JPEG on background', rend.branded_jpeg],
            ] as const).map(([key, label, value]) => (
              <label key={key} className="flex items-center justify-between gap-3 border-b border-brand-medium-gray/10 py-2 text-sm last:border-b-0">
                <span className="text-brand-dark-gray">{label}</span>
                <Toggle
                  label={label}
                  checked={value}
                  disabled={saving}
                  onChange={(v) => onSave({ [key]: v } as Partial<SystemSettings>)}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
