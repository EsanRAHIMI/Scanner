import { aed, num, pct, type ChannelRow, type DashboardPayload, type TargetRow } from '@/lib/os/types';

export type Decision = { level: 'high' | 'medium'; text: string; href: string; where: string };

export function monthPace(month: string, now = new Date()): number {
  const [year, part] = month.split('-').map(Number);
  const days = new Date(year, part, 0).getDate();
  const start = new Date(year, part - 1, 1);
  const end = new Date(year, part - 1, days, 23, 59, 59);
  if (now < start) return 0;
  if (now > end) return 1;
  return now.getDate() / days;
}

export function actualFor(row: ChannelRow, metric: string): number | null {
  if (metric === 'WhatsApp / 30d') return row.whatsapp;
  if (metric === 'Quotes / 30d') return row.quotes;
  if (metric === 'Paid orders / 90d') return row.orders_90d;
  if (metric === 'Qualified CPL') {
    if (row.spend == null || row.qualified == null || row.qualified <= 0) return null;
    return row.spend / row.qualified;
  }
  if (metric === 'Search CPC') {
    if (row.spend == null || row.clicks == null || row.clicks <= 0) return null;
    return row.spend / row.clicks;
  }
  return null;
}

export function scoreTarget(direction: string | undefined, actual: number | null, target: number | null): 'met' | 'miss' | 'unknown' {
  if (actual == null || target == null) return 'unknown';
  if (direction === 'lte') return actual <= target ? 'met' : 'miss';
  return actual >= target ? 'met' : 'miss';
}

export function targetFigure(metric: string, value: number | null, unit?: string): string {
  if (value == null) return '—';
  if (unit === 'AED' || metric.includes('CPL') || metric.includes('CPC')) return aed(value);
  if (unit === 'ratio') return pct(value);
  return num(value);
}

function placeFor(text: string): { href: string; where: string } {
  if (text.includes('against')) return { href: '/targets', where: 'Targets' };
  if (text.includes('over budget') || text.includes('draft') || text.includes('of budget')) return { href: '/budgets', where: 'Budgets' };
  return { href: '/connections', where: 'Connections' };
}

/** Exceptions worth acting on, highest first. Unknown qualified leads collapse into one line. */
export function decisionItems(alerts: DashboardPayload['alerts'], channels: ChannelRow[], targets: TargetRow[], pace: number): Decision[] {
  const qualified = alerts.filter((item) => item.text.includes('no qualified-lead'));
  const rest = alerts.filter((item) => !item.text.includes('no qualified-lead') && !item.text.includes('last checked'));
  const merged: Decision[] = rest.map((item) => ({ level: item.level === 'high' ? 'high' : 'medium', text: item.text, ...placeFor(item.text) }));
  if (qualified.length) {
    merged.push({
      level: 'medium',
      text: `Qualified leads are unknown on ${qualified.length} active channels. Do not raise budget from raw results.`,
      href: '/connections',
      where: 'Connections',
    });
  }
  for (const target of targets) {
    if (target.target == null || target.channel === 'All') continue;
    const row = channels.find((item) => item.channel === target.channel);
    if (!row) continue;
    const actual = actualFor(row, target.metric);
    if (scoreTarget(target.direction, actual, target.target) !== 'miss') continue;
    merged.push({
      level: 'high',
      text: `${target.channel} ${target.metric} is ${targetFigure(target.metric, actual, target.unit)} against ${targetFigure(target.metric, target.target, target.unit)}.`,
      href: '/targets',
      where: 'Targets',
    });
  }
  if (pace > 0 && pace < 1) {
    for (const row of channels) {
      if (row.utilization != null && row.utilization > pace + 0.2 && row.utilization <= 1) {
        merged.push({
          level: 'medium',
          text: `${row.channel} has used ${pct(row.utilization)} of its budget with ${pct(pace)} of the month gone.`,
          href: '/budgets',
          where: 'Budgets',
        });
      }
    }
  }
  const rank = (level: string) => (level === 'high' ? 0 : 1);
  return merged.sort((a, b) => rank(a.level) - rank(b.level));
}

export function updatedLabel(iso?: string | null): string {
  if (!iso) return 'Waiting for the first sync';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'Updated';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Updated ${hours}h ago`;
  return `Updated ${Math.round(hours / 24)}d ago`;
}
