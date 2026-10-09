'use client';

import React from 'react';

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
  isSaving: boolean;
  insightsExpanded: boolean;
  onToggleInsights: () => void;
  insightsSummary: InsightsPanelSummary;
  insightsContent: React.ReactNode;
}

export function CalendarHeader({
  onNew,
  onOpenCampaigns,
  campaignCount = 0,
  isSaving,
  insightsExpanded,
  onToggleInsights,
  insightsSummary,
  insightsContent,
}: CalendarHeaderProps) {
  return (
    <header className="z-30 shrink-0 border-b border-brand-medium-gray/30 bg-brand-white">
      <div className="mx-auto w-full max-w-[1700px] px-3 sm:px-4 md:px-6">
        <div className="flex items-center gap-2 py-2.5 sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="dash-eyebrow">Content calendar</p>
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
              className="btn-outline gap-1.5 rounded-xl p-2 sm:px-3 sm:py-2"
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
              className="btn-primary gap-1.5 rounded-xl p-2 shadow-md shadow-brand-burgundy/15 sm:px-3.5 sm:py-2"
              title="New content"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden text-sm font-bold lg:inline">{isSaving ? 'Creating…' : 'New'}</span>
            </button>

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
