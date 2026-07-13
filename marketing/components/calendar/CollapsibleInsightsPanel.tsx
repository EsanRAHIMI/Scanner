'use client';

import React from 'react';

export type InsightsPanelSummary = {
  totalCount: number;
  filteredCount: number;
  selectedStatus: string;
  hasSearch: boolean;
  published: number;
  scheduled: number;
};

function statusLabel(selectedStatus: string): string {
  if (selectedStatus === 'all') return 'All';
  return selectedStatus;
}

function hasActiveFilter(summary: InsightsPanelSummary): boolean {
  return (
    summary.hasSearch ||
    summary.selectedStatus !== 'all' ||
    summary.filteredCount < summary.totalCount
  );
}

/** Compact toggle — lives in CalendarHeader toolbar. */
export function InsightsHeaderToggle({
  expanded,
  onToggle,
  summary,
}: {
  expanded: boolean;
  onToggle: () => void;
  summary: InsightsPanelSummary;
}) {
  const filtered = hasActiveFilter(summary);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls="calendar-insights-panel"
      title={expanded ? 'Collapse insights & filters' : 'Expand insights & filters'}
      className={`group relative inline-flex max-w-[min(100%,14rem)] items-center gap-1.5 rounded-xl border px-2 py-1.5 text-left transition-all duration-300 sm:max-w-none sm:gap-2 sm:px-2.5 sm:py-2 ${
        expanded
          ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
          : 'border-border bg-card text-foreground hover:border-primary/25 hover:bg-muted/80'
      }`}
    >
      <span
        className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg transition-colors sm:h-8 sm:w-8 ${
          expanded ? 'bg-primary/20' : 'bg-primary/10 text-primary'
        }`}
      >
        <ChartIcon />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className="truncate text-[11px] font-bold leading-none sm:text-xs">
            <span className="hidden sm:inline">Insights &amp; filters</span>
            <span className="sm:hidden">Insights</span>
          </span>
          {filtered ? (
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-primary animate-pulse" aria-hidden />
          ) : null}
        </span>
        <span className="mt-0.5 hidden items-center gap-1 text-[10px] font-semibold text-muted-foreground sm:flex">
          <span className="tabular-nums text-foreground">{summary.filteredCount}</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="tabular-nums">{summary.totalCount}</span>
          <span className="mx-0.5 text-muted-foreground/40">·</span>
          <span className="max-w-[5rem] truncate">{statusLabel(summary.selectedStatus)}</span>
        </span>
        <span className="mt-0.5 tabular-nums text-[10px] font-bold text-muted-foreground sm:hidden">
          {summary.filteredCount}
          <span className="font-normal text-muted-foreground/50">/{summary.totalCount}</span>
        </span>
      </span>

      <span
        className={`flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border/60 bg-background/80 text-muted-foreground transition-transform duration-300 group-hover:text-foreground sm:h-7 sm:w-7 ${
          expanded ? 'rotate-180 border-primary/20 text-primary' : ''
        }`}
      >
        <ChevronIcon />
      </span>
    </button>
  );
}

/** Expandable stats/filters — rendered inside sticky header, below toolbar. */
export function InsightsExpandableSection({
  expanded,
  children,
}: {
  expanded: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`grid border-t border-border/60 transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none ${
        expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          id="calendar-insights-panel"
          className={`px-0 pb-4 pt-3 transition-opacity duration-300 motion-reduce:transition-none md:pb-5 md:pt-4 ${
            expanded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex flex-col gap-4 md:gap-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}
