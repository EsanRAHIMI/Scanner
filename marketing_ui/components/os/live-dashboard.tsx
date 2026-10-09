'use client';

import { useState } from 'react';

import { useLiveDashboard } from '@/hooks/use-live-dashboard';
import { aed, monthLabel, num, pct, type ChannelRow, type DashboardPayload } from '@/lib/os/types';

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="dash-metric">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-medium-gray">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-brand-black">{value}</div>
      {hint ? <div className="mt-1 text-xs text-brand-dark-gray">{hint}</div> : null}
    </div>
  );
}

function Bar({ value }: { value: number | null }) {
  const width = value == null ? 0 : Math.max(0, Math.min(100, value * 100));
  const over = value != null && value > 1;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-light-gray">
      <div
        className={`h-full rounded-full ${over ? 'bg-red-700' : 'bg-brand-burgundy'}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function Trend({ points }: { points: DashboardPayload['trend'] }) {
  const known = points.map((point) => point.spend).filter((value): value is number => value != null);
  const max = Math.max(...known, 1);
  return (
    <div className="flex h-36 items-end gap-2">
      {points.map((point) => (
        <div key={point.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className="flex h-24 w-full items-end">
            {point.spend == null ? (
              <div className="h-full w-full rounded-t-md border border-dashed border-brand-medium-gray/50" title="Unknown" />
            ) : (
              <div
                className="w-full rounded-t-md bg-brand-burgundy/80"
                style={{ height: `${Math.max(4, (point.spend / max) * 100)}%` }}
                title={aed(point.spend)}
              />
            )}
          </div>
          <div className="truncate text-[10px] font-medium text-brand-medium-gray">{monthLabel(point.month).split(' ')[0]}</div>
        </div>
      ))}
    </div>
  );
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sourceState(state?: string) {
  if (state === 'ok') return { label: 'Live', dot: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-800' };
  if (state === 'error') return { label: 'Error', dot: 'bg-red-600', chip: 'bg-red-500/10 text-red-800' };
  if (state === 'unconfigured') return { label: 'Not connected', dot: 'bg-brand-medium-gray', chip: 'bg-brand-light-gray text-brand-dark-gray' };
  return { label: 'Waiting', dot: 'bg-amber-500', chip: 'bg-amber-500/10 text-amber-900' };
}

function updatedLabel(iso?: string) {
  if (!iso) return 'Waiting for the first snapshot';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'Updated';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Updated ${hours}h ago`;
  return `Updated ${Math.round(hours / 24)}d ago`;
}

export function LiveDashboard() {
  const [month, setMonth] = useState(currentMonth);
  const { data, authRequired, error, syncing, refresh, signIn } = useLiveDashboard(month);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (authRequired) {
    return (
      <form
        className="dash-panel mx-auto max-w-md space-y-4 p-8"
        onSubmit={(event) => {
          event.preventDefault();
          void signIn(email, password);
        }}
      >
        <p className="dash-eyebrow">Marketing</p>
        <h1 className="text-2xl font-semibold">Sign in to the live dashboard</h1>
        <input className="w-full rounded-xl border border-brand-medium-gray/40 px-4 py-3 text-sm" type="email" autoComplete="username" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded-xl border border-brand-medium-gray/40 px-4 py-3 text-sm" type="password" autoComplete="current-password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button className="btn-primary w-full py-3" type="submit">Sign in</button>
      </form>
    );
  }

  const today = currentMonth();
  const viewingToday = month === today;
  const months = [...new Set([...(data?.months ?? []), today])].sort();
  const connectorByName = new Map((data?.connectors ?? []).map((item) => [item.name.toLowerCase(), item]));

  return (
    <div className="space-y-8">
      <section className="dash-hero">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="dash-eyebrow">Marketing OS</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
              {viewingToday ? todayLabel() : monthLabel(month)}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-brand-light-gray/90">
              {viewingToday
                ? 'Month to date through today. A blank figure is unknown, not zero.'
                : 'A blank figure is unknown, not zero.'}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <div className="flex items-center gap-2 text-xs text-brand-light-gray">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              {updatedLabel(data?.generated_at)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {months.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMonth(item)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    month === item ? 'bg-white text-brand-burgundy' : 'bg-white/10 text-white'
                  }`}
                >
                  {item === today ? 'Today' : monthLabel(item)}
                </button>
              ))}
              <button type="button" onClick={() => void refresh()} disabled={syncing} className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-brand-burgundy disabled:opacity-60">
                {syncing ? 'Refreshing…' : 'Refresh sources'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {!data ? <div className="dash-panel h-40 animate-pulse" /> : null}

      {data ? (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile label="Spend" value={aed(data.spend)} hint={`Budget ${aed(data.budget)}`} />
            <Tile label="Qualified leads" value={num(data.qualified)} hint="From Odoo" />
            <Tile label="Quotations" value={num(data.quotes)} hint="From Odoo" />
            <Tile label="90-day revenue" value={aed(data.revenue_90d)} hint={`${num(data.orders_90d)} paid orders`} />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.45fr_0.75fr]">
            <div className="dash-panel overflow-hidden">
              <div className="border-b border-brand-light-gray px-5 py-4">
                <h2 className="text-lg font-semibold">Channels</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-[10px] uppercase tracking-wider text-brand-medium-gray">
                    <tr>
                      {['Channel', 'Status', 'Spend', 'Left', 'Impr.', 'Clicks', 'CTR', 'Raw', 'Qualified'].map((heading) => (
                        <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.channels.map((row: ChannelRow) => {
                      const tone = sourceState(connectorByName.get(row.channel.toLowerCase())?.state);
                      return (
                      <tr key={row.channel} className="border-t border-brand-light-gray align-top">
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-brand-black">{row.channel}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.chip}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                              {tone.label}
                            </span>
                          </div>
                          <div className="mt-2 w-28"><Bar value={row.utilization} /></div>
                          <div className="mt-1 text-[10px] text-brand-medium-gray">{pct(row.utilization)} of {aed(row.budget)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{row.status}</div>
                          {row.approval ? <div className="mt-1 text-[10px] uppercase tracking-wider text-brand-medium-gray">{row.approval}</div> : null}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{aed(row.spend)}</td>
                        <td className="px-4 py-3 tabular-nums">{aed(row.remaining)}</td>
                        <td className="px-4 py-3 tabular-nums">{num(row.impressions)}</td>
                        <td className="px-4 py-3 tabular-nums">{num(row.clicks)}</td>
                        <td className="px-4 py-3 tabular-nums">{pct(row.ctr)}</td>
                        <td className="px-4 py-3 tabular-nums">{num(row.raw_results)}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {num(row.qualified)}
                          <div className="mt-1 text-[10px] text-brand-medium-gray">WA {num(row.whatsapp)}</div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="dash-panel p-5">
              <h2 className="text-lg font-semibold">Monthly spend</h2>
              <p className="mt-1 text-xs text-brand-medium-gray">Only months with a known total. A dashed column is unknown.</p>
              <div className="mt-4">
                <Trend points={data.trend} />
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-5">
            {[
              ['Website', data.site.ga4?.state, data.site.ga4?.sessions != null ? `${num(data.site.ga4.sessions)} sessions` : data.site.ga4?.detail],
              ['Google search', data.site.search?.state, data.site.search?.impressions != null ? `${num(data.site.search.impressions)} impressions` : data.site.search?.detail],
              ['Reviews', data.site.reviews?.state, data.site.reviews?.rating != null ? `${data.site.reviews.rating} · ${num(data.site.reviews.count)}` : data.site.reviews?.detail],
              ['Tag Manager', data.site.gtm?.state, data.site.gtm?.detail || 'Health check only'],
              ['Odoo', data.site.odoo?.state, data.site.odoo?.detail],
            ].map(([title, state, detail]) => {
              const tone = sourceState(state as string);
              return (
              <div key={String(title)} className="dash-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">{title}</div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {tone.label}
                  </span>
                </div>
                <p className="mt-2 text-sm text-brand-dark-gray">{detail || '—'}</p>
              </div>
              );
            })}
          </section>

          {data.alerts.length ? (
            <section className="dash-panel p-5">
              <h2 className="text-lg font-semibold">Needs attention</h2>
              <ul className="mt-3 space-y-2">
                {data.alerts.map((alert) => (
                  <li
                    key={alert.text}
                    className={`rounded-xl px-3 py-2 text-sm text-brand-black ${
                      alert.level === 'high' ? 'bg-red-500/10' : 'bg-brand-light-gray/40'
                    }`}
                  >
                    {alert.text}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
