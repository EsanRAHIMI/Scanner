export type ChannelRow = {
  channel: string;
  status: string;
  delivery?: string | null;
  issue?: string | null;
  next_action?: string | null;
  spend: number | null;
  budget: number | null;
  remaining: number | null;
  utilization: number | null;
  approval?: string | null;
  impressions: number | null;
  clicks: number | null;
  raw_results: number | null;
  ctr: number | null;
  qualified: number | null;
  whatsapp: number | null;
  quotes: number | null;
  orders_90d: number | null;
  revenue_90d: number | null;
  checked_on?: string | null;
  age_days: number | null;
};

export type DashboardPayload = {
  version: number;
  month: string;
  currency: string;
  fx_usd_aed: number;
  generated_at: string;
  spend: number | null;
  budget: number | null;
  qualified: number | null;
  quotes: number | null;
  orders_90d: number | null;
  revenue_90d: number | null;
  channels: ChannelRow[];
  trend: Array<{ month: string; spend: number | null; raw_results: number | null; ctr: number | null }>;
  months: string[];
  alerts: Array<{ level: string; text: string }>;
  site: {
    ga4?: { state?: string; sessions?: number | null; users?: number | null; detail?: string };
    search?: { state?: string; clicks?: number | null; impressions?: number | null; detail?: string };
    reviews?: { state?: string; rating?: number | null; count?: number | null; detail?: string };
    gtm?: { state?: string; detail?: string };
    odoo?: { state?: string; detail?: string };
    unmapped_leads?: number;
  };
  connectors: Array<{ name: string; state: string; detail?: string; checked_on?: string }>;
};

export function aed(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `AED ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function num(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function pct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function monthLabel(month: string): string {
  const [year, m] = month.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const index = Number(m) - 1;
  if (!year || index < 0 || index > 11) return month;
  return `${names[index]} ${year}`;
}
