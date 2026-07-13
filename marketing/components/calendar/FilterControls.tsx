'use client';

import React from 'react';

interface FilterControlsProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  statusOptions: string[];
  filteredCount: number;
  totalCount: number;
}

export function FilterControls({
  searchTerm,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  statusOptions,
  filteredCount,
}: FilterControlsProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card/40 p-4 rounded-2xl border border-border backdrop-blur-sm">
      <div className="flex flex-1 items-center gap-3">
        <div className="relative flex-1 max-w-md group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search campaign, title, or platform..."
            className="w-full rounded-xl border border-input bg-background/80 py-2.5 pl-10 pr-4 text-sm outline-none ring-primary/20 transition-all focus:border-primary focus:ring-4"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          <button
            onClick={() => onStatusChange('all')}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              selectedStatus === 'all'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/10'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            All
          </button>
          {statusOptions.map((status) => (
            <button
              key={status}
              onClick={() => onStatusChange(status)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                selectedStatus === status
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 px-2">
        <div className="h-8 w-px bg-border hidden md:block" />
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Results</span>
          <span className="text-sm font-bold text-foreground transition-all tabular-nums">
            {filteredCount} items
          </span>
        </div>
      </div>
    </div>
  );
}
