'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';

import { parseMultiValueField } from '../../lib/calendar/multi-value-field';

interface MultiSelectProps {
  value: string;
  options: string[];
  mode?: 'single' | 'multi';
  placeholder?: string;
  className?: string;
  onCommit: (value: string) => void;
  onClose: () => void;
  allowDeleteOptions?: boolean;
  onDeleteOption?: (option: string) => Promise<unknown>;
  onRegisterOption?: (option: string) => Promise<void>;
}

export function MultiSelect({
  value,
  options,
  mode = 'multi',
  placeholder = 'Search or add...',
  onCommit,
  onClose,
  allowDeleteOptions = false,
  onDeleteOption,
  onRegisterOption,
}: MultiSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingOption, setDeletingOption] = useState<string | null>(null);
  
  const selectedItems = useMemo(() => new Set(parseMultiValueField(value)), [value]);
  const [draftSelected, setDraftSelected] = useState<Set<string>>(new Set(selectedItems));

  useEffect(() => {
    setDraftSelected(new Set(selectedItems));
  }, [selectedItems]);

  const getCurrentValue = () => Array.from(draftSelected).join(', ');

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onCommit(getCurrentValue());
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [onCommit, draftSelected]);

  const toggleItem = (item: string) => {
    if (mode === 'single') {
      setDraftSelected(new Set([item]));
      return;
    }
    const next = new Set(draftSelected);
    if (next.has(item)) {
      next.delete(item);
    } else {
      next.add(item);
    }
    setDraftSelected(next);
  };

  const addNew = async () => {
    const clean = searchTerm.trim();
    if (!clean) {
      onCommit(getCurrentValue());
      return;
    }
    await onRegisterOption?.(clean);
    const next = new Set(draftSelected);
    next.add(clean);
    setDraftSelected(next);
    setSearchTerm('');
  };

  const allOptions = useMemo(() => {
    const merged = new Set(options);
    draftSelected.forEach((item) => merged.add(item));
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [options, draftSelected]);

  const handleDeleteOption = async (e: React.MouseEvent, opt: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onDeleteOption || deletingOption) return;

    setDeletingOption(opt);
    try {
      const result = await onDeleteOption(opt);
      if (result) {
        setDraftSelected((prev) => {
          const next = new Set(prev);
          next.delete(opt);
          return next;
        });
      }
    } finally {
      setDeletingOption(null);
    }
  };

  const q = searchTerm.trim().toLowerCase();
  const filteredOptions = q ? allOptions.filter((o) => o.toLowerCase().includes(q)) : allOptions;
  const alreadyExists = allOptions.some((o) => o.toLowerCase() === q);

  return (
    <div 
      ref={rootRef}
      className="absolute top-0 left-0 z-[100] w-72 rounded-2xl border border-border bg-popover/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-3 border-b border-border bg-muted/30">
        <div className="relative">
          <input
            autoFocus
            className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addNew();
              }
              if (e.key === 'Escape') onClose();
            }}
          />
          <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="max-h-60 overflow-y-auto p-1 cc-scroll border-b border-border">
        {!alreadyExists && q && (
          <button
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-primary hover:bg-muted rounded-lg transition-colors group"
            onClick={() => void addNew()}
          >
            <div className="w-4 h-4 rounded border-2 border-primary/30 flex items-center justify-center group-hover:border-primary">
              <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            Add "{searchTerm}"
          </button>
        )}

        {filteredOptions.map((opt) => {
          const isSelected = draftSelected.has(opt);
          const showDelete = allowDeleteOptions && !isSelected && onDeleteOption;

          return (
            <div
              key={opt}
              className={`flex items-center gap-1 rounded-lg transition-colors ${
                isSelected ? 'bg-primary/5 text-primary' : 'hover:bg-muted text-foreground/80'
              }`}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left text-xs"
                onClick={() => toggleItem(opt)}
              >
                <div className={`w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-border'}`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`truncate ${isSelected ? 'font-bold' : ''}`}>{opt}</span>
              </button>

              {showDelete ? (
                <button
                  type="button"
                  title={`Remove "${opt}" everywhere`}
                  aria-label={`Remove ${opt}`}
                  disabled={deletingOption === opt}
                  className="mr-1 shrink-0 rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  onClick={(e) => void handleDeleteOption(e, opt)}
                >
                  {deletingOption === opt ? (
                    <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              ) : null}
            </div>
          );
        })}

        {filteredOptions.length === 0 && !q && allOptions.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-[10px] text-muted-foreground/60 font-medium">No audiences found. Type to add your first!</p>
          </div>
        )}
      </div>

      <div className="px-3 py-2 bg-muted/10 flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {mode === 'single'
            ? draftSelected.size === 1
              ? '1 selected'
              : 'Select one'
            : `${draftSelected.size} Selected`}
        </span>
        <span className="text-[10px] text-muted-foreground/50">
          Click outside to save
        </span>
      </div>
    </div>
  );
}
