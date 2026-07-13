'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  CATEGORY_OPTIONS,
  COLOR_OPTIONS,
  CONTENT_STATUS_DEFAULT,
  MATERIAL_OPTIONS,
} from '../lib/constants';
import { resolveExactFieldNames } from '../lib/product-mutation-utils';

export type AddProductFormValues = {
  collectionName: string;
  codeNumber: string;
  category: string;
  material: string;
  color: string;
  price: string;
};

const inputClass =
  'mt-1 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 dark:border-white/10 dark:bg-zinc-800 dark:text-white';
const labelClass = 'text-xs font-semibold uppercase tracking-wide text-black/55 dark:text-white/50';
const btnPrimary =
  'rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50';
const btnSecondary =
  'rounded-lg border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5';

const EMPTY_VALUES: AddProductFormValues = {
  collectionName: '',
  codeNumber: '',
  category: '',
  material: '',
  color: '',
  price: '',
};

interface AddProductFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AddProductFormValues) => Promise<void>;
  busy?: boolean;
}

export function AddProductForm({ open, onClose, onSubmit, busy = false }: AddProductFormProps) {
  const [values, setValues] = React.useState<AddProductFormValues>(EMPTY_VALUES);
  const [addAnother, setAddAnother] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const collectionRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setValues(EMPTY_VALUES);
    setError(null);
    const t = window.setTimeout(() => collectionRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const setField = (key: keyof AddProductFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = values.collectionName.trim();
    const code = values.codeNumber.trim();
    if (!name && !code) {
      setError('Enter a collection name or code number.');
      return;
    }
    try {
      await onSubmit(values);
      if (addAnother) {
        setValues(EMPTY_VALUES);
        setError(null);
        collectionRef.current?.focus();
      } else {
        onClose();
      }
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Could not add product.';
      try {
        const parsed = JSON.parse(message) as { detail?: string };
        if (parsed.detail === 'REQUIRES_COLLECTION_OR_CODE') {
          message = 'Enter a collection name or code number.';
        } else if (parsed.detail) {
          message = String(parsed.detail);
        }
      } catch {
        // keep raw message
      }
      setError(message);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[3000] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm sm:pt-[14vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-lg animate-fade-in rounded-2xl border border-black/10 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-zinc-900"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-black dark:text-white">Add product</h2>
            <p className="mt-0.5 text-xs text-black/50 dark:text-white/45">
              Collection name or code is enough — fill the rest anytime in the list.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/5"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className={labelClass}>Collection name *</span>
            <input
              ref={collectionRef}
              className={inputClass}
              value={values.collectionName}
              onChange={(e) => setField('collectionName', e.target.value)}
              placeholder="e.g. Aurora"
              autoComplete="off"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>Code number</span>
              <input
                className={inputClass}
                value={values.codeNumber}
                onChange={(e) => setField('codeNumber', e.target.value)}
                placeholder="Optional"
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className={labelClass}>Price</span>
              <input
                className={inputClass}
                value={values.price}
                onChange={(e) => setField('price', e.target.value)}
                placeholder="Optional"
                inputMode="decimal"
                autoComplete="off"
              />
            </label>
          </div>

          <label className="block">
            <span className={labelClass}>Category</span>
            <select
              className={inputClass}
              value={values.category}
              onChange={(e) => setField('category', e.target.value)}
            >
              <option value="">—</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>Material</span>
              <select
                className={inputClass}
                value={values.material}
                onChange={(e) => setField('material', e.target.value)}
              >
                <option value="">—</option>
                {MATERIAL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Color</span>
              <select
                className={inputClass}
                value={values.color}
                onChange={(e) => setField('color', e.target.value)}
              >
                <option value="">—</option>
                {COLOR_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-black/55 dark:text-white/50">
            <input
              type="checkbox"
              checked={addAnother}
              onChange={(e) => setAddAnother(e.target.checked)}
              className="rounded border-black/20"
            />
            Add another
          </label>
          <div className="flex gap-2">
            <button type="button" className={btnSecondary} onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy ? 'Adding…' : 'Add product'}
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-black/35 dark:text-white/30">
          Enter to save · Esc to close
        </p>
      </form>
    </div>,
    document.body,
  );
}

export function buildFieldsFromAddForm(
  values: AddProductFormValues,
  columns: string[],
  nextNum: number,
): Record<string, unknown> {
  const draft: Record<string, unknown> = {
    'Collection Name': values.collectionName.trim(),
    'CODE NUMBER': values.codeNumber.trim(),
    Category: values.category.trim(),
    Material: values.material.trim(),
    Color: values.color.trim(),
    Price: values.price.trim(),
    Num: nextNum,
    'Content Status': CONTENT_STATUS_DEFAULT,
  };

  const resolved = resolveExactFieldNames(columns, draft);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(resolved)) {
    if (value === '' || value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}
