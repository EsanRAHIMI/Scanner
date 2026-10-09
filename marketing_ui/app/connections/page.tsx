'use client';

import { useEffect, useState } from 'react';

type Connector = { name: string; state: string; detail?: string; checked_on?: string };
type SiteBlock = { state?: string; detail?: string };

export default function ConnectionsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [site, setSite] = useState<Record<string, SiteBlock>>({});
  const [fx, setFx] = useState('3.6725');
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const [conn, settings] = await Promise.all([
      fetch('/api/os/connectors', { cache: 'no-store' }),
      fetch('/api/os/settings', { cache: 'no-store' }),
    ]);
    if (conn.ok) {
      const body = await conn.json();
      setConnectors(body.connectors ?? []);
      setSite(body.site ?? {});
    }
    if (settings.ok) {
      const body = await settings.json();
      if (body.fx_usd_aed) setFx(String(body.fx_usd_aed));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveFx() {
    const res = await fetch('/api/os/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fx_usd_aed: Number(fx) }),
    });
    setMessage(res.ok ? 'Rate saved.' : 'Save failed. Admin access is required.');
  }

  async function syncNow() {
    const res = await fetch('/api/os/sync', { method: 'POST' });
    setMessage(res.ok ? 'Sync started. The dashboard updates when it finishes.' : 'Sync failed. Admin access is required.');
    window.setTimeout(() => void load(), 2500);
  }

  const blocks = [
    ['Odoo', site.odoo],
    ['GA4', site.ga4],
    ['Search Console', site.search],
    ['Reviews', site.reviews],
    ['Tag Manager', site.gtm],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="dash-eyebrow">Connections</p>
          <h1 className="dash-title">Sources</h1>
          <p className="dash-desc">Keys stay on the marketing API. This page only shows whether each source is connected.</p>
        </div>
        <button type="button" className="btn-primary px-5 py-2.5" onClick={() => void syncNow()}>Sync now</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {connectors.map((item) => (
          <div key={item.name} className="dash-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{item.name}</h2>
              <span className="text-xs font-semibold uppercase text-brand-burgundy">{item.state}</span>
            </div>
            <p className="mt-2 text-sm text-brand-dark-gray">{item.detail || '—'}</p>
          </div>
        ))}
        {blocks.map(([name, block]) => (
          <div key={name} className="dash-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{name}</h2>
              <span className="text-xs font-semibold uppercase text-brand-burgundy">{block?.state || 'waiting'}</span>
            </div>
            <p className="mt-2 text-sm text-brand-dark-gray">{block?.detail || 'Not checked yet.'}</p>
          </div>
        ))}
      </div>

      <div className="dash-panel flex flex-wrap items-end gap-3 p-5">
        <label className="text-sm">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">USD / AED</span>
          <input className="w-32 rounded-lg border border-brand-medium-gray/40 px-3 py-2 tabular-nums" value={fx} onChange={(e) => setFx(e.target.value)} />
        </label>
        <button type="button" className="btn-primary px-4 py-2" onClick={() => void saveFx()}>Save rate</button>
      </div>
      {message ? <p className="text-sm text-brand-dark-gray">{message}</p> : null}
    </div>
  );
}
