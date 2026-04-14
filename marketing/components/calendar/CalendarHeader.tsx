'use client';

import React from 'react';

interface CalendarHeaderProps {
  onNew: () => void;
  onHome: () => void;
  onToggleAccount: () => void;
  username: string;
  isSaving: boolean;
  onLogout: () => void;
  accountOpen: boolean;
  onCloseAccount: () => void;
  totalCount: number;
  filteredCount: number;
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
  totalCount,
  filteredCount,
}: CalendarHeaderProps) {
  const hasActiveFilter = filteredCount < totalCount;

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md md:px-6">
      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-full border border-border bg-secondary px-2.5 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">
              Content Ops
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">AI Marketing</span>
          </div>

          <h1 className="mt-1.5 text-xl font-bold tracking-tight text-foreground">Professional Content Calendar</h1>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center rounded-lg border border-border bg-card px-2.5 py-1 font-semibold text-muted-foreground">
              {totalCount} total items
            </span>
            <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 font-semibold ${hasActiveFilter ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'}`}>
              {hasActiveFilter ? `${filteredCount} visible` : 'No active filter'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={onNew}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            {isSaving ? 'Creating...' : 'New Content'}
          </button>

          <button
            onClick={onHome}
            className="rounded-xl border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            title="Home"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>

          <div className="relative">
            <button
              onClick={onToggleAccount}
              className="flex items-center gap-2 rounded-xl border border-border bg-card p-1.5 pr-3 transition-all hover:bg-accent"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                {username?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-bold text-muted-foreground">{username || 'Account'}</span>
            </button>

            {accountOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={onCloseAccount} />
                <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-in zoom-in-95 rounded-2xl border border-border bg-popover p-2 shadow-2xl duration-200">
                  <button
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
    </div>
  );
}
