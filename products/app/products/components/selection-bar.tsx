'use client';

import * as React from 'react';

interface SelectionBarProps {
  selectedCount: number;
  onClear: () => void;
  onDownload: () => void;
  onShare: () => void;
  onToggleView: () => void;
  viewLabel: string;
  isViewActive: boolean;
  theme?: 'light' | 'dark';
}

export function SelectionBar({
  selectedCount,
  onClear,
  onDownload,
  onShare,
  onToggleView,
  viewLabel,
  isViewActive,
  theme = 'light',
}: SelectionBarProps) {
  if (selectedCount === 0) return null;

  const containerClasses = theme === 'dark'
    ? 'rounded-2xl border border-white/10 bg-black/35 p-2 shadow-lg backdrop-blur'
    : 'rounded-2xl border border-black/10 bg-white/80 p-2 text-black shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/35 dark:text-white';

  const innerClasses = theme === 'dark'
    ? 'rounded-2xl border border-white/10 bg-black/25 p-1'
    : 'rounded-2xl border border-black/10 bg-black/5 p-1 backdrop-blur dark:border-white/10 dark:bg-black/25';

  const btnBase = theme === 'dark'
    ? 'h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/10 text-[11px] font-medium tracking-wide text-white/90 hover:bg-white/10'
    : 'h-11 w-full min-w-0 rounded-xl border border-black/10 bg-white/70 px-2 text-[11px] font-medium tracking-wide text-black/80 hover:bg-white dark:border-white/15 dark:bg-black/10 dark:text-white/90 dark:hover:bg-white/10';

  const activeBtn = isViewActive
    ? (theme === 'dark' 
        ? 'border-red-400/50 bg-transparent text-red-400' 
        : 'border-red-400/30 bg-transparent text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-500/10')
    : btnBase;

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between gap-3 px-2 pb-2">
        <div className={`text-xs font-medium ${theme === 'dark' ? 'text-white/70' : 'text-black/60 dark:text-white/70'}`}>
          Selected: {selectedCount}
        </div>
        <button
          type="button"
          onClick={onClear}
          className={`text-xs font-semibold hover:opacity-100 ${theme === 'dark' ? 'text-white/70' : 'text-black/60 dark:text-white/70'}`}
        >
          Clear
        </button>
      </div>

      <div className={innerClasses}>
        <div className="grid grid-cols-3 gap-1">
          <button type="button" onClick={onDownload} className={btnBase}>
            <span className="truncate">Download</span>
          </button>

          <button type="button" onClick={onShare} className={btnBase}>
            <span className="truncate">Share</span>
          </button>

          <button
            type="button"
            onClick={onToggleView}
            className={isViewActive ? activeBtn : btnBase}
          >
            <span className="truncate">{viewLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
