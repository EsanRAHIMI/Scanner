'use client';

import React, { useState, useRef, useEffect } from 'react';

interface CreatableSelectProps {
  value: string;
  options: string[];
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  onBlur?: () => void;
}

export function CreatableSelect({
  value,
  options,
  placeholder,
  autoFocus,
  className = "w-full text-sm outline-none rounded-lg border border-border bg-background px-3 py-1.5 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40",
  onChange,
  onCommit,
  onBlur,
}: CreatableSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        if (open) {
          setOpen(false);
          // If we click outside, commit current value
          onCommit?.(value);
        } else {
          onBlur?.();
        }
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, value, onCommit, onBlur]);

  const q = value.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  const exists = options.some((o) => o.toLowerCase() === q);

  return (
    <div ref={rootRef} className="relative w-full">
      <input
        autoFocus={autoFocus}
        className={className}
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onBlur?.();
            setOpen(false);
          }
          if (e.key === 'Enter') {
            onCommit?.(value);
            setOpen(false);
          }
          if (e.key === 'Tab') {
            onCommit?.(value);
            setOpen(false);
          }
        }}
      />

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 max-h-64 overflow-auto rounded-xl border border-border bg-popover/95 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          {!exists && q && (
            <button
              className="w-full px-4 py-2.5 text-left text-sm font-bold hover:bg-muted flex items-center gap-2 transition-colors text-primary"
              onClick={() => {
                onCommit?.(value);
                setOpen(false);
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add "{value}"
            </button>
          )}
          {filtered.map((opt) => (
            <button
              key={opt}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors ${opt === value ? 'bg-primary/10 font-bold text-primary' : 'text-foreground/80'}`}
              onClick={() => {
                onCommit?.(opt);
                setOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
          {filtered.length === 0 && !q && (
            <div className="px-4 py-3 text-xs text-muted-foreground/60 italic font-medium text-center">Start typing to search or add...</div>
          )}
        </div>
      )}
    </div>
  );
}
