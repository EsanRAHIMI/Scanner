export type MarketingMetric = {
  key?: string;
  label: string;
  value: number | string;
  change?: string | null;
};

export type MarketingPeriod = {
  label?: string;
  from?: string;
  to?: string;
  note?: string;
};

export type MarketingPillar = {
  key: string;
  title: string;
  items: string[];
};

export type MarketingFormatMix = {
  label: string;
  share: number;
  value?: number;
};

export type MarketingCampaignRow = {
  name: string;
  clicks?: number;
  spend_aed?: number;
  ctr_pct?: number;
  avg_cpc_aed?: number;
};

export type MarketingService = {
  name: string;
  title: string;
  description: string;
  status: string;
};

export type MarketingActiveCampaign = {
  status?: string;
  platform?: string;
  headline_fa?: string;
  summary_fa?: string;
  content_note?: string;
  period?: MarketingPeriod;
  budget?: {
    daily_aed?: number;
    total_estimate_aed?: number;
  };
  audience?: {
    location?: string;
    age?: string;
    languages?: string[];
    interests?: string[];
  };
  objectives?: string[];
  goal_fa?: string;
};

export type MarketingPerformanceSnapshot = {
  id?: string;
  title?: string;
  brand?: string;
  period?: MarketingPeriod;
  overview?: { subtitle?: string; pillars?: MarketingPillar[] };
  active_campaign?: MarketingActiveCampaign;
  instagram?: {
    period?: MarketingPeriod;
    metrics?: MarketingMetric[];
    h1_note?: string;
    format_mix?: MarketingFormatMix[];
    engagement_breakdown?: MarketingMetric[];
    top_reels?: Array<{ date: string; views: number; note?: string }>;
    insight?: string;
    report_note?: string;
  };
  google_ads?: {
    period?: MarketingPeriod;
    totals?: Record<string, number>;
    campaigns?: MarketingCampaignRow[];
    insight?: string;
    report_note?: string;
  };
  meta_ads?: {
    period?: MarketingPeriod;
    totals?: Record<string, number>;
    highlights?: Array<{ label: string; value: string; detail?: string }>;
    report_note?: string;
    active_campaign?: MarketingActiveCampaign;
  };
  services?: MarketingService[];
  live_sources?: Record<string, boolean>;
  updated_at?: string;
};

export function formatMarketingNumber(value: number | string | undefined | null): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toLocaleString('en-US');
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatAed(value: number | undefined | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `AED ${value.toLocaleString('en-US', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
