'use client';

import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

import {
  parseHashtagInputTokens,
  parseMultiValueField,
  resolveOptionToken,
} from '../../lib/calendar/multi-value-field';
import { useFloatingPopoverPosition } from './use-floating-popover-position';

interface MultiSelectProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  value: string;
  options: string[];
  mode?: 'single' | 'multi';
  placeholder?: string;
  fieldLabel?: string;
  allowClearSelection?: boolean;
  /** When set to "hashtag", space/newline-separated tokens in search are added separately. */
  inputTokenMode?: 'default' | 'hashtag';
  onCommit: (value: string) => void;
  onClose: () => void;
  allowDeleteOptions?: boolean;
  onDeleteOption?: (option: string) => Promise<unknown>;
  onRegisterOption?: (option: string) => Promise<void>;
}

export function MultiSelect({
  anchorRef,
  value,
  options,
  mode = 'multi',
  placeholder = 'Search or add...',
  fieldLabel,
  allowClearSelection = false,
  inputTokenMode = 'default',
  onCommit,
  onClose,
  allowDeleteOptions = false,
  onDeleteOption,
  onRegisterOption,
}: MultiSelectProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingOption, setDeletingOption] = useState<string | null>(null);

  const selectedItems = useMemo(() => new Set(parseMultiValueField(value)), [value]);
  const [draftSelected, setDraftSelected] = useState<Set<string>>(new Set(selectedItems));

  const popoverStyle = useFloatingPopoverPosition(anchorRef, popoverRef, mounted);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDraftSelected(new Set(selectedItems));
  }, [selectedItems]);

  const getCurrentValue = () => Array.from(draftSelected).join(', ');

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onCommit(getCurrentValue());
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [onCommit, draftSelected, anchorRef]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const toggleItem = (item: string) => {
    if (mode === 'single') {
      setDraftSelected(new Set([item]));
      onCommit(item);
      onClose();
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

  const allOptions = useMemo(() => {
    const merged = new Set(options);
    draftSelected.forEach((item) => merged.add(item));
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [options, draftSelected]);

  const parseInputTokens = (raw: string): string[] => {
    if (inputTokenMode === 'hashtag') {
      return parseHashtagInputTokens(raw);
    }
    const single = raw.trim();
    return single ? [single] : [];
  };

  const addTokens = async (raw: string) => {
    const tokens = parseInputTokens(raw);
    if (tokens.length === 0) {
      onCommit(getCurrentValue());
      return;
    }

    const optionPool = [...allOptions];
    const next = new Set(draftSelected);

    for (const token of tokens) {
      const canonical = resolveOptionToken(token, optionPool);
      const canonicalKey = canonical.trim().toLowerCase();
      const existsGlobally = optionPool.some(
        (option) => option.trim().toLowerCase() === canonicalKey,
      );

      if (!existsGlobally) {
        await onRegisterOption?.(canonical);
        optionPool.push(canonical);
      }

      for (const existing of next) {
        if (existing.trim().toLowerCase() === canonicalKey) {
          next.delete(existing);
        }
      }
      next.add(canonical);
    }

    setDraftSelected(next);
    setSearchTerm('');
  };

  const addNew = async () => {
    await addTokens(searchTerm);
  };

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
  const pendingTokens = useMemo(() => parseInputTokens(searchTerm), [searchTerm, inputTokenMode]);
  const filteredOptions = q
    ? allOptions.filter((o) => {
        if (inputTokenMode === 'hashtag' && pendingTokens.length > 1) {
          return pendingTokens.some(
            (token) =>
              o.toLowerCase().includes(token.toLowerCase()) ||
              token.toLowerCase().includes(o.toLowerCase()),
          );
        }
        return o.toLowerCase().includes(q);
      })
    : allOptions;
  const alreadyExists =
    pendingTokens.length > 0 &&
    pendingTokens.every((token) =>
      allOptions.some((option) => option.trim().toLowerCase() === token.trim().toLowerCase()),
    );
  const hasUnselectedPendingTokens = pendingTokens.some((token) => {
    const key = resolveOptionToken(token, allOptions).trim().toLowerCase();
    return !Array.from(draftSelected).some((selected) => selected.trim().toLowerCase() === key);
  });
  const showAddButton =
    pendingTokens.length > 0 &&
    (inputTokenMode === 'hashtag' ? hasUnselectedPendingTokens : !alreadyExists);
  const addButtonLabel =
    inputTokenMode === 'hashtag' && pendingTokens.length > 1
      ? `Add ${pendingTokens.length} hashtags`
      : `Add "${pendingTokens[0] ?? searchTerm.trim()}"`;

  useLayoutEffect(() => {
    popoverRef.current?.querySelector('input')?.focus();
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="flex max-h-[inherit] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_16px_48px_rgba(0,0,0,0.14)] animate-in fade-in zoom-in-95 duration-150 dark:shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={fieldLabel ? `Select ${fieldLabel}` : 'Select options'}
    >
      {fieldLabel ? (
        <div className="border-b border-border bg-muted/25 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {fieldLabel}
          </p>
        </div>
      ) : null}

      <div className="border-b border-border bg-muted/20 p-2.5">
        <div className="relative">
          <input
            autoFocus
            className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-xs font-medium outline-none transition-all focus:ring-2 focus:ring-primary/20"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void addNew();
              }
              if (e.key === 'Escape') onClose();
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

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5 cc-scroll">
        {showAddButton ? (
          <button
            type="button"
            className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-primary transition-colors hover:bg-muted"
            onClick={() => void addNew()}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded border-2 border-primary/30 group-hover:border-primary">
              <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </span>
            {addButtonLabel}
          </button>
        ) : null}

        {filteredOptions.map((opt) => {
          const isSelected = draftSelected.has(opt);
          const showDelete = allowDeleteOptions && !isSelected && onDeleteOption;

          return (
            <div
              key={opt}
              className={`flex items-center gap-1 rounded-lg transition-colors ${
                isSelected ? 'bg-primary/8 text-primary' : 'text-foreground/85 hover:bg-muted/80'
              }`}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-xs leading-snug"
                onClick={() => toggleItem(opt)}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all ${
                    isSelected ? 'border-primary bg-primary' : 'border-border'
                  }`}
                >
                  {isSelected ? (
                    <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </span>
                <span className={`break-words ${isSelected ? 'font-semibold' : 'font-medium'}`}>{opt}</span>
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

        {filteredOptions.length === 0 && !q && allOptions.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-[11px] font-medium text-muted-foreground/70">No options yet. Type to add one.</p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/15 px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {mode === 'single'
            ? draftSelected.size === 1
              ? '1 selected'
              : 'Select one'
            : `${draftSelected.size} selected`}
        </span>
        <div className="flex items-center gap-2">
          {allowClearSelection && mode === 'multi' && draftSelected.size > 0 ? (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[10px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
              onClick={() => setDraftSelected(new Set())}
            >
              Clear all
            </button>
          ) : null}
          <span className="text-[10px] text-muted-foreground/55">Click outside to save</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
