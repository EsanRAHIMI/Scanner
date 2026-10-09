'use client';

import React from 'react';

import {
  formatCampaignDaysRemaining,
  formatCampaignShortDate,
  getCampaignDaysRemaining,
  getCampaignEffectiveEnd,
} from '../../lib/calendar/campaigns/utils';
import type { MarketingCampaign } from '../../lib/calendar/campaigns/types';

interface CampaignRowTagProps {
  campaigns: MarketingCampaign[];
}

function CampaignMeta({ campaign }: { campaign: MarketingCampaign }) {
  const end = getCampaignEffectiveEnd(campaign);
  const daysRemaining = getCampaignDaysRemaining(campaign);
  const daysLabel =
    daysRemaining === null ? null : formatCampaignDaysRemaining(daysRemaining);

  return (
    <div className="max-w-full pl-2 text-[9px] leading-snug text-muted-foreground">
      <p className="tabular-nums">
        {formatCampaignShortDate(campaign.start_date)}
        <span className="mx-0.5 text-muted-foreground/40">–</span>
        {formatCampaignShortDate(end)}
      </p>
      {daysLabel ? (
        <p
          className={
            daysRemaining !== null && daysRemaining < 0
              ? 'font-bold tabular-nums text-destructive'
              : daysRemaining === 0
                ? 'font-semibold tabular-nums text-amber-600 dark:text-amber-500'
                : 'font-semibold tabular-nums text-foreground/70'
          }
        >
          {daysLabel}
        </p>
      ) : null}
    </div>
  );
}

export function CampaignRowTag({ campaigns }: CampaignRowTagProps) {
  if (campaigns.length === 0) {
    return <span className="block h-6" aria-hidden />;
  }

  const sorted = [...campaigns].sort(
    (a, b) => Number(b.is_critical) - Number(a.is_critical),
  );
  const visible = sorted.slice(0, 2);
  const overflow = sorted.length - visible.length;

  return (
    <div className="flex min-h-[1.5rem] flex-col gap-2 py-0.5">
      {visible.map((campaign) => {
        const end = getCampaignEffectiveEnd(campaign);
        const daysRemaining = getCampaignDaysRemaining(campaign);
        const daysLabel =
          daysRemaining === null ? '' : formatCampaignDaysRemaining(daysRemaining);

        return (
          <div key={campaign.id} className="group/tag max-w-full">
            <div
              className="relative flex max-w-full items-center"
              title={`${campaign.name}${campaign.is_critical ? ' · Critical' : ''} · ${campaign.start_date} → ${end}${daysLabel ? ` · ${daysLabel}` : ''}`}
            >
              <span
                className={`pointer-events-none absolute -inset-y-0.5 -left-1 w-1 rounded-full opacity-90 shadow-sm ${
                  campaign.is_critical ? 'ring-1 ring-rose-400/60' : ''
                }`}
                style={{ backgroundColor: campaign.color }}
                aria-hidden
              />
              <span
                className={`inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background/80 px-2 py-0.5 text-[10px] font-bold leading-tight text-foreground shadow-sm backdrop-blur-sm transition-all group-hover/tag:shadow-md ${
                  campaign.is_critical
                    ? 'border-rose-500/35 ring-1 ring-rose-500/15'
                    : 'border-border/60'
                }`}
                style={{
                  boxShadow: campaign.is_critical
                    ? `inset 0 0 0 1px ${campaign.color}22, 0 0 0 1px rgba(244,63,94,0.12), 0 1px 2px ${campaign.color}18`
                    : `inset 0 0 0 1px ${campaign.color}22, 0 1px 2px ${campaign.color}18`,
                }}
              >
                {campaign.is_critical ? (
                  <svg
                    className="h-3 w-3 shrink-0 text-rose-600 dark:text-rose-400"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-label="Critical"
                  >
                    <path d="M12 2l2.4 7.4h7.8l-6.3 4.6 2.4 7.4L12 17.2l-6.3 4.6 2.4-7.4L1.8 9.4h7.8z" />
                  </svg>
                ) : (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-white/40"
                    style={{ backgroundColor: campaign.color }}
                    aria-hidden
                  />
                )}
                <span className="truncate">{campaign.name}</span>
              </span>
            </div>
            <CampaignMeta campaign={campaign} />
          </div>
        );
      })}
      {overflow > 0 && (
        <span className="inline-flex w-fit rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
          +{overflow}
        </span>
      )}
    </div>
  );
}
