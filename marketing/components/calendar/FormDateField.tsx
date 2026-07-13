'use client';

import React, { useEffect, useRef, useState } from 'react';

import { MARKETING_DATE_FORMAT, normalizeIsoDateInput } from '../../lib/calendar/date-utils';
import { DateCalendarPanel } from './DateCalendarPanel';

interface FormDateFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function FormDateField({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = MARKETING_DATE_FORMAT,
  className = '',
}: FormDateFieldProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const commitDraft = () => {
    if (!draft.trim()) {
      onChange('');
      return;
    }
    const normalized = normalizeIsoDateInput(draft);
    if (normalized) {
      onChange(normalized);
      setDraft(normalized);
      return;
    }
    setDraft(value);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          id={id}
          value={draft}
          disabled={disabled}
          inputMode="numeric"
          placeholder={placeholder}
          className="w-full rounded-xl border border-input bg-background py-2.5 pl-3 pr-10 text-sm tabular-nums outline-none ring-primary/20 transition-all placeholder:text-muted-foreground/40 focus:ring-2 disabled:opacity-50"
          onFocus={() => setOpen(true)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft();
              setOpen(false);
            }
            if (e.key === 'Escape') {
              setDraft(value);
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label="Open calendar"
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          onClick={() => setOpen((prev) => !prev)}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>
      </div>

      {open && !disabled && (
        <div className="absolute left-0 top-full z-[140] mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
          <DateCalendarPanel
            value={normalizeIsoDateInput(draft) ?? value}
            onSelect={(iso) => {
              onChange(iso);
              setDraft(iso);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
