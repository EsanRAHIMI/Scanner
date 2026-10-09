'use client';

import React from 'react';
import { CalendarStats } from '../../lib/calendar/types';

interface StatsSectionProps {
  stats: CalendarStats;
}

const STATUS_ITEMS = [
  {
    key: 'published' as const,
    label: 'Published',
    dot: 'bg-[hsl(var(--chart-2))]',
    bar: 'bg-[hsl(var(--chart-2))]',
    card: 'border-border',
    bg: 'bg-card',
    num: 'text-foreground',
    sub: 'text-muted-foreground',
  },
  {
    key: 'scheduled' as const,
    label: 'Scheduled',
    dot: 'bg-[hsl(var(--chart-3))]',
    bar: 'bg-[hsl(var(--chart-3))]',
    card: 'border-border',
    bg: 'bg-card',
    num: 'text-foreground',
    sub: 'text-muted-foreground',
  },
  {
    key: 'inProgress' as const,
    label: 'In Progress',
    dot: 'bg-[hsl(var(--chart-4))]',
    bar: 'bg-[hsl(var(--chart-4))]',
    card: 'border-border',
    bg: 'bg-card',
    num: 'text-foreground',
    sub: 'text-muted-foreground',
  },
  {
    key: 'draft' as const,
    label: 'Drafts',
    dot: 'bg-muted-foreground/40',
    bar: 'bg-muted-foreground/20',
    card: 'border-border',
    bg: 'bg-card',
    num: 'text-foreground',
    sub: 'text-muted-foreground',
  },
];

export function StatsSection({ stats }: StatsSectionProps) {
  const total = stats.total;

  return (
    <div className="flex flex-wrap gap-3 items-stretch">
      {/* Total + distribution overview */}
      <div className="bg-card border border-border rounded-xl px-5 py-4 shadow-sm flex items-center gap-6 min-w-[240px]">
        <div className="flex-none">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Content</div>
          <div className="text-3xl font-bold tracking-tight mt-0.5 text-foreground">{total}</div>
        </div>
        {total > 0 && (
          <div className="flex-1 min-w-[120px] space-y-3">
            <div className="h-2 w-full rounded-full overflow-hidden bg-muted flex gap-px shadow-inner">
              {STATUS_ITEMS.map(s => {
                const pct = (stats[s.key] / total) * 100;
                if (!pct) return null;
                return (
                  <div
                    key={s.key}
                    className={`h-full transition-all duration-700 ${s.bar}`}
                    style={{ width: `${pct}%` }}
                    title={`${s.label}: ${stats[s.key]}`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {STATUS_ITEMS.map(s => (
                <span key={s.key} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  <span className={`h-2 w-2 rounded-full flex-none ${s.dot}`} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Per-status cards */}
      {STATUS_ITEMS.map(s => {
        const val = stats[s.key];
        const pct = total ? Math.round((val / total) * 100) : 0;
        return (
          <div
            key={s.key}
            className={`${s.bg} border ${s.card} rounded-xl px-5 py-4 shadow-sm min-w-[120px] lg:min-w-[140px] flex flex-col justify-between gap-3 flex-1 transition-all hover:bg-muted/30`}
          >
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">{s.label}</div>
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-2xl font-bold tracking-tight ${s.num}`}>{val}</span>
              {total > 0 && (
                <span className={`text-[11px] font-bold tabular-nums ${s.sub}`}>{pct}%</span>
              )}
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${s.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
