'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { api, fmtDate, fmtMoney, STATUS_STYLES } from '@/lib/api';
import type { Proposal } from '@/lib/types';
import { useMe } from './shell';

const STATUSES = ['', 'draft', 'sent', 'approved', 'rejected', 'archived'];

export default function ProposalsListPage() {
  const me = useMe();
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (showAll) params.set('all', '1');
      const res = await api<{ proposals: Proposal[] }>(`?${params.toString()}`);
      setProposals(res.proposals);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [search, status, showAll]);

  useEffect(() => {
    void load();
  }, [load]);

  async function duplicate(id: string) {
    setBusyId(id);
    try {
      const copy = await api<Proposal>(`/${id}/duplicate`, { method: 'POST' });
      router.push(`/proposals/${copy.id}`);
    } catch (e) {
      alert(`Duplicate failed: ${(e as Error).message}`);
    } finally {
      setBusyId('');
    }
  }

  async function setProposalStatus(id: string, newStatus: string) {
    setBusyId(id);
    try {
      await api(`/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      await load();
    } catch (e) {
      alert(`Status change failed: ${(e as Error).message}`);
    } finally {
      setBusyId('');
    }
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="dash-eyebrow">Proposals</p>
          <h1 className="dash-title">Your proposals</h1>
          <p className="dash-desc mt-3 max-w-2xl">
            Create, edit and export branded customer proposals.
          </p>
        </div>
        <Link href="/new" className="btn-primary shrink-0">
          + New Proposal
        </Link>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search title, customer, project…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load()}
        />
        <select className="input max-w-[160px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s ? s[0].toUpperCase() + s.slice(1) : 'All statuses'}
            </option>
          ))}
        </select>
        {me?.is_admin && (
          <label className="flex items-center gap-2 text-sm text-brand-dark-gray">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            All users
          </label>
        )}
      </div>

      {error && (
        <div className="dash-panel mb-4 border-red-200 bg-red-50">
          <div className="dash-panel-body text-sm text-red-700">{error}</div>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-brand-dark-gray">Loading proposals…</div>
      ) : proposals.length === 0 ? (
        <div className="dash-panel">
          <div className="dash-panel-body py-12 text-center">
            <p className="mb-4 text-brand-dark-gray">No proposals yet.</p>
            <Link href="/new" className="btn-primary">
              Create your first proposal
            </Link>
          </div>
        </div>
      ) : (
        <div className="dash-panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-medium-gray/20 text-left text-xs uppercase tracking-wide text-brand-dark-gray">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Project</th>
                {showAll && <th className="px-4 py-3">Owner</th>}
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="border-b border-brand-medium-gray/10 last:border-0 hover:bg-brand-burgundy/[0.03]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/proposals/${p.id}`}
                      className="font-medium text-brand-burgundy hover:underline"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{p.customer?.name || '—'}</td>
                  <td className="px-4 py-3">{p.project?.name || '—'}</td>
                  {showAll && <td className="px-4 py-3">{p.created_by_name || '—'}</td>}
                  <td className="px-4 py-3 tabular-nums">
                    {fmtMoney(p.pricing?.total, p.pricing?.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${STATUS_STYLES[p.status] || ''}`}
                      value={p.status}
                      disabled={busyId === p.id}
                      onChange={(e) => void setProposalStatus(p.id, e.target.value)}
                    >
                      {STATUSES.filter(Boolean).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-brand-dark-gray">{fmtDate(p.updated_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/proposals/${p.id}`} className="btn-ghost px-2 py-1 text-xs">
                        Edit
                      </Link>
                      <button
                        className="btn-ghost px-2 py-1 text-xs"
                        disabled={busyId === p.id}
                        onClick={() => void duplicate(p.id)}
                      >
                        Duplicate
                      </button>
                      {p.pdf_key && (
                        <a
                          className="btn-ghost px-2 py-1 text-xs"
                          href={`/api/proposals/${p.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          PDF
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
