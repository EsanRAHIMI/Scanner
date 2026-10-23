'use client';

import { useEffect, useState } from 'react';

import { Icon } from '@/components/os/icons';
import { cx } from '@/components/os/ui';
import { DASHBOARD_SECTIONS, PAID_ALSO, PAID_LEAD } from '@/lib/os/catalog';
import { syncSources } from '@/lib/os/client';

type Connector = { name: string; state: string; detail?: string; checked_on?: string };
type SiteBlock = { state?: string; detail?: string };

export default function ConnectionsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [site, setSite] = useState<Record<string, SiteBlock>>({});
  const [fx, setFx] = useState('3.6725');
  const [message, setMessage] = useState<string | null>(null);
  const [messageError, setMessageError] = useState(false);
  const [syncing, setSyncing] = useState(false);

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
    const params = new URLSearchParams(window.location.search);
    const code = params.get('auth_code') || params.get('code');
    const state = params.get('state');
    if (code) {
      void fetch('/api/os/tiktok/oauth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ auth_code: code, state }),
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        const detail = typeof body.detail === 'string' ? body.detail : '';
        setMessageError(!res.ok);
        setMessage(res.ok ? 'TikTok connected.' : detail || 'TikTok connection failed. Admin access is required.');
        window.history.replaceState({}, '', '/connections');
        if (res.ok) {
          try {
            await syncSources();
            await load();
          } catch (err) {
            setMessageError(true);
            setMessage(err instanceof Error ? err.message : 'Sync did not finish.');
          }
        }
      });
    }
    void load();
  }, []);

  async function connectTikTok() {
    const res = await fetch('/api/os/tiktok/oauth', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) {
      const detail = typeof body.detail === 'string' ? body.detail : '';
      setMessageError(true);
      setMessage(detail || 'TikTok connection failed. Admin access is required.');
      return;
    }
    window.location.assign(body.url);
  }

  async function saveFx() {
    const res = await fetch('/api/os/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fx_usd_aed: Number(fx) }),
    });
    setMessageError(!res.ok);
    setMessage(res.ok ? 'Rate saved.' : 'Save failed. Admin access is required.');
  }

  async function syncNow() {
    if (syncing) return;
    setSyncing(true);
    setMessageError(false);
    setMessage('Refreshing sources…');
    try {
      await syncSources((seconds) => setMessage(`Refreshing sources… ${seconds}s`));
      await load();
      setMessageError(false);
      setMessage('Sources refreshed.');
    } catch (err) {
      setMessageError(true);
      setMessage(err instanceof Error ? err.message : 'Sync did not finish. Try again.');
    } finally {
      setSyncing(false);
    }
  }

  const byName = new Map(connectors.map((item) => [item.name, item]));
  const listed = new Set<string>([...PAID_LEAD, ...PAID_ALSO]);
  const extra = connectors.map((item) => item.name).filter((name) => !listed.has(name));
  const paidGroups = [
    { label: 'Primary', names: [...PAID_LEAD] },
    { label: 'Also in market', names: [...PAID_ALSO, ...extra] },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="dash-eyebrow">Connections</p>
          <h1 className="dash-title">Sources</h1>
          <p className="dash-desc">Keys stay on the marketing API. Sources refresh twice a day. Sync now is the extra check.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button type="button" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 disabled:opacity-60" onClick={() => void syncNow()} disabled={syncing}>
            <Icon.refresh className={cx('h-4 w-4', syncing && 'animate-spin')} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
          {message ? <p className={cx('max-w-sm text-right text-sm', messageError ? 'text-red-700' : 'text-brand-dark-gray')}>{message}</p> : null}
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Paid channels</h2>
          <p className="mt-1 text-xs text-brand-medium-gray">Meta, Google Ads, and LinkedIn lead. The other ad accounts stay listed.</p>
        </div>
        {paidGroups.map((group) => (
          <div key={group.label}>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-dark-gray">{group.label}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {group.names.map((name) => {
                const item = byName.get(name);
                return (
                  <SourceCard
                    key={name}
                    title={name}
                    state={item?.state}
                    detail={item?.detail || 'Not checked yet.'}
                    action={name === 'TikTok' ? { label: 'Connect TikTok', onClick: () => void connectTikTok() } : null}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {DASHBOARD_SECTIONS.map((section) => (
        <section key={section.id} className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="mt-1 text-xs text-brand-medium-gray">{section.summary}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {section.sources.map((source) => {
              const block = site[source.id];
              return <SourceCard key={source.id} title={source.title} state={block?.state} detail={block?.detail || source.role} />;
            })}
          </div>
        </section>
      ))}

      <div className="dash-panel flex flex-wrap items-end gap-3 p-5">
        <label className="text-sm">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">USD / AED</span>
          <input className="w-32 rounded-lg border border-brand-medium-gray/40 px-3 py-2 tabular-nums" value={fx} onChange={(e) => setFx(e.target.value)} />
        </label>
        <button type="button" className="btn-primary px-4 py-2" onClick={() => void saveFx()}>Save rate</button>
      </div>
    </div>
  );
}

function SourceCard({
  title,
  state,
  detail,
  action,
}: {
  title: string;
  state?: string;
  detail: string;
  action?: { label: string; onClick: () => void } | null;
}) {
  return (
    <div className="dash-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs font-semibold uppercase text-brand-burgundy">{state || 'waiting'}</span>
      </div>
      <p className="mt-2 text-sm text-brand-dark-gray">{detail}</p>
      {action ? (
        <button type="button" className="mt-3 text-xs font-semibold text-brand-burgundy" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
