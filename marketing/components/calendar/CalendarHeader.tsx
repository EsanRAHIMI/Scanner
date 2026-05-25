'use client';

import React from 'react';

import { ScannerAccountMenu } from '@/lib/scanner-account-menu';

import {
  InsightsExpandableSection,
  InsightsHeaderToggle,
  type InsightsPanelSummary,
} from './CollapsibleInsightsPanel';
import { LiveHeaderClock } from './LiveHeaderClock';

interface CalendarHeaderProps {
  onNew: () => void;
  onOpenCampaigns: () => void;
  campaignCount?: number;
  onHome: () => void;
  isSaving: boolean;
  onAuthChange?: () => void;
  insightsExpanded: boolean;
  onToggleInsights: () => void;
  insightsSummary: InsightsPanelSummary;
  insightsContent: React.ReactNode;
}

export function CalendarHeader({
  onNew,
  onOpenCampaigns,
  campaignCount = 0,
  onHome,
  isSaving,
  onAuthChange,
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
              <h1 className="truncate text-sm font-bold tracking-tight text-foreground sm:text-base md:text-lg">
                <span className="md:hidden">Content Calendar</span>
                <span className="hidden md:inline">Professional Content Calendar</span>
              </h1>
            </div>
            <LiveHeaderClock />
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
              onClick={onOpenCampaigns}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card p-2 text-foreground transition-colors hover:bg-accent sm:px-3 sm:py-2"
              title="Manage campaigns"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="hidden text-sm font-bold lg:inline">Campaigns</span>
              {campaignCount > 0 && (
                <span className="hidden rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary lg:inline">
                  {campaignCount}
                </span>
              )}
            </button>

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

            <ScannerAccountMenu
              app="marketing"
              authApiPrefix="/api/trainer"
              serviceUrlsPath="/api/service-urls"
              onAuthChange={onAuthChange}
            />
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
