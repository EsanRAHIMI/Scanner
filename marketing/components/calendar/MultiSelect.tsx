'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';

interface MultiSelectProps {
  value: string; // Comma or newline separated string
  options: string[];
  placeholder?: string;
  className?: string;
  onCommit: (value: string) => void;
  onClose: () => void;
}

export function MultiSelect({
  value,
  options,
  placeholder = "Search or add...",
  onCommit,
  onClose,
}: MultiSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Parse current values
  const selectedItems = useMemo(() => {
    if (!value) return new Set<string>();
    return new Set(value.split(/[,\n;]+/).map(s => s.trim()).filter(Boolean));
  }, [value]);

  const [draftSelected, setDraftSelected] = useState<Set<string>>(new Set(selectedItems));

  const getCurrentValue = () => Array.from(draftSelected).join(', ');

  // Handle Click Outside -> SAVE AND CLOSE
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
    const next = new Set(draftSelected);
    if (next.has(item)) {
      next.delete(item);
    } else {
      next.add(item);
    }
    setDraftSelected(next);
  };

  const addNew = () => {
    const clean = searchTerm.trim();
    if (!clean) {
      // If empty enter, just commit what we have
      onCommit(getCurrentValue());
      return;
    }
    const next = new Set(draftSelected);
    next.add(clean);
    setDraftSelected(next);
    setSearchTerm('');
  };

  const q = searchTerm.trim().toLowerCase();
  const filteredOptions = q ? options.filter(o => o.toLowerCase().includes(q)) : options;
  const alreadyExists = options.some(o => o.toLowerCase() === q);

  return (
    <div 
      ref={rootRef}
      className="absolute top-0 left-0 z-[100] w-64 rounded-2xl border border-border bg-popover/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
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
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-primary hover:bg-muted rounded-lg transition-colors group"
            onClick={addNew}
          >
            <div className="w-4 h-4 rounded border-2 border-primary/30 flex items-center justify-center group-hover:border-primary">
              <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            Add "{searchTerm}"
          </button>
        )}

        {filteredOptions.map((opt) => (
          <button
            key={opt}
            className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg transition-colors ${draftSelected.has(opt) ? 'bg-primary/5 text-primary' : 'hover:bg-muted text-foreground/80'}`}
            onClick={() => toggleItem(opt)}
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${draftSelected.has(opt) ? 'bg-primary border-primary' : 'border-border'}`}>
              {draftSelected.has(opt) && (
                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={draftSelected.has(opt) ? 'font-bold' : ''}>{opt}</span>
          </button>
        ))}

        {filteredOptions.length === 0 && !q && options.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-[10px] text-muted-foreground/60 font-medium">No audiences found. Type to add your first!</p>
          </div>
        )}
      </div>

      <div className="px-3 py-2 bg-muted/10 flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {draftSelected.size} Selected
        </span>
        <span className="text-[10px] text-muted-foreground/50">
          Click outside to save
        </span>
      </div>
    </div>
  );
}
