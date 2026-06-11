'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/page-header';
import { RuntimePanel } from '@/components/runtime-panel';
import {
  getSettings,
  resetWatermark,
  resolveMediaUrl,
  updateSettings,
  uploadBackground,
  uploadWatermark,
  type Background,
  type RuntimeInfo,
  type SystemSettings,
  type WatermarkInfo,
} from '@/lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [watermark, setWatermark] = useState<WatermarkInfo | null>(null);
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  const [resettingWatermark, setResettingWatermark] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newBgName, setNewBgName] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getSettings();
      setSettings(res.settings);
      setBackgrounds(res.backgrounds);
      setWatermark(res.watermark);
      setRuntime(res.runtime);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSettings(patch: Partial<SystemSettings>) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await updateSettings(patch);
      setSettings(res.settings);
      setBackgrounds(res.backgrounds);
      setWatermark(res.watermark);
      setRuntime(res.runtime);
      setMessage('Settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleWatermarkUpload(file: File | null) {
    if (!file) return;
    setUploadingWatermark(true);
    setError(null);
    setMessage(null);
    try {
      const res = await uploadWatermark(file);
      setSettings(res.settings);
      setWatermark(res.watermark);
      setMessage('Watermark updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Watermark upload failed');
    } finally {
      setUploadingWatermark(false);
    }
  }

  async function handleWatermarkReset() {
    setResettingWatermark(true);
    setError(null);
    setMessage(null);
    try {
      const res = await resetWatermark();
      setSettings(res.settings);
      setWatermark(res.watermark);
      setMessage('Watermark reset to Lorenzo logo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset watermark');
    } finally {
      setResettingWatermark(false);
    }
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await uploadBackground(file, { displayName: newBgName || undefined });
      setBackgrounds(res.backgrounds);
      setNewBgName('');
      setMessage(`Background "${res.background.name}" uploaded`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <p className="text-sm text-brand-medium-gray">Loading settings…</p>;
  if (!settings || !runtime || !watermark) return <p className="text-sm text-red-700">Settings unavailable.</p>;

  const watermarkPreview = resolveMediaUrl(watermark.preview_url);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Default processing behavior and background templates for new batches."
      />

      <section className="dash-panel">
        <div className="dash-panel-body space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-brand-black">Runtime</h2>
            <p className="mt-1 text-xs text-brand-medium-gray">Live server config — environment, libraries, and processing.</p>
          </div>
          <RuntimePanel runtime={runtime} settings={settings} watermark={watermark} />
        </div>
      </section>

      <section className="dash-panel">
        <div className="dash-panel-body space-y-4">
          <h2 className="text-sm font-semibold text-brand-black">Processing</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 text-sm text-brand-dark-gray">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input text-brand-burgundy focus:ring-brand-burgundy/30"
                checked={settings.auto_process_on_import}
                disabled={saving}
                onChange={(e) => void saveSettings({ auto_process_on_import: e.target.checked })}
              />
              <span>Auto-process images after import</span>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-brand-black">
                Subject size ({Math.round(settings.subject_fill_ratio * 100)}%)
              </span>
              <input
                type="range"
                min={50}
                max={95}
                value={Math.round(settings.subject_fill_ratio * 100)}
                disabled={saving}
                className="w-full accent-brand-burgundy"
                onChange={(e) => {
                  const ratio = Number(e.target.value) / 100;
                  setSettings((prev) => (prev ? { ...prev, subject_fill_ratio: ratio } : prev));
                }}
                onMouseUp={(e) => {
                  const ratio = Number((e.target as HTMLInputElement).value) / 100;
                  void saveSettings({ subject_fill_ratio: ratio });
                }}
                onTouchEnd={(e) => {
                  const ratio = Number((e.target as HTMLInputElement).value) / 100;
                  void saveSettings({ subject_fill_ratio: ratio });
                }}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="dash-panel">
        <div className="dash-panel-body space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-brand-black">Watermark</h2>
            <p className="mt-1 text-xs text-brand-medium-gray">
              Placed bottom-center on every finalized product image.
            </p>
          </div>

          <label className="flex items-center gap-3 text-sm text-brand-dark-gray">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input text-brand-burgundy focus:ring-brand-burgundy/30"
              checked={settings.watermark_enabled}
              disabled={saving}
              onChange={(e) => void saveSettings({ watermark_enabled: e.target.checked })}
            />
            <span>Apply watermark to product images</span>
          </label>

          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-brand-medium-gray/25 bg-[#2a2a2a]">
              {watermarkPreview ? (
                <div className="absolute inset-x-0 bottom-0 flex justify-center p-4">
                  <Image
                    src={watermarkPreview}
                    alt={watermark.name}
                    width={Math.round(runtime.output_width * settings.watermark_scale)}
                    height={80}
                    className="h-auto max-w-full object-contain"
                    style={{ opacity: settings.watermark_opacity }}
                    unoptimized
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="font-medium text-brand-black">
                  Logo width ({Math.round(settings.watermark_scale * 100)}% of canvas)
                </span>
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={Math.round(settings.watermark_scale * 100)}
                  disabled={saving}
                  className="w-full accent-brand-burgundy"
                  onChange={(e) => {
                    const scale = Number(e.target.value) / 100;
                    setSettings((prev) => (prev ? { ...prev, watermark_scale: scale } : prev));
                  }}
                  onMouseUp={(e) => {
                    const scale = Number((e.target as HTMLInputElement).value) / 100;
                    void saveSettings({ watermark_scale: scale });
                  }}
                  onTouchEnd={(e) => {
                    const scale = Number((e.target as HTMLInputElement).value) / 100;
                    void saveSettings({ watermark_scale: scale });
                  }}
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="font-medium text-brand-black">
                  Opacity ({Math.round(settings.watermark_opacity * 100)}%)
                </span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(settings.watermark_opacity * 100)}
                  disabled={saving}
                  className="w-full accent-brand-burgundy"
                  onChange={(e) => {
                    const opacity = Number(e.target.value) / 100;
                    setSettings((prev) => (prev ? { ...prev, watermark_opacity: opacity } : prev));
                  }}
                  onMouseUp={(e) => {
                    const opacity = Number((e.target as HTMLInputElement).value) / 100;
                    void saveSettings({ watermark_opacity: opacity });
                  }}
                  onTouchEnd={(e) => {
                    const opacity = Number((e.target as HTMLInputElement).value) / 100;
                    void saveSettings({ watermark_opacity: opacity });
                  }}
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="font-medium text-brand-black">
                  Bottom margin ({settings.watermark_bottom_margin_px}px)
                </span>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={settings.watermark_bottom_margin_px}
                  disabled={saving}
                  className="w-full accent-brand-burgundy"
                  onChange={(e) => {
                    const margin = Number(e.target.value);
                    setSettings((prev) => (prev ? { ...prev, watermark_bottom_margin_px: margin } : prev));
                  }}
                  onMouseUp={(e) => {
                    const margin = Number((e.target as HTMLInputElement).value);
                    void saveSettings({ watermark_bottom_margin_px: margin });
                  }}
                  onTouchEnd={(e) => {
                    const margin = Number((e.target as HTMLInputElement).value);
                    void saveSettings({ watermark_bottom_margin_px: margin });
                  }}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  className="block text-xs text-brand-dark-gray file:mr-3 file:rounded-full file:border-0 file:bg-brand-burgundy/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-burgundy"
                  type="file"
                  accept="image/*"
                  disabled={uploadingWatermark}
                  onChange={(e) => void handleWatermarkUpload(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className="btn-outline px-3 py-1.5 text-xs"
                  disabled={resettingWatermark}
                  onClick={() => void handleWatermarkReset()}
                >
                  {resettingWatermark ? 'Resetting…' : 'Reset to Lorenzo logo'}
                </button>
              </div>
              {uploadingWatermark && <p className="text-xs text-brand-medium-gray">Uploading watermark…</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="dash-panel">
        <div className="dash-panel-body space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-brand-black">Default background</h2>
            <p className="mt-1 text-xs text-brand-medium-gray">Applied automatically during processing.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {backgrounds.map((bg) => {
              const preview = resolveMediaUrl(bg.preview_url ?? null);
              const selected = bg.id === settings.default_background_id;
              return (
                <article
                  key={bg.id}
                  className={`overflow-hidden rounded-xl border transition ${
                    selected ? 'border-brand-burgundy ring-1 ring-brand-burgundy/25' : 'border-brand-medium-gray/25'
                  }`}
                >
                  <div className="relative aspect-[3/4] bg-brand-light-gray/60">
                    {preview ? <Image src={preview} alt={bg.name} fill className="object-cover" unoptimized /> : null}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{bg.name}</p>
                    </div>
                    <button
                      type="button"
                      className={selected ? 'btn-outline px-2.5 py-1 text-[10px]' : 'btn-primary px-2.5 py-1 text-[10px]'}
                      disabled={saving || selected}
                      onClick={() => void saveSettings({ default_background_id: bg.id })}
                    >
                      {selected ? 'Default' : 'Use'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="dash-panel">
        <div className="dash-panel-body space-y-3">
          <h2 className="text-sm font-semibold text-brand-black">Upload template</h2>
          <p className="text-xs text-brand-medium-gray">
            Resized to {runtime.output_width} × {runtime.output_height} on upload.
          </p>
          <input
            className="field-input max-w-sm"
            value={newBgName}
            onChange={(e) => setNewBgName(e.target.value)}
            placeholder="Display name (optional)"
          />
          <input
            className="block max-w-sm text-xs text-brand-dark-gray file:mr-3 file:rounded-full file:border-0 file:bg-brand-burgundy/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-burgundy"
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
          />
          {uploading && <p className="text-xs text-brand-medium-gray">Uploading…</p>}
        </div>
      </section>

      {message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
