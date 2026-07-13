'use client';

import * as React from 'react';

export interface ProductsHeaderSearchProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  hasActiveFilters: boolean;
  onClearSearch: () => void;
  onClearAllFilters: () => void;
}

export function ProductsHeaderSearch({
  search,
  onSearchChange,
  searchInputRef,
  hasActiveFilters,
  onClearSearch,
  onClearAllFilters,
}: ProductsHeaderSearchProps) {
  const hasSearch = search.trim().length > 0;
  const showClearAll = hasActiveFilters;
  const showClearSearchOnly = hasSearch && !showClearAll;

  return (
    <div
      className={
        'flex h-9 w-full min-w-0 flex-1 items-center rounded-full border border-black/10 bg-white/55 px-2 shadow-sm backdrop-blur-md ' +
        'transition-shadow focus-within:border-emerald-500/30 focus-within:ring-1 focus-within:ring-emerald-500/25 ' +
        'dark:border-white/10 dark:bg-black/40 sm:h-10 sm:px-2.5'
      }
    >
      <label className="sr-only" htmlFor="products-header-search">
        Search products
      </label>

      <span
        className={
          'pointer-events-none hidden h-8 w-7 shrink-0 items-center justify-center sm:flex ' +
          (hasSearch ? 'text-emerald-600 dark:text-emerald-400' : 'text-black/40 dark:text-white/40')
        }
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
      </span>

      <input
        id="products-header-search"
        ref={searchInputRef}
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            if (showClearAll) onClearAllFilters();
            else if (hasSearch) onClearSearch();
          }
        }}
        placeholder="Search…"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        className={
          'min-w-0 flex-1 bg-transparent text-[15px] leading-none text-black outline-none ' +
          'placeholder:text-black/45 sm:text-sm dark:text-white dark:placeholder:text-white/45 ' +
          '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden'
        }
      />

      {showClearAll ? (
        <button
          type="button"
          onClick={onClearAllFilters}
          title="Clear search and filters"
          aria-label="Clear search and filters"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-600 transition-colors hover:bg-red-500/10 active:scale-95 dark:text-red-400"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : showClearSearchOnly ? (
        <button
          type="button"
          onClick={onClearSearch}
          title="Clear search"
          aria-label="Clear search"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-black/45 transition-colors hover:bg-black/[0.06] active:scale-95 dark:text-white/45 dark:hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}

      <kbd
        className="ml-0.5 hidden shrink-0 rounded border border-black/10 bg-black/[0.04] px-1 py-0.5 font-mono text-[9px] font-semibold text-black/40 dark:border-white/15 dark:bg-white/10 dark:text-white/40 md:inline"
        aria-hidden
      >
        ⌘K
      </kbd>
    </div>
  );
}
