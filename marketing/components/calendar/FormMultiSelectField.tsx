'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

interface FormMultiSelectFieldProps {
  id?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  allowCreate?: boolean;
  className?: string;
}

function parseSelected(value: string): Set<string> {
  if (!value.trim()) return new Set();
  return new Set(
    value
      .split(/[,\n;]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function serializeSelected(selected: Set<string>): string {
  return Array.from(selected).join(', ');
}

export function FormMultiSelectField({
  id,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Select channels…',
  allowCreate = true,
  className = '',
}: FormMultiSelectFieldProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const selected = useMemo(() => parseSelected(value), [value]);
  const [draftSelected, setDraftSelected] = useState<Set<string>>(new Set(selected));

  useEffect(() => {
    setDraftSelected(new Set(selected));
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        onChange(serializeSelected(draftSelected));
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, draftSelected, onChange]);

  const toggleItem = (item: string) => {
    const next = new Set(draftSelected);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setDraftSelected(next);
    onChange(serializeSelected(next));
  };

  const addNew = () => {
    const clean = searchTerm.trim();
    if (!clean) return;
    const next = new Set(draftSelected);
    next.add(clean);
    setDraftSelected(next);
    onChange(serializeSelected(next));
    setSearchTerm('');
  };

  const q = searchTerm.trim().toLowerCase();
  const filteredOptions = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  const alreadyExists = options.some((o) => o.toLowerCase() === q);

  const selectedList = Array.from(selected);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 py-2 text-left text-sm outline-none ring-primary/20 transition-all focus-visible:ring-2 disabled:opacity-50"
      >
        <span className="min-w-0 flex-1">
          {selectedList.length === 0 ? (
            <span className="text-muted-foreground/40">{placeholder}</span>
          ) : (
            <span className="flex flex-wrap gap-1.5">
              {selectedList.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-semibold text-foreground"
                >
                  {item}
                </span>
              ))}
            </span>
          )}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="absolute left-0 top-full z-[140] mt-2 w-full min-w-[16rem] overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
          <div className="border-b border-border bg-muted/30 p-3">
            <div className="relative">
              <input
                autoFocus
                className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs font-medium outline-none transition-all focus:ring-2 focus:ring-primary/20"
                placeholder="Search or add…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (allowCreate && q && !alreadyExists) addNew();
                  }
                  if (e.key === 'Escape') setOpen(false);
                }}
              />
              <svg
                className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="cc-scroll max-h-60 overflow-y-auto border-b border-border p-1">
            {allowCreate && q && !alreadyExists && (
              <button
                type="button"
                className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-muted"
                onClick={addNew}
              >
                <div className="flex h-4 w-4 items-center justify-center rounded border-2 border-primary/30 group-hover:border-primary">
                  <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                Add &quot;{searchTerm}&quot;
              </button>
            )}

            {filteredOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors ${
                  draftSelected.has(opt) ? 'bg-primary/5 text-primary' : 'text-foreground/80 hover:bg-muted'
                }`}
                onClick={() => toggleItem(opt)}
              >
                <div
                  className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-all ${
                    draftSelected.has(opt) ? 'border-primary bg-primary' : 'border-border'
                  }`}
                >
                  {draftSelected.has(opt) && (
                    <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={draftSelected.has(opt) ? 'font-bold' : ''}>{opt}</span>
              </button>
            ))}

            {filteredOptions.length === 0 && !q && (
              <div className="px-3 py-6 text-center text-[10px] font-medium text-muted-foreground/60">
                No options yet. Type to add one.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between bg-muted/10 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {draftSelected.size} selected
            </span>
            <button
              type="button"
              className="text-[10px] font-bold text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
