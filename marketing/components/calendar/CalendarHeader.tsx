'use client';

import React from 'react';

import {
  InsightsExpandableSection,
  InsightsHeaderToggle,
  type InsightsPanelSummary,
} from './CollapsibleInsightsPanel';

interface CalendarHeaderProps {
  onNew: () => void;
  onHome: () => void;
  onToggleAccount: () => void;
  username: string;
  isSaving: boolean;
  onLogout: () => void;
  accountOpen: boolean;
  onCloseAccount: () => void;
  insightsExpanded: boolean;
  onToggleInsights: () => void;
  insightsSummary: InsightsPanelSummary;
  insightsContent: React.ReactNode;
}

export function CalendarHeader({
  onNew,
  onHome,
  onToggleAccount,
  username,
  isSaving,
  onLogout,
  accountOpen,
  onCloseAccount,
  insightsExpanded,
  onToggleInsights,
  insightsSummary,
  insightsContent,
}: CalendarHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto w-full max-w-[1700px] px-3 sm:px-4 md:px-6">
        {/* Toolbar */}
        <div className="flex items-center gap-2 py-2 sm:gap-3 sm:py-2.5">
          {/* Brand */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="inline-flex h-5 shrink-0 items-center rounded-md border border-border bg-secondary px-2 text-[9px] font-bold uppercase tracking-wider text-secondary-foreground sm:h-6 sm:rounded-full sm:px-2.5 sm:text-[10px]">
                Ops
              </span>
              <h1 className="truncate text-sm font-bold tracking-tight text-foreground sm:text-base md:text-lg">
                <span className="md:hidden">Content Calendar</span>
                <span className="hidden md:inline">Professional Content Calendar</span>
              </h1>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <InsightsHeaderToggle
              expanded={insightsExpanded}
              onToggle={onToggleInsights}
              summary={insightsSummary}
            />

            <button
              type="button"
              onClick={onNew}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary p-2 text-primary-foreground shadow-md shadow-primary/15 transition-all hover:opacity-90 disabled:opacity-50 sm:px-3.5 sm:py-2"
              title="New content"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden text-sm font-bold lg:inline">{isSaving ? 'Creating…' : 'New'}</span>
            </button>

            <button
              type="button"
              onClick={onHome}
              className="rounded-xl border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title="Home"
            >
              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={onToggleAccount}
                className="flex items-center rounded-xl border border-border bg-card p-1 transition-all hover:bg-accent sm:gap-1.5 sm:pr-2.5"
                title={username || 'Account'}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground sm:h-8 sm:w-8">
                  {username?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="hidden max-w-[5rem] truncate text-xs font-bold text-muted-foreground xl:inline">
                  {username || 'Account'}
                </span>
              </button>

              {accountOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={onCloseAccount} aria-hidden />
                  <div className="absolute right-0 top-full z-50 mt-2 w-52 animate-in zoom-in-95 rounded-2xl border border-border bg-popover p-2 shadow-2xl duration-200">
                    <button
                      type="button"
                      onClick={onLogout}
                      className="w-full rounded-xl px-4 py-2.5 text-left text-sm font-bold text-destructive transition-colors hover:bg-destructive/10"
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Expandable insights — part of sticky header */}
        <InsightsExpandableSection expanded={insightsExpanded}>
          {insightsContent}
        </InsightsExpandableSection>
      </div>
    </header>
  );
}
