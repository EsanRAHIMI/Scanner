'use client';

import React, { useEffect, useRef } from 'react';

import { DateCalendarPanel } from './DateCalendarPanel';

interface DatePickerProps {
  value: string; // ISO format yyyy-MM-dd
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  onClose: () => void;
}

export function DatePicker({ value, onChange, onCommit, onClose }: DatePickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') onCommit(value);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onCommit, value]);

  return (
    <div
      ref={rootRef}
      className="absolute left-0 top-full z-[100] mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <DateCalendarPanel
        value={value}
        onSelect={(iso) => {
          onChange(iso);
          onCommit(iso);
        }}
        onClose={onClose}
      />
    </div>
  );
}
