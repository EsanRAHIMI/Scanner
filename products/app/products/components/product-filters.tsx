'use client';

import * as React from 'react';
import { FilterDropdown } from './filter-dropdown';

interface ProductFiltersProps {
  data: any;
  visibleCount: number;
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
}

export function ProductFilters({
  data,
  visibleCount,
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

  return (
    <div className="-mx-5 px-5">
      <div className="mt-1 text-[11px] leading-tight text-black/50 dark:text-white/45">
        <span className="font-medium text-black/60 dark:text-white/60">Variant:</span>{' '}
        {data ? (
          <span className="animate-fade-in">{data.count}</span>
        ) : (
          <span className="inline-block h-3 w-8 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        )}
        <span className="mx-2 text-black/25 dark:text-white/20">|</span>
        <span className="font-medium text-black/60 dark:text-white/60">List:</span>{' '}
        {data ? (
          <span className="animate-fade-in">{visibleCount}</span>
        ) : (
          <span className="inline-block h-3 w-8 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        )}
        
        <span className="mx-2 text-black/25 dark:text-white/20">|</span>
        <div className="inline-flex items-center gap-2">
          <div className="inline-flex items-center gap-2">
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
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAll}
              className="ml-1 text-[10px] font-bold text-red-500 hover:text-red-600 dark:text-red-400"
            >
              Reset All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
