'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import type { FieldChangeAuditApi, FieldChangeEntry } from '../hooks/use-field-change-audit';

const CHANGE_TYPE_LABELS: Record<string, string> = {
  update: 'Edited',
  add: 'Added',
  clear: 'Cleared',
  unchanged: 'Unchanged',
  unknown: 'Changed',
};

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function truncateValue(value: string, max = 80): string {
  const trimmed = value.trim();
  if (!trimmed) return '—';
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function FieldChangePopover({
  entries,
  anchorRect,
  onClose,
}: {
  entries: FieldChangeEntry[];
  anchorRect: DOMRect;
  onClose: () => void;
}) {
  const popoverRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        onClose();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const width = 320;
  const left = Math.min(Math.max(12, anchorRect.right + 8), viewportW - width - 12);
  const top = Math.min(Math.max(12, anchorRect.top), viewportH - 360);

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[200] w-[320px] overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-2xl shadow-amber-500/10 ring-1 ring-amber-400/20 dark:border-amber-500/30 dark:bg-zinc-950 dark:shadow-black/40 dark:ring-amber-400/15"
      style={{ left, top }}
      role="dialog"
      aria-label="Cell change history"
    >
      <div className="border-b border-amber-100 bg-gradient-to-l from-amber-50 to-white px-3.5 py-2.5 dark:border-amber-500/20 dark:from-amber-500/10 dark:to-zinc-950">
        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Change history
        </p>
        <p className="mt-0.5 text-[10px] text-black/50 dark:text-white/45">
          {entries.length} recorded {entries.length === 1 ? 'event' : 'events'}
        </p>
      </div>
      <div className="max-h-[280px] overflow-y-auto overscroll-contain p-2 scrollbar-minimal">
        {entries.map((entry, index) => {
          const typeLabel = CHANGE_TYPE_LABELS[entry.change_type] ?? CHANGE_TYPE_LABELS.unknown;
          const showValues = Boolean(entry.old_value || entry.new_value);
          return (
            <div
              key={`${entry.id}-${index}`}
              className="mb-2 last:mb-0 rounded-xl border border-black/[0.06] bg-amber-50/40 p-3 dark:border-white/[0.06] dark:bg-amber-500/[0.06]"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-black dark:text-white">{entry.username}</p>
                <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  {typeLabel}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-black/45 dark:text-white/40">
                {formatTimestamp(entry.timestamp)}
              </p>
              {showValues ? (
                <div className="mt-2 space-y-1.5 text-[10px] leading-snug">
                  {entry.old_value ? (
                    <p className="text-black/55 dark:text-white/50">
                      <span className="font-semibold text-black/70 dark:text-white/65">Before: </span>
                      <span className="break-all">{truncateValue(entry.old_value)}</span>
                    </p>
                  ) : null}
                  {entry.new_value ? (
                    <p className="text-emerald-800/90 dark:text-emerald-300/90">
                      <span className="font-semibold">After: </span>
                      <span className="break-all">{truncateValue(entry.new_value)}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

export function FieldChangeIndicator({
  entries,
  children,
}: {
  entries: FieldChangeEntry[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);
  const badgeRef = React.useRef<HTMLButtonElement | null>(null);

  const openPopover = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const rect = badgeRef.current?.getBoundingClientRect();
    if (rect) {
      setAnchorRect(rect);
      setOpen(true);
    }
  }, []);

  return (
    <>
      {children}
      <button
        ref={badgeRef}
        type="button"
        onClick={openPopover}
        onPointerDown={(event) => event.stopPropagation()}
        className="absolute right-1 top-1 z-20 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-amber-400 text-[11px] font-black leading-none text-amber-950 shadow-md shadow-amber-500/30 ring-2 ring-white transition hover:scale-110 hover:bg-amber-300 dark:ring-zinc-900"
        title="View change history for this cell"
        aria-label="Change history"
        aria-expanded={open}
      >
        !
      </button>
      {open && anchorRect ? (
        <FieldChangePopover entries={entries} anchorRect={anchorRect} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

export function CellChangeAudit({
  enabled,
  recordId,
  fieldName,
  changeAudit,
  children,
}: {
  enabled: boolean;
  recordId: string;
  fieldName: string;
  changeAudit?: FieldChangeAuditApi;
  children: React.ReactNode;
}) {
  if (!enabled || !changeAudit) return <>{children}</>;

  const entries = changeAudit.getEntries(recordId, fieldName);
  if (entries.length === 0) return <>{children}</>;

  return <FieldChangeIndicator entries={entries}>{children}</FieldChangeIndicator>;
}
