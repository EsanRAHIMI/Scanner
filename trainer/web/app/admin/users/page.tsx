'use client';

import * as React from 'react';

import { apiFetch } from '@/lib/api';

type UserRow = {
  id: string;
  email: string;
  username: string;
  status: 'pending' | 'approved' | 'disabled';
  is_admin: boolean;
  permissions: string[];
  created_at?: string;
  updated_at?: string;
};

export default function AdminUsersPage() {
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [users, setUsers] = React.useState<UserRow[]>([]);

  React.useEffect(() => {
    let canceled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const meRes = await apiFetch('/auth/me');
        const meText = await meRes.text();
        if (!meRes.ok) {
          throw new Error(meText || `Failed to load session (${meRes.status})`);
        }
        const me = JSON.parse(meText) as { is_admin?: boolean };
        if (!me.is_admin) {
          window.location.href = '/trainer';
          return;
        }

        const res = await apiFetch('/admin/users');
        const text = await res.text();
        if (!res.ok) {
          throw new Error(text || `Failed to load users (${res.status})`);
        }
        const data = JSON.parse(text) as { users?: UserRow[] };
        const list = Array.isArray(data.users) ? data.users : [];
        if (!canceled) {
          setUsers(list);
        }
      } catch (e) {
        if (!canceled) {
          setError(e instanceof Error ? e.message : 'Failed to load users');
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  function setUserPatch(id: string, patch: Partial<UserRow>) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  async function saveUser(u: UserRow) {
    setError(null);
    setSavingId(u.id);
    try {
      const res = await apiFetch(`/admin/users/${encodeURIComponent(u.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: u.status,
          is_admin: u.is_admin,
          permissions: u.permissions,
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `Update failed (${res.status})`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Users</div>
          <div className="mt-1 text-sm text-black/60">Approve users and manage permissions.</div>
        </div>
      </div>

      {error ? <div className="mt-4 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="mt-6 text-sm text-black/60">Loading...</div>
      ) : (
        <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-black/10 text-xs text-black/60">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-black/5 last:border-b-0">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{u.email}</div>
                    <div className="mt-1 text-xs text-black/50">{u.id}</div>
                  </td>
                  <td className="px-4 py-3 align-top">{u.username}</td>
                  <td className="px-4 py-3 align-top">
                    <select
                      className="w-full rounded-md border border-black/15 bg-white px-2 py-1"
                      value={u.status}
                      onChange={(e) => setUserPatch(u.id, { status: e.target.value as UserRow['status'] })}
                    >
                      <option value="pending">pending</option>
                      <option value="approved">approved</option>
                      <option value="disabled">disabled</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={u.is_admin}
                        onChange={(e) => setUserPatch(u.id, { is_admin: e.target.checked })}
                      />
                      <span className="text-xs text-black/70">is_admin</span>
                    </label>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      className="w-full rounded-md border border-black/15 bg-white px-2 py-1"
                      value={u.permissions.join(', ')}
                      onChange={(e) => {
                        const perms = e.target.value
                          .split(',')
                          .map((p) => p.trim())
                          .filter((p) => p.length > 0);
                        setUserPatch(u.id, { permissions: perms });
                      }}
                      placeholder="comma,separated,permissions"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <button
                      className="rounded-md bg-black px-3 py-2 text-xs text-white hover:bg-black/90 disabled:opacity-60"
                      disabled={savingId === u.id}
                      onClick={() => saveUser(u)}
                    >
                      {savingId === u.id ? 'Saving...' : 'Save'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
