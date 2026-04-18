'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { formatScalar, extractUrls, getDriveDirectLink, highlightMatches } from '../lib/product-utils';
import type { ProductsRecord } from '@/types/trainer';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  search: string;
  setSearch: (val: string) => void;
  paletteIndex: number;
  setPaletteIndex: (fn: (prev: number) => number) => void;
  recentSearches: string[];
  addToRecent: (val: string) => void;
  filteredRecords: ProductsRecord[];
  sortedRecords: ProductsRecord[];
  setPreviewId: (id: string | null) => void;
  setPreviewIndex: (idx: number | null) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  search,
  setSearch,
  paletteIndex,
  setPaletteIndex,
  recentSearches,
  addToRecent,
  filteredRecords,
  sortedRecords,
  setPreviewId,
  setPreviewIndex,
}: CommandPaletteProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[5000] flex items-start justify-center bg-zinc-950/80 p-4 pt-[15vh] backdrop-blur-sm sm:p-6 sm:pt-[20vh]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/90 shadow-2xl ring-1 ring-white/5 animate-fade-in-up">
        <div className="flex items-center gap-4 border-b border-white/10 bg-white/[0.03] px-5 py-4">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="h-8 flex-1 bg-transparent text-lg font-medium text-white placeholder-zinc-500 outline-none"
            placeholder="Type anything to search..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPaletteIndex(() => 0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setPaletteIndex(prev => Math.min(prev + 1, Math.min(filteredRecords.length, 10) - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setPaletteIndex(prev => Math.max(prev - 1, 0));
              } else if (e.key === 'Enter') {
                const r = filteredRecords[paletteIndex];
                if (r) {
                  addToRecent(search);
                  const idx = sortedRecords.findIndex(sr => sr.id === r.id);
                  if (idx >= 0) {
                    setPreviewId(r.id);
                    setPreviewIndex(idx);
                  }
                  onClose();
                }
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
          <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-zinc-400">
            <kbd>ESC</kbd>
          </div>
        </div>

        <div className="scrollbar-minimal max-h-[60vh] overflow-y-auto p-2">
          {!search && recentSearches.length > 0 && (
            <div className="mb-4 animate-fade-in">
              <h3 className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Recent Searches</h3>
              <div className="space-y-1">
                {recentSearches.map((rs, i) => (
                  <button
                    key={i}
                    onClick={() => { setSearch(rs); addToRecent(rs); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 active:bg-white/10 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 opacity-30" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20v-8m0 0V4m0 8h8m-8 0H4" strokeLinecap="round" /></svg>
                    {rs}
                  </button>
                ))}
              </div>
            </div>
          )}

          {search && (
            <div>
              <h3 className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-500">Results</h3>
              <div className="space-y-2">
                {filteredRecords.slice(0, 10).map((r, idx) => {
                  const name = formatScalar(r.fields?.['Colecction Name']) || formatScalar(r.fields?.Name) || 'Unknown Product';
                  const code = formatScalar(r.fields?.['Colecction Code']) || formatScalar(r.fields?.Code) || 'No Code';
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        addToRecent(search);
                        const idx = sortedRecords.findIndex(sr => sr.id === r.id);
                        if (idx >= 0) {
                          setPreviewId(r.id);
                          setPreviewIndex(idx);
                        }
                        onClose();
                      }}
                      className={`flex w-full items-center gap-4 rounded-xl border p-3 transition-all text-left group ${
                        idx === paletteIndex 
                          ? 'border-emerald-500/50 bg-emerald-500/10 dark:bg-emerald-500/20' 
                          : 'border-white/5 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="h-12 w-12 flex-none overflow-hidden rounded-lg bg-black/20 ring-1 ring-white/10">
                         {(() => {
                           const raw = extractUrls(r.fields?.URL)[0] || extractUrls(r.fields?.Image)[0];
                           if (!raw) return <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-[8px] font-bold text-zinc-600 uppercase tracking-tighter text-center px-1">No Image</div>;
                           return (
                             /* eslint-disable-next-line @next/next/no-img-element */
                             <img 
                               src={getDriveDirectLink(raw)} 
                               alt="" 
                               className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" 
                             />
                           );
                         })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{highlightMatches(name, search)}</div>
                        <div className="text-[10px] font-semibold text-zinc-500 mt-0.5 tracking-tight uppercase">{highlightMatches(code, search)}</div>
                      </div>
                      <svg viewBox="0 0 24 24" className="h-5 w-5 text-zinc-600 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  );
                })}
                {filteredRecords.length === 0 && (
                  <div className="py-12 text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-600 mb-3">
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                    </div>
                    <p className="text-sm font-medium text-zinc-400">No products found for "{search}"</p>
                    <button onClick={() => setSearch('')} className="mt-2 text-[10px] font-bold uppercase tracking-widest text-emerald-500 hover:text-emerald-400">Clear Search</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between border-t border-white/10 bg-black/20 px-4 py-2 text-[10px] font-semibold text-zinc-500 tracking-wider">
           <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-white/10 ring-1 ring-white/10 text-[9px]">↵</kbd> SELECT</span>
              <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-white/10 ring-1 ring-white/10 text-[9px]">↑↓</kbd> NAVIGATE</span>
           </div>
           <span>{filteredRecords.length} Results</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
