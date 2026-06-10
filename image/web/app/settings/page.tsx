'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/page-header';
import {
  getSettings,
  resolveMediaUrl,
  updateSettings,
  uploadBackground,
  type Background,
  type RuntimeInfo,
  type SystemSettings,
} from '@/lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
      setRuntime(res.runtime);
      setMessage('Settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
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
  if (!settings || !runtime) return <p className="text-sm text-red-700">Settings unavailable.</p>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Default processing behavior and background templates for new batches."
      />

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

      <section className="dash-panel">
        <div className="dash-panel-body">
          <h2 className="mb-3 text-sm font-semibold text-brand-black">Runtime</h2>
          <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-brand-medium-gray">Output size</dt>
              <dd className="mt-0.5 font-medium">{runtime.output_width} × {runtime.output_height}</dd>
            </div>
            <div>
              <dt className="text-brand-medium-gray">Amazon S3</dt>
              <dd className="mt-0.5 font-medium">{runtime.s3_enabled ? `On · ${runtime.s3_bucket}` : 'Off'}</dd>
            </div>
            <div>
              <dt className="text-brand-medium-gray">Google Drive</dt>
              <dd className="mt-0.5 font-medium">{runtime.google_drive_configured ? 'Configured' : 'Not configured'}</dd>
            </div>
            <div>
              <dt className="text-brand-medium-gray">Upload prefix</dt>
              <dd className="mt-0.5 font-medium">{runtime.upload_prefix}</dd>
            </div>
            <div>
              <dt className="text-brand-medium-gray">Processed prefix</dt>
              <dd className="mt-0.5 font-medium">{runtime.processed_prefix}</dd>
            </div>
            <div>
              <dt className="text-brand-medium-gray">Final prefix</dt>
              <dd className="mt-0.5 font-medium">{runtime.final_prefix}</dd>
            </div>
          </dl>
        </div>
      </section>

      {message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
