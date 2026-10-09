'use client';

import { useEffect, useState } from 'react';

import { aed, monthLabel } from '@/lib/os/types';

type Budget = {
  month: string;
  channel: string;
  budget_aed: number | null;
  approval?: string;
  note?: string;
};

const APPROVALS = ['Proposed', 'Approved', 'Draft'];

export default function BudgetsPage() {
  const [month, setMonth] = useState('2026-09');
  const [months, setMonths] = useState<string[]>([]);
  const [items, setItems] = useState<Budget[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch('/api/os/budgets', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load budgets');
        const body = await res.json();
        const rows: Budget[] = body.items ?? [];
        const unique = [...new Set(rows.map((row) => row.month))].sort();
        setMonths(unique);
        setMonth((current) => (unique.includes(current) ? current : unique.at(-1) || current));
        setItems(rows);
      })
      .catch((err: Error) => setMessage(err.message));
  }, []);

  const visible = items.filter((item) => item.month === month);
  const known = visible.filter((item) => item.budget_aed != null);
  const total = known.reduce((sum, item) => sum + (item.budget_aed ?? 0), 0);
  const complete = known.length > 0;

  function update(channel: string, patch: Partial<Budget>) {
    setItems((current) =>
      current.map((item) => (item.month === month && item.channel === channel ? { ...item, ...patch } : item)),
    );
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/os/budgets', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(visible),
      });
      setMessage(res.ok ? 'Budgets saved.' : 'Save failed. Admin access is required.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="dash-eyebrow">Budgets</p>
          <h1 className="dash-title">Monthly plan</h1>
          <p className="dash-desc">These ceilings are what the dashboard compares spend against. They do not change the ad platforms.</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">Planned</div>
          <div className="text-xl font-semibold tabular-nums text-brand-black">{complete ? aed(total) : '—'}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {months.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMonth(item)}
            className={month === item ? 'nav-link-active' : 'nav-link'}
          >
            {monthLabel(item)}
          </button>
        ))}
      </div>

      <div className="dash-panel overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="text-left text-[10px] uppercase tracking-wider text-brand-medium-gray">
            <tr>
              {['Channel', 'Budget AED', 'Approval', 'Note'].map((heading) => (
                <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.channel} className="border-t border-brand-light-gray">
                <td className="px-4 py-3 font-semibold">{item.channel}</td>
                <td className="px-4 py-3">
                  <input
                    className="w-32 rounded-lg border border-brand-medium-gray/40 px-2 py-1 tabular-nums"
                    inputMode="decimal"
                    value={item.budget_aed ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value;
                      update(item.channel, { budget_aed: raw === '' ? null : Number(raw) });
                    }}
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-lg border border-brand-medium-gray/40 bg-white px-2 py-1"
                    value={item.approval || 'Proposed'}
                    onChange={(event) => update(item.channel, { approval: event.target.value })}
                  >
                    {APPROVALS.map((approval) => (
                      <option key={approval} value={approval}>{approval}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    className="w-full min-w-[12rem] rounded-lg border border-brand-medium-gray/40 px-2 py-1"
                    value={item.note || ''}
                    onChange={(event) => update(item.channel, { note: event.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" className="btn-primary px-5 py-2.5" disabled={saving} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save budgets'}
      </button>
      {message ? <p className="text-sm text-brand-dark-gray">{message}</p> : null}
    </div>
  );
}
