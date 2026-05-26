'use client';

import * as React from 'react';
import { FilterDropdown } from './filter-dropdown';

interface ProductFiltersProps {
  data: any;
  visibleCount: number;
  /** When GET /api/products/assets failed but SWR/session snapshot still renders rows */
  isStaleOfflineSnapshot?: boolean;
  uniqueCategories: string[];
  selectedCategories: Set<string>;
  setSelectedCategories: (val: Set<string>) => void;
  uniqueColors: string[];
  selectedColors: Set<string>;
  setSelectedColors: (val: Set<string>) => void;
  uniqueSpaces: string[];
  selectedSpaces: Set<string>;
  setSelectedSpaces: (val: Set<string>) => void;
  uniqueMaterials: string[];
  selectedMaterials: Set<string>;
  setSelectedMaterials: (val: Set<string>) => void;
  activeFilterDropdown: string | null;
  setActiveFilterDropdown: (val: string | null) => void;
  /** Admin: bulk-delete rows where only `Num` is filled. */
  onPurgeNumOnlyStubs?: () => void;
  purgeNumOnlyDisabled?: boolean;
  /** Change control mode: filter list rows by editor username. */
  moderationEditorFilter?: {
    usernames: string[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    matchingRowCount?: number;
  };
}

export function ProductFilters({
  data,
  visibleCount,
  isStaleOfflineSnapshot = false,
  uniqueCategories,
  selectedCategories,
  setSelectedCategories,
  uniqueColors,
  selectedColors,
  setSelectedColors,
  uniqueSpaces,
  selectedSpaces,
  setSelectedSpaces,
  uniqueMaterials,
  selectedMaterials,
  setSelectedMaterials,
  activeFilterDropdown,
  setActiveFilterDropdown,
  onPurgeNumOnlyStubs,
  purgeNumOnlyDisabled,
  moderationEditorFilter,
}: ProductFiltersProps) {
  const hasActiveFilters =
    selectedCategories.size > 0 ||
    selectedColors.size > 0 ||
    selectedSpaces.size > 0 ||
    selectedMaterials.size > 0;

  const resetAll = () => {
    setSelectedCategories(new Set());
    setSelectedColors(new Set());
    setSelectedSpaces(new Set());
    setSelectedMaterials(new Set());
  };

  const filterControls = (
    <>
      <FilterDropdown
        id="category"
        title="Category"
        options={uniqueCategories}
        selected={selectedCategories}
        activeDropdown={activeFilterDropdown}
        setActiveDropdown={setActiveFilterDropdown}
        onChange={setSelectedCategories}
      />
      <FilterDropdown
        id="color"
        title="Color"
        options={uniqueColors}
        selected={selectedColors}
        activeDropdown={activeFilterDropdown}
        setActiveDropdown={setActiveFilterDropdown}
        onChange={setSelectedColors}
      />
      <FilterDropdown
        id="space"
        title="Space"
        options={uniqueSpaces}
        selected={selectedSpaces}
        activeDropdown={activeFilterDropdown}
        setActiveDropdown={setActiveFilterDropdown}
        onChange={setSelectedSpaces}
      />
      <FilterDropdown
        id="material"
        title="Material"
        options={uniqueMaterials}
        selected={selectedMaterials}
        activeDropdown={activeFilterDropdown}
        setActiveDropdown={setActiveFilterDropdown}
        onChange={setSelectedMaterials}
      />
    </>
  );

  return (
    <div className="-mx-5 px-5">
      <div className="mt-1 flex flex-col gap-2 text-[11px] leading-tight text-black/50 dark:text-white/45 sm:block">
        {/* Variant / List — inline on desktop via sm:contents */}
        <div className="sm:contents">
          <span className="font-medium text-black/60 dark:text-white/60">Variant:</span>{' '}
          {data ? (
            <span className="animate-fade-in tabular-nums">
              {isStaleOfflineSnapshot && (
                <>
                  <span
                    title="Totals reflect cached browser data until the server catalog succeeds again."
                    className="text-amber-800 dark:text-amber-200/90"
                  >
                    Cached snapshot
                  </span>
                  {' · '}
                </>
              )}
              {isStaleOfflineSnapshot && Array.isArray(data.records) ? data.records.length : data.count}
            </span>
          ) : (
            <span className="inline-block h-3 w-8 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          )}
          <span className="mx-2 text-black/25 dark:text-white/20">|</span>
          <span className="font-medium text-black/60 dark:text-white/60">List:</span>{' '}
          {data ? (
            <span className="animate-fade-in tabular-nums">
              {visibleCount}
              {isStaleOfflineSnapshot ? (
                <span
                  title="Filtered count applies only to the cached snapshot loaded in this browser."
                  className="text-amber-800/85 dark:text-amber-200/80"
                >
                  {' · filtered from snapshot'}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="inline-block h-3 w-8 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          )}
          {onPurgeNumOnlyStubs ? (
            <span className="hidden sm:contents">
              <span className="mx-2 text-black/25 dark:text-white/20">|</span>
              <button
                type="button"
                disabled={purgeNumOnlyDisabled}
                onClick={onPurgeNumOnlyStubs}
                title="Bulk-delete rows where only Num is filled"
                className="rounded px-0.5 text-[11px] font-medium text-black/40 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-white/38 dark:hover:text-red-400"
              >
                Delete Num-only
              </button>
            </span>
          ) : null}
        </div>

        <span className="hidden sm:inline mx-2 text-black/25 dark:text-white/20">|</span>

        {/* Filters — mobile grid; desktop inline in same row as Variant/List */}
        <div className="inline-flex flex-col gap-2 sm:inline-flex sm:flex-row sm:items-center sm:gap-2">
          <div className="grid w-full grid-cols-4 gap-1 sm:contents">
            {filterControls}
          </div>

          {moderationEditorFilter ? (
            <label className="flex w-full min-w-0 items-center gap-1.5 rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-2 text-[10px] font-semibold text-amber-900 sm:inline-flex sm:w-auto sm:rounded-full sm:border-amber-400/35 sm:py-1 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-100">
              <span className="shrink-0 uppercase tracking-wide opacity-80">Editor</span>
              <select
                value={moderationEditorFilter.value}
                disabled={moderationEditorFilter.disabled}
                onChange={(event) => moderationEditorFilter.onChange(event.target.value)}
                className="min-w-0 flex-1 cursor-pointer bg-transparent text-[10px] font-bold outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-[9rem] sm:flex-none"
                aria-label="Filter rows by editor"
              >
                <option value="">All editors</option>
                {moderationEditorFilter.usernames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {moderationEditorFilter.value ? (
                <span className="shrink-0 tabular-nums text-amber-800/80 dark:text-amber-200/80">
                  ({moderationEditorFilter.matchingRowCount ?? 0})
                </span>
              ) : null}
            </label>
          ) : null}

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetAll}
              className="h-9 w-full rounded-lg border border-red-500/20 bg-red-500/8 text-[11px] font-bold uppercase tracking-wide text-red-600 transition-colors hover:bg-red-500/12 sm:ml-1 sm:h-auto sm:w-auto sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-[10px] sm:font-bold sm:normal-case sm:tracking-normal sm:hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
            >
              <span className="sm:hidden">Reset all filters</span>
              <span className="hidden sm:inline">Reset All</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
