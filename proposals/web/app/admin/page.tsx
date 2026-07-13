'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { api, fmtDate, fmtMoney, STATUS_STYLES } from '@/lib/api';
import type { Proposal } from '@/lib/types';
import { useMe } from '../shell';

type Activity = {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  proposal_id?: string;
  details: string;
};

type Profile = {
  user_id: string;
  username?: string;
  email?: string;
  role?: string;
  name: string;
  phone: string;
  whatsapp: string;
  signature_text: string;
};

export default function AdminPage() {
  const me = useMe();
  const [tab, setTab] = useState<'overview' | 'activity' | 'salespeople'>('overview');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, a, pr] = await Promise.all([
        api<{ proposals: Proposal[] }>('?all=1&limit=200'),
        api<{ activity: Activity[] }>('/activity?limit=100'),
        api<{ profiles: Profile[] }>('/user-profiles'),
      ]);
      setProposals(p.proposals);
      setActivity(a.activity);
      setProfiles(pr.profiles);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (me?.is_admin) void load();
  }, [me, load]);

  if (!me?.is_admin) {
    return <div className="card p-8 text-sm text-gray-600">The admin dashboard is admin-only.</div>;
  }

  const byStatus = proposals.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});
  const totalValue = proposals
    .filter((p) => p.status !== 'rejected' && p.status !== 'archived')
    .reduce((sum, p) => sum + (p.pricing?.total || 0), 0);

  async function saveProfile(p: Profile) {
    setSavingId(p.user_id);
    try {
      await api(`/user-profiles/${p.user_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: p.name,
          phone: p.phone,
          email: p.email,
          whatsapp: p.whatsapp,
          signature_text: p.signature_text,
        }),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingId('');
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Admin</h1>
      <p className="mb-6 text-sm text-gray-500">
        All proposals, activity history and salesperson contact blocks.
      </p>

      {error && <div className="card mb-4 border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {(
          [
            ['overview', 'All Proposals'],
            ['activity', 'Activity'],
            ['salespeople', 'Salespeople'],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t
                ? 'border-b-2 border-brand-burgundy text-brand-burgundy'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Total proposals" value={String(proposals.length)} />
            <StatCard label="Pipeline value" value={fmtMoney(totalValue)} />
            {['draft', 'sent', 'approved', 'rejected'].map((s) => (
              <StatCard key={s} label={s[0].toUpperCase() + s.slice(1)} value={String(byStatus[s] || 0)} />
            ))}
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/proposals/${p.id}`} className="font-medium text-brand-burgundy hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{p.created_by_name || '—'}</td>
                    <td className="px-4 py-3">{p.customer?.name || '—'}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtMoney(p.pricing?.total, p.pricing?.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase ${STATUS_STYLES[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'activity' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">
                    {new Date(a.timestamp).toLocaleString('en-GB')}
                  </td>
                  <td className="px-4 py-2.5">{a.username}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px]">{a.action}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {a.proposal_id ? (
                      <Link href={`/proposals/${a.proposal_id}`} className="hover:underline">
                        {a.details}
                      </Link>
                    ) : (
                      a.details
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'salespeople' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Contact blocks are inserted automatically into each user&apos;s new proposals.
          </p>
          {profiles.map((p) => (
            <div key={p.user_id} className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <span className="font-medium">{p.username || p.email}</span>
                  <span className="ml-2 text-xs uppercase text-gray-400">{p.role}</span>
                </div>
                <button
                  className="btn-secondary text-xs"
                  disabled={savingId === p.user_id}
                  onClick={() => void saveProfile(p)}
                >
                  {savingId === p.user_id ? 'Saving…' : 'Save'}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    ['name', 'Display name'],
                    ['phone', 'Phone'],
                    ['whatsapp', 'WhatsApp'],
                    ['signature_text', 'Signature text'],
                  ] as [keyof Profile, string][]
                ).map(([k, label]) => (
                  <div key={String(k)}>
                    <label className="label">{label}</label>
                    <input
                      className="input"
                      value={(p[k] as string) || ''}
                      onChange={(e) =>
                        setProfiles((prev) =>
                          prev.map((x) => (x.user_id === p.user_id ? { ...x, [k]: e.target.value } : x))
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
