'use client';

import React from 'react';

import type { MarketingCampaign } from '../../lib/calendar/campaigns/types';

interface CampaignRowTagProps {
  campaigns: MarketingCampaign[];
}

export function CampaignRowTag({ campaigns }: CampaignRowTagProps) {
  if (campaigns.length === 0) {
    return <span className="block h-6" aria-hidden />;
  }

  const visible = campaigns.slice(0, 2);
  const overflow = campaigns.length - visible.length;

  return (
    <div className="flex min-h-[1.5rem] flex-col gap-1 py-0.5">
      {visible.map((campaign) => (
        <div
          key={campaign.id}
          className="group/tag relative flex max-w-full items-center"
          title={`${campaign.name} · ${campaign.start_date}${campaign.end_date ? ` → ${campaign.end_date}` : ''}`}
        >
          <span
            className="pointer-events-none absolute -inset-y-0.5 -left-1 w-1 rounded-full opacity-90 shadow-sm"
            style={{ backgroundColor: campaign.color }}
            aria-hidden
          />
          <span
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] font-bold leading-tight text-foreground shadow-sm backdrop-blur-sm transition-all group-hover/tag:shadow-md"
            style={{
              boxShadow: `inset 0 0 0 1px ${campaign.color}22, 0 1px 2px ${campaign.color}18`,
            }}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-white/40"
              style={{ backgroundColor: campaign.color }}
              aria-hidden
            />
            <span className="truncate">{campaign.name}</span>
          </span>
        </div>
      ))}
      {overflow > 0 && (
        <span className="inline-flex w-fit rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
          +{overflow}
        </span>
      )}
    </div>
  );
}
