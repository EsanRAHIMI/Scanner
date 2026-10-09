'use client';

import { useEffect, useState } from 'react';

type Target = {
  channel: string;
  metric: string;
  target: number | null;
  direction?: string;
  unit?: string;
};

export default function TargetsPage() {
  const [items, setItems] = useState<Target[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/os/targets', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load targets');
        const body = await res.json();
        setItems(body.items ?? []);
      })
      .catch((err: Error) => setMessage(err.message));
  }, []);

  async function save() {
    const res = await fetch('/api/os/targets', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(items),
    });
    setMessage(res.ok ? 'Targets saved.' : 'Save failed. Admin access is required.');
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="dash-eyebrow">Targets</p>
        <h1 className="dash-title">30-day experimental goals</h1>
        <p className="dash-desc">These are management targets. They do not change platform delivery.</p>
      </div>
      <div className="dash-panel overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="text-left text-[10px] uppercase tracking-wider text-brand-medium-gray">
            <tr>
              {['Channel', 'Metric', 'Target', 'Unit'].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.channel}:${item.metric}`} className="border-t border-brand-light-gray">
                <td className="px-4 py-3">{item.channel}</td>
                <td className="px-4 py-3">{item.metric}</td>
                <td className="px-4 py-3">
                  <input
                    className="w-28 rounded-lg border border-brand-medium-gray/40 px-2 py-1 tabular-nums"
                    value={item.target ?? ''}
                    onChange={(event) => {
                      const next = [...items];
                      const raw = event.target.value;
                      next[index] = { ...item, target: raw === '' ? null : Number(raw) };
                      setItems(next);
                    }}
                  />
                </td>
                <td className="px-4 py-3 text-brand-dark-gray">{item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn-primary px-5 py-2.5" onClick={() => void save()}>Save targets</button>
      {message ? <p className="text-sm text-brand-dark-gray">{message}</p> : null}
    </div>
  );
}
