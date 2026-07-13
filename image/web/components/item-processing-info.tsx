'use client';

import { useState } from 'react';

import { applyItemProcessingSettings, type BatchItem } from '@/lib/api';

type ItemProcessingInfoProps = {
  item: BatchItem;
  onSettingsApplied?: () => void;
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1 text-[11px]">
      <span className="text-brand-medium-gray">{label}</span>
      <span className="max-w-[58%] text-right font-medium text-brand-black">{value}</span>
    </div>
  );
}

function formatBool(value: boolean | undefined) {
  if (value === undefined) return '—';
  return value ? 'Yes' : 'No';
}

export function ItemProcessingInfo({ item, onSettingsApplied }: ItemProcessingInfoProps) {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meta = item.processing_meta;
  const rembg = meta?.rembg;
  const hasMeta = Boolean(meta && rembg);

  async function handleApply() {
    setApplying(true);
    setError(null);
    setMessage(null);
    try {
      await applyItemProcessingSettings(item.id);
      setMessage('Applied to global settings');
      onSettingsApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply settings');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="border-t border-brand-medium-gray/15">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Processing details"
        className="flex w-full items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-brand-medium-gray transition-colors hover:text-brand-burgundy"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition-colors ${
            open
              ? 'border-brand-burgundy/40 bg-brand-burgundy/10 text-brand-burgundy'
              : 'border-brand-medium-gray/30 bg-brand-light-gray/60'
          }`}
        >
          i
        </span>
        <span>{open ? 'Hide details' : 'Processing info'}</span>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 border-t border-brand-medium-gray/10 bg-brand-light-gray/25 px-2.5 py-2.5">
            {!hasMeta ? (
              <p className="text-[11px] text-brand-medium-gray">
                No processing metadata yet. Reprocess this image to capture settings.
              </p>
            ) : (
              <>
                <MetaRow label="Model" value={rembg?.configured_model ?? '—'} />
                {rembg?.loaded_model && rembg.loaded_model !== rembg.configured_model ? (
                  <MetaRow label="Loaded" value={rembg.loaded_model} />
                ) : null}
                <MetaRow label="Preserve detail" value={formatBool(rembg?.preserve_detail)} />
                <MetaRow label="Mask dilate" value={String(rembg?.mask_dilate ?? '—')} />
                <MetaRow label="Alpha matting" value={formatBool(rembg?.alpha_matting)} />
                <MetaRow label="Min size" value={rembg?.min_dimension ? `${rembg.min_dimension}px` : '—'} />
                {meta?.subject_fill_ratio !== undefined ? (
                  <MetaRow label="Subject fill" value={`${Math.round(meta.subject_fill_ratio * 100)}%`} />
                ) : null}
                {meta?.background_id ? <MetaRow label="Background" value={meta.background_id} /> : null}
                {meta?.processed_at ? (
                  <MetaRow
                    label="Processed"
                    value={new Date(meta.processed_at).toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  />
                ) : null}

                <button
                  type="button"
                  className="btn-outline mt-1 w-full py-1.5 text-[11px]"
                  disabled={applying}
                  onClick={() => void handleApply()}
                >
                  {applying ? 'Applying…' : 'Use these settings globally'}
                </button>
              </>
            )}

            {message ? <p className="text-[10px] text-emerald-700">{message}</p> : null}
            {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
