'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { DateCalendarPanel } from './DateCalendarPanel';
import { useFloatingPopoverPosition } from './use-floating-popover-position';

interface DatePickerProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  value: string;
  fieldLabel?: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  onClose: () => void;
}

const DATE_POPOVER_WIDTH_PX = 288;

export function DatePicker({
  anchorRef,
  value,
  fieldLabel,
  onChange,
  onCommit,
  onClose,
}: DatePickerProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  const popoverStyle = useFloatingPopoverPosition(anchorRef, popoverRef, mounted, {
    width: DATE_POPOVER_WIDTH_PX,
    maxHeight: 420,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [onClose, anchorRef]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') onCommit(value);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onCommit, value]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="flex max-h-[inherit] flex-col overflow-y-auto rounded-xl border border-border bg-popover shadow-[0_16px_48px_rgba(0,0,0,0.14)] animate-in fade-in zoom-in-95 duration-150 dark:shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={fieldLabel ? `Select ${fieldLabel}` : 'Select date'}
    >
      {fieldLabel ? (
        <div className="border-b border-border bg-muted/25 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {fieldLabel}
          </p>
        </div>
      ) : null}
      <DateCalendarPanel
        value={value}
        onSelect={(iso) => {
          onChange(iso);
          onCommit(iso);
        }}
        onClose={onClose}
      />
    </div>,
    document.body,
  );
}
