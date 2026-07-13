'use client';

import * as React from 'react';

import { useMarketingPerformance } from '@/hooks/use-marketing-performance';
import {
  formatAed,
  formatMarketingNumber,
  type MarketingActiveCampaign,
  type MarketingPerformanceSnapshot,
} from '@/lib/marketing-performance/types';
import { hasPersianText, rtlProps } from '@/lib/marketing-performance/rtl';

function RtlText({ text, className = '' }: { text: string; className?: string }) {
  const { dir, className: rtlCn } = rtlProps(text);
  return (
    <span dir={dir} className={[rtlCn, className].filter(Boolean).join(' ')}>
      {text}
    </span>
  );
}

function RtlParagraph({ text, className = '' }: { text: string; className?: string }) {
  if (!hasPersianText(text)) {
    return <p className={className}>{text}</p>;
  }
  return (
    <p dir="rtl" className={['text-right', className].filter(Boolean).join(' ')}>
      {text}
    </p>
  );
}

function PeriodBadge({ label }: { label?: string }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-brand-burgundy/15 bg-brand-burgundy/[0.06] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-burgundy">
      {label}
    </span>
  );
}

function MetricTile({
  label,
  value,
  change,
  large,
}: {
  label: string;
  value: string;
  change?: string | null;
  large?: boolean;
}) {
  return (
    <div className="rounded-xl border border-brand-medium-gray/25 bg-gradient-to-b from-white to-brand-light-gray/30 p-4 dark:from-zinc-950 dark:to-zinc-900/40">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-medium-gray">{label}</div>
      <div className={`mt-2 font-semibold tabular-nums tracking-tight text-brand-black ${large ? 'text-2xl md:text-3xl' : 'text-xl'}`}>
        {value}
      </div>
      {change ? (
        <div className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">{change}</div>
      ) : null}
    </div>
  );
}

function ShareBar({ items }: { items: Array<{ label: string; share: number; value?: number }> }) {
  const max = Math.max(...items.map((i) => i.share), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-brand-black">{item.label}</span>
            <span className="tabular-nums text-brand-medium-gray">
              {item.share}% {item.value != null ? `· ${formatMarketingNumber(item.value)}` : ''}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-brand-light-gray">
            <div
              className="h-full rounded-full bg-brand-burgundy transition-all duration-500"
              style={{ width: `${Math.max(4, (item.share / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DataTable({
  headers,
  rows,
  rtlColumns,
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
  rtlColumns?: number[];
}) {
  const rtlSet = new Set(rtlColumns ?? []);
  return (
    <div className="overflow-x-auto rounded-xl border border-brand-medium-gray/25">
      <table className="min-w-full text-sm">
        <thead className="bg-brand-light-gray/60 text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-brand-medium-gray/20 bg-white">
              {row.map((cell, j) => {
                const cellText = typeof cell === 'string' ? cell : '';
                const cellRtl = rtlSet.has(j) || hasPersianText(cellText);
                return (
                  <td
                    key={j}
                    dir={cellRtl ? 'rtl' : 'ltr'}
                    className={[
                      'px-3 py-2.5 text-brand-dark-gray',
                      cellRtl ? 'text-right' : 'text-left tabular-nums',
                    ].join(' ')}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActiveCampaignCard({ campaign }: { campaign: MarketingActiveCampaign }) {
  if (!campaign?.headline_fa && !campaign?.summary_fa) return null;

  const interests = campaign.audience?.interests ?? [];
  const objectives = campaign.objectives ?? [];

  return (
    <div className="dash-panel overflow-hidden ring-1 ring-emerald-500/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-medium-gray/15 bg-gradient-to-r from-emerald-950/5 via-white to-brand-burgundy/[0.04] px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-800">
              Active campaign · {campaign.platform ?? 'Meta Ads'}
            </div>
            {campaign.content_note ? (
              <div className="mt-0.5 text-xs text-brand-medium-gray">{campaign.content_note}</div>
            ) : null}
          </div>
        </div>
        <PeriodBadge label={campaign.period?.label} />
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <div className="space-y-4 border-b border-brand-medium-gray/15 p-6 lg:border-b-0 lg:border-e">
          {campaign.headline_fa ? (
            <RtlParagraph text={campaign.headline_fa} className="text-base font-semibold text-brand-black" />
          ) : null}
          {campaign.summary_fa ? (
            <RtlParagraph text={campaign.summary_fa} className="text-sm leading-relaxed text-brand-dark-gray" />
          ) : null}
          {campaign.goal_fa ? (
            <div className="rounded-xl border border-brand-burgundy/10 bg-brand-burgundy/[0.04] px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-burgundy">Primary goal</div>
              <RtlParagraph text={campaign.goal_fa} className="mt-2 text-sm leading-relaxed text-brand-dark-gray" />
            </div>
          ) : null}
          {objectives.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {objectives.map((obj) => (
                <span
                  key={obj}
                  className="rounded-full border border-brand-medium-gray/25 bg-white px-3 py-1 text-[11px] font-semibold text-brand-dark-gray"
                >
                  {obj}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-5 bg-brand-light-gray/25 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-brand-medium-gray/20 bg-white p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">Run dates</div>
              <div className="mt-1 text-sm font-semibold text-brand-black">{campaign.period?.label ?? '—'}</div>
            </div>
            <div className="rounded-xl border border-brand-medium-gray/20 bg-white p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">Daily budget</div>
              <div className="mt-1 text-sm font-semibold tabular-nums text-brand-black">
                {campaign.budget?.daily_aed != null ? formatAed(campaign.budget.daily_aed) : '—'}
              </div>
            </div>
            <div className="col-span-2 rounded-xl border border-brand-medium-gray/20 bg-white p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">
                Estimated total spend
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-brand-burgundy">
                {campaign.budget?.total_estimate_aed != null
                  ? formatAed(campaign.budget.total_estimate_aed)
                  : '—'}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">Target audience</div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-brand-medium-gray">Location</dt>
                <dd className="text-end font-medium text-brand-black">{campaign.audience?.location ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-medium-gray">Age</dt>
                <dd className="font-medium tabular-nums text-brand-black">{campaign.audience?.age ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-medium-gray">Languages</dt>
                <dd className="text-end font-medium text-brand-black">
                  {(campaign.audience?.languages ?? []).join(' / ') || '—'}
                </dd>
              </div>
            </dl>
          </div>

          {interests.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">Interests</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {interests.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-brand-dark-gray ring-1 ring-brand-medium-gray/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AdminQuickEdit({
  snapshot,
  saving,
  onSave,
}: {
  snapshot: MarketingPerformanceSnapshot;
  saving: boolean;
  onSave: (next: MarketingPerformanceSnapshot) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const ig = snapshot.instagram?.metrics ?? [];
  const ga = snapshot.google_ads?.totals ?? {};
  const meta = snapshot.meta_ads?.totals ?? {};

  const [draft, setDraft] = React.useState({
    ig_views: String(ig.find((m) => m.key === 'views')?.value ?? ''),
    ig_reach: String(ig.find((m) => m.key === 'reach')?.value ?? ''),
    ig_followers: String(ig.find((m) => m.key === 'followers')?.value ?? ''),
    ga_spend: String(ga.spend_aed ?? ''),
    ga_clicks: String(ga.clicks ?? ''),
    meta_spend: String(meta.spend_aed ?? ''),
    meta_whatsapp: String(meta.whatsapp_conversations ?? ''),
  });

  React.useEffect(() => {
    const m = snapshot.instagram?.metrics ?? [];
    const g = snapshot.google_ads?.totals ?? {};
    const t = snapshot.meta_ads?.totals ?? {};
    setDraft({
      ig_views: String(m.find((x) => x.key === 'views')?.value ?? ''),
      ig_reach: String(m.find((x) => x.key === 'reach')?.value ?? ''),
      ig_followers: String(m.find((x) => x.key === 'followers')?.value ?? ''),
      ga_spend: String(g.spend_aed ?? ''),
      ga_clicks: String(g.clicks ?? ''),
      meta_spend: String(t.spend_aed ?? ''),
      meta_whatsapp: String(t.whatsapp_conversations ?? ''),
    });
  }, [snapshot]);

  const patchMetric = (key: string, raw: string) => {
    const num = Number(raw.replace(/,/g, ''));
    return Number.isFinite(num) ? num : raw;
  };

  const handleSave = async () => {
    const next: MarketingPerformanceSnapshot = JSON.parse(JSON.stringify(snapshot));
    const metrics = next.instagram?.metrics ?? [];
    for (const m of metrics) {
      if (m.key === 'views') m.value = patchMetric('views', draft.ig_views);
      if (m.key === 'reach') m.value = patchMetric('reach', draft.ig_reach);
      if (m.key === 'followers') m.value = patchMetric('followers', draft.ig_followers);
    }
    if (next.google_ads?.totals) {
      next.google_ads.totals.spend_aed = Number(draft.ga_spend) || 0;
      next.google_ads.totals.clicks = Number(draft.ga_clicks) || 0;
    }
    if (next.meta_ads?.totals) {
      next.meta_ads.totals.spend_aed = Number(draft.meta_spend) || 0;
      next.meta_ads.totals.whatsapp_conversations = Number(draft.meta_whatsapp) || 0;
    }
    await onSave(next);
    setOpen(false);
  };

  return (
    <div className="rounded-2xl border border-dashed border-brand-burgundy/25 bg-brand-burgundy/[0.03] p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-burgundy">Quick update</div>
          <p className="mt-1 text-sm text-brand-dark-gray">Edit key KPIs manually until API connectors are live.</p>
        </div>
        <span className="text-lg text-brand-burgundy">{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['IG Views', 'ig_views'],
            ['IG Reach', 'ig_reach'],
            ['IG Followers', 'ig_followers'],
            ['Google Spend (AED)', 'ga_spend'],
            ['Google Clicks', 'ga_clicks'],
            ['Meta Spend (AED)', 'meta_spend'],
            ['WhatsApp conv.', 'meta_whatsapp'],
          ].map(([label, key]) => (
            <label key={key} className="block text-xs font-medium text-brand-dark-gray">
              {label}
              <input
                value={draft[key as keyof typeof draft]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-brand-medium-gray/30 bg-white px-2.5 py-2 text-sm tabular-nums outline-none focus:border-brand-burgundy/40 focus:ring-1 focus:ring-brand-burgundy/20"
              />
            </label>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full px-4 py-2 text-xs font-semibold text-brand-medium-gray"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded-full bg-brand-burgundy px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save snapshot'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function MarketingPerformanceDashboard() {
  const { authReady, isAdmin, snapshot, loading, saving, error, pipelineCount, saveSnapshot, reload } =
    useMarketingPerformance();

  if (!authReady) return null;
  if (!isAdmin) return null;

  const activeCampaign = snapshot?.active_campaign ?? snapshot?.meta_ads?.active_campaign;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="dash-eyebrow">Live performance</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-brand-black md:text-2xl">
            Marketing performance report
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-brand-dark-gray">
            Executive snapshot for Lorenzo digital marketing — admin only. Connect ad APIs later; update KPIs manually for now.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pipelineCount != null ? (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
              Live · {pipelineCount} calendar posts active
            </span>
          ) : null}
          {snapshot?.updated_at ? (
            <span className="text-[11px] text-brand-medium-gray">
              Updated {new Date(snapshot.updated_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-full border border-brand-medium-gray/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-dark-gray hover:border-brand-burgundy/30"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && !snapshot ? (
        <div className="dash-panel animate-pulse p-8 text-center text-sm text-brand-medium-gray">Loading report…</div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {snapshot ? (
        <>
          {activeCampaign ? <ActiveCampaignCard campaign={activeCampaign} /> : null}

          <div className="dash-panel overflow-hidden">
            <div className="border-b border-brand-medium-gray/20 bg-gradient-to-r from-brand-burgundy to-[#6d1430] px-6 py-5 text-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">
                    {snapshot.brand ?? 'Lorenzo'}
                  </div>
                  <h3 className="mt-1 text-lg font-semibold">{snapshot.title ?? 'Marketing Performance'}</h3>
                  <p className="mt-1 text-sm text-white/80">{snapshot.overview?.subtitle}</p>
                </div>
                <PeriodBadge label={snapshot.period?.label} />
              </div>
              {snapshot.period?.note ? (
                <p className="mt-3 text-xs text-white/65">{snapshot.period.note}</p>
              ) : null}
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
              {(snapshot.overview?.pillars ?? []).map((pillar) => (
                <div
                  key={pillar.key}
                  className="rounded-xl border border-brand-medium-gray/20 bg-brand-light-gray/20 p-4"
                >
                  <h4 className="text-sm font-semibold text-brand-black">{pillar.title}</h4>
                  <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-brand-dark-gray">
                    {pillar.items.map((item) => {
                      const itemRtl = hasPersianText(item);
                      return (
                        <li
                          key={item}
                          dir={itemRtl ? 'rtl' : 'ltr'}
                          className={['flex gap-2', itemRtl ? 'flex-row-reverse text-right' : ''].join(' ')}
                        >
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-burgundy" />
                          <span className={itemRtl ? 'leading-7' : ''}>{item}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <AdminQuickEdit snapshot={snapshot} saving={saving} onSave={saveSnapshot} />

          {/* Instagram */}
          <div className="dash-panel p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-brand-black">Instagram</h3>
                <p className="mt-0.5 text-sm text-brand-dark-gray">Account performance · Lorenzo Home UAE</p>
              </div>
              <PeriodBadge label={snapshot.instagram?.period?.label} />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {(snapshot.instagram?.metrics ?? []).map((m) => (
                <MetricTile
                  key={m.label}
                  label={m.label}
                  value={formatMarketingNumber(m.value)}
                  change={m.change}
                  large={m.key === 'views'}
                />
              ))}
            </div>
            {snapshot.instagram?.h1_note ? (
              <RtlParagraph
                text={snapshot.instagram.h1_note}
                className="mt-4 rounded-lg bg-brand-light-gray/50 px-3 py-2 text-sm text-brand-dark-gray"
              />
            ) : null}
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-medium-gray">
                  Interactions by format
                </h4>
                <ShareBar items={snapshot.instagram?.format_mix ?? []} />
                {snapshot.instagram?.insight ? (
                  <RtlParagraph text={snapshot.instagram.insight} className="mt-4 text-sm text-brand-dark-gray" />
                ) : null}
              </div>
              <div>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-medium-gray">Top Reels by Views</h4>
                <DataTable
                  headers={['Date', 'Views', 'Note']}
                  rows={(snapshot.instagram?.top_reels ?? []).map((r) => [
                    r.date,
                    formatMarketingNumber(r.views),
                    r.note ?? '—',
                  ])}
                />
              </div>
            </div>
            {snapshot.instagram?.report_note ? (
              <RtlParagraph
                text={snapshot.instagram.report_note}
                className="mt-4 text-[11px] text-brand-medium-gray"
              />
            ) : null}
          </div>

          {/* Google Ads */}
          <div className="dash-panel p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-brand-black">Google Ads</h3>
                <p className="mt-0.5 text-sm text-brand-dark-gray">Paid search & display performance</p>
              </div>
              <PeriodBadge label={snapshot.google_ads?.period?.label} />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <MetricTile label="Spend" value={formatAed(snapshot.google_ads?.totals?.spend_aed)} large />
              <MetricTile label="Impressions" value={formatMarketingNumber(snapshot.google_ads?.totals?.impressions)} />
              <MetricTile label="Clicks" value={formatMarketingNumber(snapshot.google_ads?.totals?.clicks)} />
              <MetricTile label="CTR" value={`${snapshot.google_ads?.totals?.ctr_pct ?? '—'}%`} />
              <MetricTile label="Avg. CPC" value={formatAed(snapshot.google_ads?.totals?.avg_cpc_aed)} />
            </div>
            <div className="mt-6">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-medium-gray">Campaigns</h4>
              <DataTable
                headers={['Campaign', 'Clicks', 'Spend', 'CTR', 'Avg. CPC']}
                rows={(snapshot.google_ads?.campaigns ?? []).map((c) => [
                  c.name,
                  formatMarketingNumber(c.clicks),
                  formatAed(c.spend_aed),
                  c.ctr_pct != null ? `${c.ctr_pct}%` : '—',
                  formatAed(c.avg_cpc_aed),
                ])}
              />
            </div>
            {snapshot.google_ads?.insight ? (
              <RtlParagraph text={snapshot.google_ads.insight} className="mt-4 text-sm text-brand-dark-gray" />
            ) : null}
            <p className="mt-2 text-[11px] text-brand-medium-gray">
              Mobile: {snapshot.google_ads?.totals?.mobile_click_share_pct}% of clicks (
              {formatMarketingNumber(snapshot.google_ads?.totals?.mobile_clicks)}) · avg. CPC{' '}
              {formatAed(snapshot.google_ads?.totals?.mobile_avg_cpc_aed)}
            </p>
          </div>

          {/* Meta Ads */}
          <div className="dash-panel p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-brand-black">Meta Ads</h3>
                <p className="mt-0.5 text-sm text-brand-dark-gray">Facebook & Instagram paid campaigns</p>
              </div>
              <PeriodBadge label={snapshot.meta_ads?.period?.label} />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
              <MetricTile label="Spend" value={formatAed(snapshot.meta_ads?.totals?.spend_aed)} large />
              <MetricTile label="Impressions" value={formatMarketingNumber(snapshot.meta_ads?.totals?.impressions)} />
              <MetricTile label="WhatsApp conv." value={formatMarketingNumber(snapshot.meta_ads?.totals?.whatsapp_conversations)} />
              <MetricTile label="Cost / WhatsApp" value={formatAed(snapshot.meta_ads?.totals?.avg_cost_per_whatsapp_aed)} />
              <MetricTile label="Link clicks" value={formatMarketingNumber(snapshot.meta_ads?.totals?.link_clicks)} />
              <MetricTile label="Avg. CPC" value={formatAed(snapshot.meta_ads?.totals?.avg_cpc_aed)} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricTile label="Post engagement" value={formatMarketingNumber(snapshot.meta_ads?.totals?.post_engagement)} />
              <MetricTile label="Profile visits" value={formatMarketingNumber(snapshot.meta_ads?.totals?.profile_visits)} />
              <MetricTile label="Awareness reach" value={formatMarketingNumber(snapshot.meta_ads?.totals?.awareness_reach)} />
              <MetricTile label="Ads reviewed" value={formatMarketingNumber(snapshot.meta_ads?.totals?.ads_reviewed)} />
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {(snapshot.meta_ads?.highlights ?? []).map((h) => (
                <div key={h.label} className="rounded-xl border border-brand-medium-gray/20 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">{h.label}</div>
                  <div className="mt-1 font-semibold text-brand-black">{h.value}</div>
                  {h.detail ? (
                    <RtlParagraph text={h.detail} className="mt-1 text-xs text-brand-dark-gray" />
                  ) : null}
                </div>
              ))}
            </div>
            {snapshot.meta_ads?.report_note ? (
              <RtlParagraph
                text={snapshot.meta_ads.report_note}
                className="mt-4 text-[11px] text-brand-medium-gray"
              />
            ) : null}
          </div>

          {/* Services */}
          <div className="dash-panel p-6">
            <h3 className="text-lg font-semibold text-brand-black">Digital services & infrastructure</h3>
            <p className="mt-1 text-sm text-brand-dark-gray">Platforms built for Lorenzo marketing operations</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {(snapshot.services ?? []).map((svc) => (
                <div key={svc.name} className="rounded-xl border border-brand-medium-gray/25 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-brand-black">{svc.title}</div>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                      {svc.status}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-brand-burgundy">{svc.name}</div>
                  <p className="mt-2 text-sm text-brand-dark-gray">
                    <RtlText text={svc.description} />
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {Object.entries(snapshot.live_sources ?? {}).map(([key, on]) => (
                <span
                  key={key}
                  className={
                    'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ' +
                    (on
                      ? 'bg-emerald-500/10 text-emerald-800'
                      : 'bg-brand-light-gray text-brand-medium-gray')
                  }
                >
                  {key.replace(/_/g, ' ')} {on ? '· live' : '· planned'}
                </span>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
