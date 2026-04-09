'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

import { apiFetch } from '@/lib/api';
import { useProductsCache } from '../products-cache-provider';
import type { ProductsRecord } from '@/types/trainer';

async function logFrontendEvent(action: string, details: string = '', resourceId?: string) {
  try {
    await apiFetch('/admin/log-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, details, resource_id: resourceId }),
    });
  } catch (e) {
    console.error('[Logging] Failed:', e);
  }
}

function ActivityLogModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [skip, setSkip] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState('');

  const limit = 50;

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        skip: String(skip),
        ...(search && { search }),
        ...(actionFilter && { action: actionFilter }),
      });
      const res = await apiFetch(`/admin/activity-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch (e) {
      console.error('Failed to fetch logs', e);
    } finally {
      setLoading(false);
    }
  }, [skip, search, actionFilter]);

  React.useEffect(() => {
    if (isOpen) fetchLogs();
  }, [isOpen, fetchLogs]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex h-full max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-black/10 p-4 dark:border-white/10">
          <h2 className="text-xl font-bold text-black dark:text-white">Activity Logs</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/5">
            <svg className="h-6 w-6 text-black/60 dark:text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.02]">
          <input
            type="text"
            placeholder="Search users, IPs, details..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSkip(0); }}
            className="h-10 flex-1 min-w-[200px] rounded-lg border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-zinc-800"
          />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setSkip(0); }}
            className="h-10 rounded-lg border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-zinc-800"
          >
            <option value="">All Actions</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
            <option value="PRODUCT_EDIT">Product Edit</option>
            <option value="PRODUCT_DOWNLOAD">Download</option>
            <option value="PRODUCT_SHARE">Share</option>
            <option value="USER_UPDATE">Admin: User Update</option>
          </select>
          <div className="text-sm font-medium text-black/40 dark:text-white/40">Total: {total}</div>
        </div>

        <div className="scrollbar-minimal flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-black/[0.03] text-black/60 dark:bg-white/[0.03] dark:text-white/60">
                <tr>
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                  <th className="px-4 py-3 font-semibold">IP / Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-black/50 dark:text-white/50">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-black dark:text-white">{log.username}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        log.action === 'LOGIN' ? 'bg-emerald-500/10 text-emerald-600' :
                        log.action === 'LOGOUT' ? 'bg-orange-500/10 text-orange-600' :
                        log.action === 'PRODUCT_EDIT' ? 'bg-blue-500/10 text-blue-600' :
                        'bg-zinc-500/10 text-zinc-600'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-black/80 dark:text-white/80">{log.details}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-mono text-black/40 dark:text-white/40">{log.ip_address}</div>
                      <div className="mt-0.5 text-[10px] text-black/30 dark:text-white/30">{log.device}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-black/10 p-4 dark:border-white/10">
          <button
            disabled={skip === 0}
            onClick={() => setSkip(Math.max(0, skip - limit))}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-30 dark:border-white/10 dark:hover:bg-white/5"
          >
            Previous
          </button>
          <div className="text-xs text-black/40 dark:text-white/40">
            Showing {skip + 1} to {Math.min(skip + limit, total)} of {total}
          </div>
          <button
            disabled={skip + limit >= total}
            onClick={() => setSkip(skip + limit)}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-30 dark:border-white/10 dark:hover:bg-white/5"
          >
            Next
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TopProgressBar({ loading }: { loading: boolean }) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (loading) {
      const t = setTimeout(() => setVisible(true), 200);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(t);
    }
  }, [loading]);

  if (!visible) return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-[2000] h-0.5 overflow-hidden bg-emerald-500/10">
      <div
        className={`h-full bg-emerald-500 transition-all duration-500 ease-out ${
          loading ? 'w-[70%] animate-pulse' : 'w-full opacity-0'
        }`}
      />
    </div>
  );
}

function ProductsSkeleton({ viewMode, rowsOnly }: { viewMode: 'gallery' | 'list'; rowsOnly?: boolean }) {
  if (viewMode === 'list') {
    const rows = [...Array(10)].map((_, i) => (
      <tr key={i} className="animate-pulse border-t border-black/10 dark:border-white/10">
        {[...Array(6)].map((_, j) => (
          <td key={j} className="px-4 py-3">
            <div className="h-4 w-full rounded bg-black/5 dark:bg-white/5" />
          </td>
        ))}
      </tr>
    ));

    if (rowsOnly) return <>{rows}</>;

    return (
      <div className="w-full space-y-4 p-4">
        <table className="w-full">
          <tbody>{rows}</tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="animate-pulse space-y-3 overflow-hidden rounded-xl bg-black/[0.03] pb-3 dark:bg-white/[0.03]">
          <div className="aspect-square bg-black/5 dark:bg-white/5" />
          <div className="space-y-2 px-3">
            <div className="h-4 w-3/4 rounded bg-black/5 dark:bg-white/5" />
            <div className="h-3 w-1/2 rounded bg-black/5 dark:bg-white/5" />
            <div className="flex justify-between pt-1">
              <div className="h-3 w-1/4 rounded bg-black/5 dark:bg-white/5" />
              <div className="h-3 w-1/4 rounded bg-black/5 dark:bg-white/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type AuthMe = {
  email: string;
  username: string;
  is_admin: boolean;
  permissions: string[];
};

function AccountMenu({ onAuthChange }: { onAuthChange?: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [me, setMe] = React.useState<AuthMe | null>(null);
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [email, setEmail] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [registerDone, setRegisterDone] = React.useState<{ status: string; user_id: string } | null>(null);

  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onMouseDown(e: MouseEvent) {
      const el = menuRef.current;
      if (!el) return;
      if (open && e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [open]);

  async function loadMe() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/auth/me');
      if (res.status === 401) {
        setMe(null);
        return;
      }
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Failed to load user (${res.status})`);
      const data = JSON.parse(text) as { email?: string; username?: string; is_admin?: boolean; permissions?: unknown };
      const perms = Array.isArray(data.permissions) ? data.permissions.filter((p): p is string => typeof p === 'string') : [];
      if (!data.email || !data.username) throw new Error('Invalid /auth/me response');
      setMe({ email: data.email, username: data.username, is_admin: Boolean(data.is_admin), permissions: perms });
    } catch (e) {
      setMe(null);
      setError(e instanceof Error ? e.message : 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }

  async function onToggle() {
    const next = !open;
    setOpen(next);
    setError(null);
    if (next) {
      setRegisterDone(null);
      await loadMe();
    }
  }

  async function onLogout() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/auth/logout', { method: 'POST' });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Logout failed (${res.status})`);
      setMe(null);
      setMode('login');
      onAuthChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Logout failed');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await apiFetch('/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(text || `Login failed (${res.status})`);
        await loadMe();
        setOpen(false);
        onAuthChange?.();
        return;
      }

      const res = await apiFetch('/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Register failed (${res.status})`);
      const data = JSON.parse(text) as { status: string; user_id: string };
      setRegisterDone({ status: data.status, user_id: data.user_id });
    } catch (e) {
      setError(e instanceof Error ? e.message : mode === 'login' ? 'Login failed' : 'Register failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/50 text-black/60 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 hover:text-black hover:shadow-md active:scale-95 dark:border-white/10 dark:bg-black/40 dark:text-white/60 dark:hover:bg-black/60 dark:hover:text-white"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Account"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/70"
          role="menu"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-14 w-full rounded-lg bg-black/5 dark:bg-white/5" />
              <div className="h-10 w-full rounded-md bg-black/5 dark:bg-white/5" />
            </div>
          ) : null}

          {!loading && me ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-black/10 bg-black/5 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="text-xs text-black/60 dark:text-white/60">Signed in as</div>
                <div className="mt-1 text-sm font-medium text-black dark:text-white">{me.username}</div>
                <div className="text-xs text-black/70 dark:text-white/70">{me.email}</div>
              </div>

              {error ? <div className="text-sm text-red-700 dark:text-red-200">{error}</div> : null}

              {me.is_admin && (
                <>
                  <a
                    href={typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
                      ? "http://localhost:3010/admin/users" 
                      : "/trainer/admin/users"
                    }
                    className="block w-full rounded-md border border-black/10 px-4 py-2 text-center text-sm font-medium text-black hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
                    role="menuitem"
                  >
                    Manage users
                  </a>
                  <button
                    onClick={() => { (window as any)._toggleActivityLogs?.(); setOpen(false); }}
                    className="mt-2 block w-full rounded-md border border-black/10 px-4 py-2 text-center text-sm font-medium text-black hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
                    role="menuitem"
                  >
                    Activity Logs
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={onLogout}
                disabled={loading}
                className="w-full rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/90 disabled:opacity-60"
                role="menuitem"
              >
                Logout
              </button>
            </div>
          ) : null}

          {!loading && !me ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setRegisterDone(null);
                    setError(null);
                  }}
                  className={
                    'flex-1 rounded-md px-3 py-2 text-sm font-medium border ' +
                    (mode === 'login'
                      ? 'border-black/20 bg-black text-white dark:border-white/15'
                      : 'border-black/15 bg-transparent text-black/70 hover:bg-black/5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/5')
                  }
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setRegisterDone(null);
                    setError(null);
                  }}
                  className={
                    'flex-1 rounded-md px-3 py-2 text-sm font-medium border ' +
                    (mode === 'register'
                      ? 'border-black/20 bg-black text-white dark:border-white/15'
                      : 'border-black/15 bg-transparent text-black/70 hover:bg-black/5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/5')
                  }
                >
                  Register
                </button>
              </div>

              {registerDone ? (
                <div className="rounded-lg border border-black/10 bg-black/5 p-3 text-sm text-black/80 dark:border-white/10 dark:bg-white/5 dark:text-white/75">
                  Status: <span className="font-medium">{registerDone.status}</span>
                </div>
              ) : (
                <form className="space-y-2" onSubmit={onSubmit}>
                  <div className="space-y-1">
                    <label className="text-xs text-black/60 dark:text-white/60">Email</label>
                    <input
                      className="h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm dark:border-white/15 dark:bg-black/25 dark:text-white"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      autoComplete="email"
                      required
                    />
                  </div>

                  {mode === 'register' ? (
                    <div className="space-y-1">
                      <label className="text-xs text-black/60 dark:text-white/60">Username</label>
                      <input
                        className="h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm dark:border-white/15 dark:bg-black/25 dark:text-white"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        type="text"
                        autoComplete="username"
                        required
                      />
                    </div>
                  ) : null}

                  <div className="space-y-1">
                    <label className="text-xs text-black/60 dark:text-white/60">Password</label>
                    <input
                      className="h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm dark:border-white/15 dark:bg-black/25 dark:text-white"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      required
                    />
                  </div>

                  {error ? <div className="text-sm text-red-700 dark:text-red-200">{error}</div> : null}

                  <button
                    className="w-full rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/90 disabled:opacity-60"
                    disabled={loading}
                    type="submit"
                  >
                    {mode === 'login' ? (loading ? 'Logging in...' : 'Login') : loading ? 'Creating...' : 'Create account'}
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FilterDropdown({
  id,
  title,
  options,
  selected,
  activeDropdown,
  setActiveDropdown,
  onChange,
}: {
  id: string;
  title: string;
  options: string[];
  selected: Set<string>;
  activeDropdown: string | null;
  setActiveDropdown: (id: string | null) => void;
  onChange: (val: Set<string>) => void;
}) {
  const [search, setSearch] = React.useState('');
  const isOpen = activeDropdown === id;
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
      setSearch('');
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setActiveDropdown]);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  const toggleOption = (opt: string) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(next);
  };

  const clear = () => {
    onChange(new Set());
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setActiveDropdown(isOpen ? null : id)}
        className={`flex h-[24px] items-center gap-1.5 rounded border px-2.5 py-0 font-medium transition-all ${selected.size > 0
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/80'
            : 'border-black/10 bg-black/5 text-black/60 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10'
          }`}
      >
        <span className="text-[10px] uppercase tracking-wider">{title}</span>
        {selected.size > 0 ? (
          <span className="flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white">
            {selected.size}
          </span>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 opacity-40" stroke="currentColor" strokeWidth="3">
            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-[110] mt-1 w-[220px] rounded-lg border border-black/10 bg-white p-2 shadow-xl dark:border-white/20 dark:bg-black/90 dark:backdrop-blur-xl">
          <div className="mb-2">
            <input
              autoFocus
              className="w-full rounded border border-black/10 bg-black/5 px-2 py-1 text-[11px] outline-none dark:border-white/10 dark:bg-white/5"
              placeholder={`Search ${title}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="scrollbar-minimal max-h-[220px] overflow-y-auto pr-1">
            {filteredOptions.length === 0 ? (
              <div className="py-2 text-center text-[10px] italic text-black/40 dark:text-white/40">No options found</div>
            ) : (
              filteredOptions.map((opt) => (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 cursor-pointer rounded border-black/20 accent-emerald-600 dark:border-white/20"
                    checked={selected.has(opt)}
                    onChange={() => toggleOption(opt)}
                  />
                  <span className="flex-1 truncate text-left text-[11px] text-black/80 dark:text-white/80">
                    {opt}
                  </span>
                </label>
              ))
            )}
          </div>
          {selected.size > 0 && (
            <div className="mt-2 border-t border-black/10 pt-2 dark:border-white/10">
              <button
                type="button"
                onClick={clear}
                className="w-full text-center text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
              >
                Clear Selections
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return '';
}

function extractUrls(v: unknown): string[] {
  if (typeof v === 'string') {
    const parts = v.split(/[\s,\n]+/).map((s) => s.trim()).filter(Boolean);
    return parts.filter((s) => /^https?:\/\//i.test(s));
  }
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      if (typeof item === 'string') {
        const s = item.trim();
        if (/^https?:\/\//i.test(s)) out.push(s);
      } else if (item && typeof item === 'object') {
        const maybe = (item as Record<string, unknown>).url;
        if (typeof maybe === 'string') {
          const s = maybe.trim();
          if (/^https?:\/\//i.test(s)) out.push(s);
        }
      }
    }
    return out;
  }
  if (v && typeof v === 'object') {
    const maybe = (v as Record<string, unknown>).url;
    if (typeof maybe === 'string') {
      const s = maybe.trim();
      return /^https?:\/\//i.test(s) ? [s] : [];
    }
  }
  return [];
}

function getDriveDirectLink(url: string): string {
  if (!url) return '';
  const u = url.trim();
  if (!u.includes('drive.google.com') && !u.includes('google.com/file/d/') && !u.includes('googleusercontent.com')) return u;

  // If it's already a direct link we generated, return as is (but allow updating width)
  const lh3Match = u.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match && lh3Match[1]) {
    return `https://lh3.googleusercontent.com/d/${lh3Match[1]}=w1200`;
  }

  let id = '';
  // Pattern 1: /file/d/ID or /d/ID
  const matchD = u.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{25,})/);
  if (matchD && matchD[1]) {
    id = matchD[1];
  } else {
    // Pattern 2: ?id=ID or &id=ID or ?docid=ID
    const matchId = u.match(/[?&](?:id|fileId|docid|fileid)=([a-zA-Z0-9_-]{25,})/);
    if (matchId && matchId[1]) {
      id = matchId[1];
    }
  }

  if (id) {
    // Return high-performance direct link (w1200 for better preview quality)
    return `https://lh3.googleusercontent.com/d/${id}=w1200`;
  }
  return u;
}

function formatPrice(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('en-US').format(value);
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;

    const cleaned = raw.replace(/,/g, '');
    const n = Number(cleaned);
    if (Number.isFinite(n)) return new Intl.NumberFormat('en-US').format(n);
  }
  return null;
}


const SPACE_OPTIONS = ['Corner', 'Corridor', 'Entrance', 'Staircase', 'Living Room', 'Dining Room', 'Bedroom', 'Kitchen', 'Commercial', 'Bathroom'];
const CATEGORY_OPTIONS = ['Chandeliers', 'Pendant', 'Cascade Light', 'Floor Lamps', 'Long Chandeliers', 'Ring Chandeliers', 'Wall Light', 'Table Lamps', 'Accessories', 'Sofa & Seating', 'Table', 'Wall Decoration'];
const COLOR_OPTIONS = ['Transparent', 'Chrome', 'White', 'Black', 'Bronze', 'Blue', 'Gold', 'Pink'];
const MATERIAL_OPTIONS = ['Stone', 'Fabric', 'Metal', 'Glass', 'Wood'];

const getTagColorStyles = (color: string) => {
  const c = color.toLowerCase().trim();
  switch (c) {
    case 'transparent':
      return 'border-zinc-200 bg-zinc-50/50 text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60';
    case 'chrome':
      return 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300';
    case 'white':
      return 'border-zinc-200 bg-white text-zinc-800 dark:border-zinc-300 dark:bg-zinc-100 dark:text-zinc-900';
    case 'black':
      return 'border-zinc-800 bg-zinc-900 text-white dark:border-zinc-700 dark:bg-black dark:text-zinc-400';
    case 'bronze':
      return 'border-[#964B00]/20 bg-[#964B00]/10 text-[#964B00] dark:border-[#CD7F32]/20 dark:bg-[#CD7F32]/10 dark:text-[#CD7F32]';
    case 'blue':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/20 dark:bg-blue-900/30 dark:text-blue-300';
    case 'gold':
      return 'border-amber-300/50 bg-amber-50 text-amber-700 dark:border-amber-800/20 dark:bg-amber-900/30 dark:text-amber-300';
    case 'pink':
      return 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-800/20 dark:bg-pink-900/30 dark:text-pink-300';
    default:
      return 'border-sky-500/20 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-900/25 dark:text-sky-300';
  }
};

const getTagMaterialStyles = (material: string) => {
  const m = material.toLowerCase().trim();
  switch (m) {
    case 'stone':
      return 'border-stone-200 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-300';
    case 'fabric':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/20 dark:bg-indigo-900/30 dark:text-indigo-300';
    case 'metal':
      return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300';
    case 'glass':
      return 'border-cyan-200/50 bg-cyan-50/50 text-cyan-700 dark:border-cyan-800/20 dark:bg-cyan-900/30 dark:text-cyan-300';
    case 'wood':
      return 'border-orange-200 bg-orange-50 text-orange-900/80 dark:border-orange-800/20 dark:bg-orange-900/30 dark:text-orange-300';
    default:
      return 'border-amber-500/20 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-900/25 dark:text-amber-300';
  }
};

export function ProductsView({
  title = 'Products',
  titleNode,
  mobileTitleNode,
}: {
  title?: string;
  titleNode?: React.ReactNode;
  mobileTitleNode?: React.ReactNode;
}) {
  const [showActivityLogs, setShowActivityLogs] = React.useState(false);
  React.useEffect(() => {
    (window as any)._toggleActivityLogs = () => setShowActivityLogs(v => !v);
  }, []);

  const { data, loading, error, setData } = useProductsCache();
  const [search, setSearch] = React.useState<string>('');
  const [showSelectedOnly, setShowSelectedOnly] = React.useState<boolean>(false);
  const [familyMode, setFamilyMode] = React.useState<'collection' | 'main'>('main');
  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');
  const [sortKey, setSortKey] = React.useState<string>('Num');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = React.useState<'list' | 'gallery'>('gallery');
  const [previewIndex, setPreviewIndex] = React.useState<number | null>(null);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [familyCollectionName, setFamilyCollectionName] = React.useState<string | null>(null);
  const [lightboxDetailsCollapsed, setLightboxDetailsCollapsed] = React.useState<boolean>(true);
  const [tableSwipeStart, setTableSwipeStart] = React.useState<{ x: number; y: number } | null>(null);
  const [imageLongPressTimer, setImageLongPressTimer] = React.useState<NodeJS.Timeout | null>(null);
  const [user, setUser] = React.useState<{ role: string; is_admin: boolean } | null>(null);
  const [editingUrl, setEditingUrl] = React.useState<{ id: string; value: string; originalValue?: string; column?: string; index?: number | null; mode?: 'replace' | 'append' | 'prepend'; rect?: { top: number; left: number; width: number; height: number } } | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedCategories, setSelectedCategories] = React.useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = React.useState<Set<string>>(new Set());
  const [selectedSpaces, setSelectedSpaces] = React.useState<Set<string>>(new Set());
  const [selectedMaterials, setSelectedMaterials] = React.useState<Set<string>>(new Set());
  const [activeFilterDropdown, setActiveFilterDropdown] = React.useState<string | null>(null);

  const fetchUserSession = React.useCallback(async () => {
    try {
      const res = await apiFetch('/auth/me');
      if (res.ok) {
        const json = await res.json();
        setUser({
          role: json.role || 'user',
          is_admin: Boolean(json.is_admin || json.role === 'admin')
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  React.useEffect(() => {
    void fetchUserSession();
  }, [fetchUserSession]);

  const hasInitializedMain = React.useRef(false);
  React.useEffect(() => {
    if (!loading && data?.records && data.records.length > 0 && !hasInitializedMain.current) {
      // Auto-initialize: mark the first record of each group as Main if the group doesn't have one.
      const groupHasMain = new Set<string>();
      const seenGroups = new Set<string>();

      const getCollectionKey = (fields: any) => {
        return (formatScalar(fields?.['Colecction Name']) || 
                formatScalar(fields?.Name) || 
                formatScalar(fields?.['Collection Name']) || 
                '').trim();
      };

      // Pass 1: find which groups already have a main variant
      for (const r of data.records) {
        const key = getCollectionKey(r.fields);
        if (key && r.fields?.Main === true) {
          groupHasMain.add(key);
        }
      }

      let changed = false;
      const nextRecords = data.records.map(r => {
        const key = getCollectionKey(r.fields);
        if (!key) return r;

        // If this group already has a true Main somewhere, do not auto-initialize any to true.
        // We ensure siblings that are undefined become false for consistent state.
        if (groupHasMain.has(key)) {
          if (r.fields?.Main === undefined) {
             changed = true;
             return { ...r, fields: { ...r.fields, Main: false } };
          }
          return r;
        }

        // Group has NO Main. Mark first one as true, others as false.
        if (seenGroups.has(key)) {
          changed = true;
          return { ...r, fields: { ...r.fields, Main: false } };
        }

        seenGroups.add(key);
        changed = true;
        return { ...r, fields: { ...r.fields, Main: true } };
      });

      if (changed) {
        setData({ ...data, records: nextRecords as any });
      }
      hasInitializedMain.current = true;
    }
  }, [data, loading, setData]);

  const canEdit = user?.is_admin || user?.role === 'admin' || user?.role === 'sales';

  const handleSaveField = async (recordId: string, fieldName: string, newValue: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const getCollectionKey = (f: any) => {
        return (formatScalar(f?.['Colecction Name']) || 
                formatScalar(f?.Name) || 
                formatScalar(f?.['Collection Name']) || 
                '').trim();
      };

      const targetRecord = data?.records?.find(r => r.id === recordId);
      const isMainProduct = targetRecord?.fields?.Main === true;
      const colLower = fieldName.trim().toLowerCase();
      const isPropagatableField = colLower === 'category' || colLower === 'space' || colLower === 'color' || colLower === 'material';

      // 1. Save the primary record
      const res = await fetch(`/api/products/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: { [fieldName]: newValue }
        })
      });
      if (!res.ok) throw new Error('Failed to save primary record');

      // 2. Identify variants for propagation if needed
      let propagatedIds: string[] = [];
      if (isMainProduct && isPropagatableField && data?.records) {
        const groupKey = getCollectionKey(targetRecord?.fields);
        const variantsToUpdate = data.records.filter(r => {
          if (r.id === recordId) return false;
          if (getCollectionKey(r.fields) !== groupKey) return false;
          const currentVal = formatScalar(r.fields?.[fieldName]) || '';
          return !currentVal.trim(); // Only propagate if empty
        });

        propagatedIds = variantsToUpdate.map(v => v.id);

        // Sync variants with server
        for (const variantId of propagatedIds) {
          try {
            await fetch(`/api/products/${variantId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fields: { [fieldName]: newValue } })
            });
          } catch (e) {
            console.error(`Failed to propagate to variant ${variantId}`, e);
          }
        }
      }

      // 3. Update local state for all modified records
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          records: prev.records.map(r => {
            if (r.id === recordId || propagatedIds.includes(r.id)) {
              return {
                ...r,
                fields: { ...r.fields, [fieldName]: newValue }
              };
            }
            return r;
          }) as any
        };
      });
      setEditingUrl(null);
    } catch (err) {
      alert('Error saving: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveUrl = async () => {
    if (!editingUrl || isSaving) return;
    setIsSaving(true);
    try {
      // Find the actual field name for URL
      const urlFieldName = columns.find(c => c.trim().toLowerCase() === 'url') || 'URL';

      let finalValueToSave = editingUrl.value;
      if (typeof editingUrl.index === 'number' && data?.records) {
        const record = data.records.find(r => r.id === editingUrl.id);
        if (record) {
          const currentFieldValue = String(record.fields[urlFieldName] || '');
          const urls = extractUrls(currentFieldValue);
          if (editingUrl.index >= 0 && editingUrl.index < urls.length) {
            urls[editingUrl.index] = editingUrl.value;
            finalValueToSave = urls.join('\n');
          }
        }
      } else if (editingUrl.mode === 'prepend' && data?.records) {
        const record = data.records.find(r => r.id === editingUrl.id);
        const currentFieldValue = String(record?.fields[urlFieldName] || '').trim();
        finalValueToSave = currentFieldValue ? (editingUrl.value + '\n' + currentFieldValue) : editingUrl.value;
      }

      const res = await fetch(`/api/products/${editingUrl.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            [urlFieldName]: finalValueToSave
          }
        })
      });
      if (!res.ok) throw new Error('Failed to save');

      // Update local state without reload
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          records: prev.records.map(r => r.id === (editingUrl?.id) ? {
            ...r,
            fields: {
              ...r.fields,
              [urlFieldName]: finalValueToSave
            }
          } : r) as any
        };
      });
      setEditingUrl(null);
    } catch (err) {
      alert('Error saving URL: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleMain = async (recordId: string) => {
    if (isSaving || !data?.records) return;
    setIsSaving(true);
    try {
      const targetRecord = data.records.find(r => r.id === recordId);
      if (!targetRecord) return;

      const getCollectionKey = (rFields: any) => {
        return (formatScalar(rFields?.['Colecction Name']) || 
                formatScalar(rFields?.Name) || 
                formatScalar(rFields?.['Collection Name']) || 
                '').trim();
      };

      const groupKey = getCollectionKey(targetRecord.fields);
      const otherMainIds = data.records
        .filter(r => r.id !== recordId && getCollectionKey(r.fields) === groupKey && r.fields?.Main === true)
        .map(r => r.id);

      // Mutate local state immediately for responsiveness
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          records: prev.records.map(r => {
            const rFields = r.fields || {};
            const rKey = getCollectionKey(rFields);
            if (r.id === recordId) return { ...r, fields: { ...rFields, Main: true } };
            if (rKey === groupKey) return { ...r, fields: { ...rFields, Main: false } };
            return r;
          }) as any
        };
      });

      // Perform updates (Target becomes true, others become false)
      const updates = [
        { id: recordId, fields: { Main: true } },
        ...otherMainIds.map(id => ({ id, fields: { Main: false } }))
      ];

      for (const update of updates) {
        await fetch(`/api/products/${update.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: update.fields })
        });
      }
    } catch (err) {
      alert('Error toggling Main: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const columns: string[] = data?.columns ?? [];
  const records: ProductsRecord[] = data?.records ?? [];

  const categoryFieldName = React.useMemo(() => columns.find(c => c.trim().toLowerCase() === 'category') || 'Category', [columns]);
  const colorFieldName = React.useMemo(() => columns.find(c => c.trim().toLowerCase() === 'color') || 'Color', [columns]);
  const spaceFieldName = React.useMemo(() => columns.find(c => c.trim().toLowerCase() === 'space') || 'Space', [columns]);
  const materialFieldName = React.useMemo(() => columns.find(c => c.trim().toLowerCase() === 'material') || 'Material', [columns]);

  const getUniqueValues = React.useCallback((fieldName: string) => {
    const vals = new Set<string>();
    records.forEach(r => {
      const v = r.fields?.[fieldName];
      if (typeof v === 'string' && v.trim()) vals.add(v.trim());
      else if (Array.isArray(v)) v.forEach(x => typeof x === 'string' && x.trim() && vals.add(x.trim()));
    });
    return Array.from(vals).sort((a, b) => a.localeCompare(b));
  }, [records]);

  const uniqueCategories = React.useMemo(() => CATEGORY_OPTIONS, []);
  const uniqueColors = React.useMemo(() => COLOR_OPTIONS, []);
  const uniqueSpaces = React.useMemo(() => SPACE_OPTIONS, []);
  const uniqueMaterials = React.useMemo(() => MATERIAL_OPTIONS, []);

  const displayedColumns = React.useMemo(() => {
    const ordered = [
      'Image',
      'DAM',
      'Price',
      'URL',
      'Colecction Name',
      'Colecction Code',
      'Variant Number',
      'Category',
      'Space',
      'Color',
      'Material',
      'DIMENSION (mm)',
      'Note',
      'CODE NUMBER',
      'L000',
      'Num'
    ] as const;

    if (columns.length === 0 && loading) {
      return ['Image', 'DAM', 'Price', 'Colecction Name', 'Variant Number', 'Category'];
    }

    const orderedSet = new Set<string>(ordered as readonly string[]);
    const out: string[] = [];

    // Push ordered headers that exist in API columns (or ones we want always like DAM)
    for (const key of ordered) {
      if (key === 'URL') continue;
      if (columns.includes(key) || key === 'DAM') {
        out.push(key);
      }
    }

    // Add any unknown columns coming from API as extras
    const extras = columns
      .filter((c) => !orderedSet.has(c) && c !== 'URL' && c !== 'Main' && c !== 'Content Calendar')
      .sort((a, b) => a.localeCompare(b));
    out.push(...extras);

    if (columns.includes('URL')) {
      if (!out.includes('Main')) out.push('Main');
      out.push('URL');
    } else {
      if (!out.includes('Main')) out.push('Main');
    }

    return out;
  }, [columns, loading]);

  const getSearchText = React.useCallback((r: ProductsRecord, usedColumns: string[]) => {
    const parts: string[] = [];
    for (const c of usedColumns) {
      const v = r.fields?.[c];
      if (v === null || v === undefined) continue;

      const colLower = c.trim().toLowerCase();
      if (colLower === 'image' || colLower === 'dam') {
        const urls = extractUrls(v);
        if (urls.length > 0) parts.push(urls.join(' | '));
        continue;
      }

      if (Array.isArray(v)) {
        const arr = v as unknown[];
        const allStrings = arr.every((x) => typeof x === 'string');
        if (allStrings) parts.push((arr as string[]).join(' | '));
        else parts.push(String(arr.length));
        continue;
      }

      const s = formatScalar(v);
      if (s) {
        parts.push(s);
        continue;
      }

      if (typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        if (typeof obj.name === 'string') parts.push(obj.name);
        else if (typeof obj.url === 'string') parts.push(obj.url);
      }
    }
    return parts.join(' \n ').toLowerCase();
  }, []);

  const filteredRecords = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = !q ? records : records.filter((r) => getSearchText(r, displayedColumns).includes(q));

    // Category Filter
    if (selectedCategories.size > 0) {
      base = base.filter(r => {
        const v = r.fields?.[categoryFieldName];
        if (typeof v === 'string') return selectedCategories.has(v.trim());
        if (Array.isArray(v)) return v.some(x => typeof x === 'string' && selectedCategories.has(x.trim()));
        return false;
      });
    }

    // Color Filter
    if (selectedColors.size > 0) {
      base = base.filter(r => {
        const v = r.fields?.[colorFieldName];
        if (typeof v === 'string') return selectedColors.has(v.trim());
        if (Array.isArray(v)) return v.some(x => typeof x === 'string' && selectedColors.has(x.trim()));
        return false;
      });
    }

    // Space Filter
    if (selectedSpaces.size > 0) {
      base = base.filter(r => {
        const v = r.fields?.[spaceFieldName];
        if (typeof v === 'string') return selectedSpaces.has(v.trim());
        if (Array.isArray(v)) return v.some(x => typeof x === 'string' && selectedSpaces.has(x.trim()));
        return false;
      });
    }

    // Material Filter
    if (selectedMaterials.size > 0) {
      base = base.filter(r => {
        const v = r.fields?.[materialFieldName];
        if (typeof v === 'string') return selectedMaterials.has(v.trim());
        if (Array.isArray(v)) return v.some(x => typeof x === 'string' && selectedMaterials.has(x.trim()));
        return false;
      });
    }

    if (!showSelectedOnly) return base;
    return base.filter((r) => selectedIds.has(r.id));
  }, [displayedColumns, getSearchText, records, search, selectedIds, showSelectedOnly, selectedCategories, selectedColors, selectedSpaces, selectedMaterials, categoryFieldName, colorFieldName, spaceFieldName, materialFieldName]);

  const getSortValue = React.useCallback((r: ProductsRecord, key: string) => {
    const k = key.trim().toLowerCase();

    if (k === 'image') {
      const urls = extractUrls(r.fields?.[key]);
      return urls[0] ?? '';
    }

    const v = r.fields?.[key];
    if (v === null || v === undefined) return '';

    if (k === 'price') {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const cleaned = v.trim().replace(/,/g, '');
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : '';
      }
      return '';
    }

    if (k === 'num' || k === 'variant number') {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = Number(v.trim());
        return Number.isFinite(n) ? n : '';
      }
      return '';
    }

    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string') return v.toLowerCase();
    if (Array.isArray(v)) {
      const arr = v as unknown[];
      const allStrings = arr.every((x) => typeof x === 'string');
      if (allStrings) return (arr as string[]).join(' | ').toLowerCase();
      return arr.length;
    }
    if (typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      if (typeof obj.name === 'string') return obj.name.toLowerCase();
      if (typeof obj.url === 'string') return obj.url.toLowerCase();
    }
    return '';
  }, []);

  const sortedRecords = React.useMemo(() => {
    const base = [...filteredRecords];

    base.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);

      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }

      // If primary sort values are identical (e.g. variants of the same collection),
      // we elevate the 'Main' variant to the top of its block.
      if (cmp === 0) {
        const aMain = a.fields?.Main === true;
        const bMain = b.fields?.Main === true;
        if (aMain && !bMain) return -1;
        if (!aMain && bMain) return 1;
      }

      return sortDir === 'asc' ? cmp : -cmp;
    });
    return base;
  }, [filteredRecords, getSortValue, sortDir, sortKey]);

  const variantCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    sortedRecords.forEach(r => {
      const raw =
        formatScalar(r.fields?.['Colecction Name']) ||
        formatScalar(r.fields?.Name) ||
        formatScalar(r.fields?.['Collection Name']) ||
        '';
      const key = raw.trim();
      if (key) {
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [sortedRecords]);

  const visibleRecords = React.useMemo(() => {
    if (familyMode !== 'main') return sortedRecords;

    const groupMap = new Map<string, ProductsRecord>();
    const out: ProductsRecord[] = [];

    for (const r of sortedRecords) {
      const raw =
        formatScalar(r.fields?.['Colecction Name']) ||
        formatScalar(r.fields?.Name) ||
        formatScalar(r.fields?.['Collection Name']) ||
        '';
      const key = raw.trim();

      if (!key) {
        out.push(r);
        continue;
      }

      const isMain = r.fields?.Main === true;
      const existing = groupMap.get(key);

      // Prioritize the record marked as Main.
      // If we don't have one for this group yet, or if this one is Main and the existing one isn't.
      if (!existing || (isMain && existing.fields?.Main !== true)) {
        groupMap.set(key, r);
      }
    }

    // Now convert the map back to the output list, maintaining sorted order of the groups
    const seenGroups = new Set<string>();
    for (const r of sortedRecords) {
      const raw =
        formatScalar(r.fields?.['Colecction Name']) ||
        formatScalar(r.fields?.Name) ||
        formatScalar(r.fields?.['Collection Name']) ||
        '';
      const key = raw.trim();
      if (!key) continue;
      if (seenGroups.has(key)) continue;
      seenGroups.add(key);
      const chosen = groupMap.get(key);
      if (chosen) out.push(chosen);
    }

    return out;
  }, [familyMode, sortedRecords]);

  const baseGalleryItems = React.useMemo(() => {
    return visibleRecords
      .map((r) => {
        const fields = r.fields ?? {};
        const fieldKeys = Object.keys(fields);
        
        // Find URL column once
        const urlKey = fieldKeys.find(k => {
          const l = k.trim().toLowerCase();
          return l === 'url' || l.endsWith(' url') || l.endsWith('_url') || l.endsWith('-url');
        });
        
        const damUrls = extractUrls(urlKey ? fields[urlKey] : undefined);
        const imageUrls = extractUrls(fields.Image);
        const rawUrl = damUrls[0] || imageUrls[0] || '';
        const url = getDriveDirectLink(rawUrl);
        const driveId = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || null;

        const collectionName =
          formatScalar(r.fields?.['Colecction Name']) || formatScalar(r.fields?.Name) || '';
        const collectionNameNormalized = collectionName.trim();
        const title = collectionName || 'Product';
        const code = formatScalar(r.fields?.['Colecction Code']) || formatScalar(r.fields?.Code);
        const variant = formatScalar(r.fields?.['Variant Number']) || formatScalar(r.fields?.Num);
        const price = formatPrice(r.fields?.Price) ?? null;

        // Find dimension and note keys once
        const normalizedKeys = fieldKeys.map(k => ({ k, n: k.trim().toLowerCase() }));
        
        const dimKeyObj = normalizedKeys.find(x => x.n.includes('dimension') && x.n.includes('mm')) || 
                        normalizedKeys.find(x => x.n.startsWith('dimension'));
        const dimKey = dimKeyObj?.k;

        const dimension =
          formatScalar(fields['DIMENSION (mm)']) ||
          formatScalar(fields['Dimension (mm)']) ||
          (dimKey ? formatScalar(fields[dimKey]) : '') ||
          formatScalar(fields['DIMENSION']) ||
          formatScalar(fields['DIMENSIONS']) ||
          formatScalar(fields['Dimension']) ||
          formatScalar(fields['Dimensions']);

        const ntKey = normalizedKeys.find(x => x.n === 'note' || x.n.startsWith('note ') || x.n.includes('note'))?.k;

        const note =
          formatScalar(fields['Note']) ||
          formatScalar(fields['NOTE']) ||
          (ntKey ? formatScalar(fields[ntKey]) : '');

        return {
          id: r.id,
          url,
          originalUrl: rawUrl,
          driveId,
          title,
          collectionName,
          collectionNameNormalized,
          code,
          variant,
          dimension,
          note,
          price,
        };
      })
      .filter((x): x is GalleryItem => x !== null);
  }, [visibleRecords, variantCounts, familyMode]);

  const allGalleryItems = React.useMemo(() => {
    return sortedRecords
      .map((r) => {
        const fields = r.fields ?? {};
        const urlEntry = Object.entries(fields).find(([k]) => {
          const kl = k.trim().toLowerCase();
          return kl === 'url' || kl.endsWith(' url') || kl.endsWith('_url') || kl.endsWith('-url');
        });
        const damUrls = extractUrls(urlEntry?.[1]);
        const imageUrls = extractUrls(fields.Image);
        const rawUrl = damUrls[0] || imageUrls[0] || '';
        const url = getDriveDirectLink(rawUrl);
        const collectionName =
          formatScalar(r.fields?.['Colecction Name']) || formatScalar(r.fields?.Name) || '';
        const collectionNameNormalized = collectionName.trim();

        const title = collectionName;
        const code = formatScalar(fields['Colecction Code']) || formatScalar(fields['Code']);
        const variant = formatScalar(fields['Variant Number']) || formatScalar(fields['Num']);
        const dimension =
          formatScalar(fields['DIMENSION (mm)']) || formatScalar(fields['Dimension (mm)']) || formatScalar(fields['Dimensions']);

        const noteKey = (() => {
          const keys = Object.keys(fields);
          const normalized = keys.map((k) => ({ k, n: k.trim().toLowerCase() }));
          return normalized.find((x) => x.n === 'note' || x.n.startsWith('note ') || x.n.includes('note'))?.k ?? null;
        })();

        const note =
          formatScalar(fields['Note']) ||
          formatScalar(fields['NOTE']) ||
          (noteKey ? formatScalar(fields[noteKey]) : '');

        const price = formatPrice(fields['Price']);

        return {
          id: r.id,
          url,
          title,
          collectionName,
          collectionNameNormalized,
          code,
          variant,
          dimension,
          note,
          price,
        };
      })
      .filter((x) => Boolean(x.url));
  }, [sortedRecords]);

  const galleryItems = React.useMemo(() => {
    if (!familyCollectionName) return baseGalleryItems;
    const key = familyCollectionName.trim();
    return allGalleryItems.filter((x) => x.collectionNameNormalized === key);
  }, [allGalleryItems, baseGalleryItems, familyCollectionName]);

  const openPreviewByUrl = React.useCallback(
    (url: string) => {
      if (!url) return;
      // Try exact match first (O(N) with fast string comparison)
      let idx = galleryItems.findIndex((x) => x.url === url || x.originalUrl === url);
      
      // If no match, try by matching Drive IDs if applicable
      if (idx === -1 && (url.includes('drive.google.com') || url.includes('lh3.googleusercontent.com'))) {
        const inputId = getDriveDirectLink(url).match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
        if (inputId) {
          // pre-calculated driveId makes this very fast O(N) simple comparison
          idx = galleryItems.findIndex(x => x.driveId === inputId);
        }
      }

      if (idx >= 0) {
        const resolved = galleryItems[idx];
        setPreviewIndex(idx);
        setPreviewId(resolved?.id ?? null);
      }
    },
    [galleryItems]
  );

  const closePreview = React.useCallback(() => {
    setPreviewIndex(null);
    setPreviewId(null);
    setLightboxDetailsCollapsed(true);
    setFamilyCollectionName(null);
  }, []);

  const goPrev = React.useCallback(() => {
    setPreviewIndex((i) => {
      if (i === null) return i;
      const n = galleryItems.length;
      if (n <= 1) return i;
      const nextIndex = (i - 1 + n) % n;
      const next = galleryItems[nextIndex];
      setPreviewId(next?.id ?? null);
      // Auto-collapse table when navigating
      setLightboxDetailsCollapsed(true);
      return nextIndex;
    });
  }, [galleryItems]);

  React.useEffect(() => {
    if (previewIndex === null) return;
    if (!previewId) return;

    const idx = galleryItems.findIndex((x) => x.id === previewId);
    if (idx >= 0) {
      if (idx !== previewIndex) setPreviewIndex(idx);
      return;
    }

    const prev = allGalleryItems.find((x) => x.id === previewId) ?? null;
    const familyKey = (prev?.collectionNameNormalized || '').trim();
    if (familyKey) {
      const mappedIdx = galleryItems.findIndex((x) => x.collectionNameNormalized === familyKey);
      if (mappedIdx >= 0) {
        setPreviewIndex(mappedIdx);
        setPreviewId(galleryItems[mappedIdx].id);
        return;
      }
    }

    if (galleryItems.length > 0) {
      setPreviewIndex(0);
      setPreviewId(galleryItems[0].id);
    }
  }, [previewId, previewIndex, allGalleryItems.map((x) => x.id).join('|'), galleryItems.map((x) => x.id).join('|')]);

  const toggleSelected = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const getSelectedItems = React.useCallback(
    (fallbackIndex: number | null) => {
      const byId = new Map(baseGalleryItems.map((x) => [x.id, x] as const));
      const picked = [...selectedIds].map((id) => byId.get(id)).filter((x): x is (typeof galleryItems)[number] => !!x);
      if (picked.length > 0) return picked;
      if (fallbackIndex === null) return [];
      const current = galleryItems[fallbackIndex];
      return current ? [current] : [];
    },
    [baseGalleryItems, galleryItems, selectedIds]
  );

  const downloadSelected = React.useCallback(async () => {
    const items = getSelectedItems(previewIndex);
    if (items.length === 0) return;

    logFrontendEvent('PRODUCT_DOWNLOAD', `Downloaded ${items.length} items: ${items.map(x => x.code || x.title).join(', ')}`);

    for (const item of items) {
      try {
        const res = await fetch(item.url, { cache: 'no-store' });
        if (!res.ok) continue;
        const blob = await res.blob();
        const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
        const filenameBase = (item.code || item.title || 'image').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 64);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${filenameBase}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      } catch {
        // ignore
      }
    }
  }, [getSelectedItems, previewIndex]);

  const selectedCount = selectedIds.size;
  React.useEffect(() => {
    if (selectedIds.size === 0 && showSelectedOnly) setShowSelectedOnly(false);
  }, [selectedIds, showSelectedOnly]);

  const currentIndex = React.useMemo(() => {
    if (previewId) {
      const idx = galleryItems.findIndex((x) => x.id === previewId);
      return idx >= 0 ? idx : null;
    }
    if (previewIndex === null) return null;
    return previewIndex;
  }, [galleryItems, previewId, previewIndex]);

  const currentItem = React.useMemo(() => {
    if (previewId) {
      const found = galleryItems.find((x) => x.id === previewId);
      if (found) return found;
    }
    if (previewIndex === null) return null;
    return galleryItems[previewIndex] ?? null;
  }, [galleryItems, previewId, previewIndex]);

  const currentCollectionVariants = React.useMemo(() => {
    const key = (currentItem?.collectionNameNormalized || '').trim();
    if (!key) return [] as (typeof allGalleryItems)[number][];

    const variants = allGalleryItems.filter((x) => x.collectionNameNormalized === key);

    const currentId = currentItem?.id ?? null;
    if (!currentId) return variants;

    const current = variants.find((x) => x.id === currentId) ?? null;
    const rest = variants.filter((x) => x.id !== currentId);

    rest.sort((a, b) => {
      const av = (a.variant || '').toString();
      const bv = (b.variant || '').toString();
      const an = Number.parseFloat(av);
      const bn = Number.parseFloat(bv);
      if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
      const ac = (a.code || '').toString();
      const bc = (b.code || '').toString();
      return ac.localeCompare(bc);
    });

    return current ? [current, ...rest] : [...variants];
  }, [allGalleryItems, currentItem?.collectionNameNormalized, currentItem?.id]);

  const renderCell = React.useCallback(
    (column: string, value: unknown, recordId: string) => {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
      const col = column.trim().toLowerCase();

      const isUrl = col === 'url' || col.endsWith(' url') || col.endsWith('_url') || col.endsWith('-url');
      const isDAM = col === 'dam';
      const isMain = col === 'main';
      const isEditable = isUrl || isDAM || isMain || col === 'space' || col === 'color' || col === 'material' || col === 'category';

      if ((value === null || value === undefined) && !isEditable) return null;

      if (isMain) {
        const record = records.find(r => r.id === recordId);
        const checked = record?.fields?.Main === true;
        
        return (
          <div className="flex h-full w-full items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (canEdit) handleToggleMain(recordId);
              }}
              className={`flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-all ${
                checked 
                  ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm' 
                  : 'border-black/10 bg-black/5 hover:border-emerald-500/30 dark:border-white/10 dark:bg-white/5 dark:hover:border-emerald-500/30'
              } ${!canEdit ? 'cursor-default opacity-50' : ''}`}
            >
              {checked && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3.5">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        );
      }

      if (isUrl) {
        if (editingUrl?.id === recordId && (editingUrl.column === column || !editingUrl.column) && (editingUrl.index === undefined || editingUrl.index === null)) {
          return (
            <div
              className="absolute inset-0 z-40 bg-white dark:bg-black"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <textarea
                className="h-full w-full resize-none border-2 border-emerald-500 bg-transparent p-2 text-[11px] font-medium leading-relaxed outline-none dark:border-emerald-400"
                value={editingUrl.value}
                onChange={(e) => setEditingUrl({ ...editingUrl, value: e.target.value })}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveUrl();
                  } else if (e.key === 'Escape' || e.key === 'Esc') {
                    setEditingUrl(null);
                  }
                }}
              />
              {isSaving && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px] dark:bg-black/50">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                </div>
              )}
            </div>
          );
        }

        const urls = extractUrls(value);
        return (
          <>
            {canEdit && urls.length > 0 && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingUrl({ id: recordId, value: '', column, mode: 'prepend' });
                }}
                className="absolute right-0 top-0 z-10 flex h-6 w-6 items-center justify-center rounded-bl-lg bg-emerald-600 text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 pointer-events-auto cursor-pointer"
                title="Add URL to top"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <div className={`group flex min-h-[1.5rem] flex-col gap-1 ${urls.length === 0 ? 'items-center justify-center' : ''}`}>
              {urls.length === 0 ? (
                <div className="flex w-full items-center justify-center py-1">
                  {canEdit ? (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingUrl({ id: recordId, value: '', column });
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-600 transition-all hover:bg-red-500 hover:text-white dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500 dark:hover:text-white pointer-events-auto cursor-pointer"
                      title="Add URL"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : (
                    <span className="text-2xl font-light text-red-500/60 dark:text-red-400/60">+</span>
                  )}
                </div>
              ) : (
                <div className="scrollbar-minimal flex max-h-[120px] flex-col gap-1.5 overflow-y-auto py-0.5">

                  {editingUrl?.id === recordId && (editingUrl.column === column || !editingUrl.column) && editingUrl.mode === 'prepend' && (
                    <div className="flex min-w-0 items-center gap-1 relative z-50 bg-white dark:bg-black pl-4 pr-1">
                      <input
                        className="flex-1 min-w-0 rounded border-2 border-emerald-500 bg-transparent px-2 py-1 text-[11px] font-medium leading-relaxed outline-none dark:border-emerald-400"
                        value={editingUrl.value}
                        onChange={(e) => setEditingUrl({ ...editingUrl, value: e.target.value })}
                        autoFocus
                        placeholder="New URL..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveUrl();
                          } else if (e.key === 'Escape' || e.key === 'Esc') {
                            setEditingUrl(null);
                          }
                        }}
                      />
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={(e) => { e.stopPropagation(); handleSaveUrl(); }}
                          className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditingUrl(null); }}
                          className="flex h-6 w-6 items-center justify-center rounded bg-black/10 text-black/60 hover:bg-black/20 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20"
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                  {urls.map((u, i) => {
                    const isBeingEdited = editingUrl?.id === recordId && (editingUrl.column === column || !editingUrl.column) && editingUrl.index === i;
                    if (isBeingEdited) {
                      return (
                        <div key={i} className="flex min-w-0 items-center gap-1 relative z-50 bg-white dark:bg-black pl-4 pr-1">
                          <input
                            className="flex-1 min-w-0 rounded border-2 border-emerald-500 bg-transparent px-2 py-1 text-[11px] font-medium leading-relaxed outline-none dark:border-emerald-400"
                            value={editingUrl.value}
                            onChange={(e) => setEditingUrl({ ...editingUrl, value: e.target.value })}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveUrl();
                              } else if (e.key === 'Escape' || e.key === 'Esc') {
                                setEditingUrl(null);
                              }
                            }}
                          />
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={(e) => { e.stopPropagation(); handleSaveUrl(); }}
                              className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setEditingUrl(null); }}
                              className="flex h-6 w-6 items-center justify-center rounded bg-black/10 text-black/60 hover:bg-black/20 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20"
                            >
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={u + i} className="group/link flex min-w-0 items-center gap-1.5 pl-4 pr-1">
                        <a
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 min-w-0 rounded border border-emerald-500/10 bg-emerald-500/[0.03] px-2 py-1 text-[11px] font-medium text-emerald-700 transition-all hover:bg-emerald-500/10 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                          title={u}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <svg viewBox="0 0 24 24" className="h-3 w-3 flex-none" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="truncate">{u}</span>
                          </div>
                        </a>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingUrl({ id: recordId, value: u, column, index: i });
                            }}
                            className="hidden h-7 w-7 items-center justify-center rounded-md bg-black/5 text-black/40 hover:bg-black/10 group-hover/link:flex dark:bg-white/5 dark:text-white/40 dark:hover:bg-white/10"
                            title="Edit this link"
                          >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        );
      }

      if (col === 'space') {
        const displayValue = formatScalar(value);
        const activeValues = (displayValue || '').split(',').map(s => s.trim()).filter(Boolean);
        const isActiveEdit = editingUrl?.id === recordId && editingUrl?.column === column;

        return (
          <div
            className={`group relative flex flex-col h-full min-h-[44px] w-full items-stretch overflow-hidden ${canEdit ? 'cursor-pointer' : ''} ${isActiveEdit ? 'ring-2 ring-inset ring-emerald-500/40' : ''}`}
            onClick={(e) => {
              if (!canEdit) return;
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setEditingUrl({ id: recordId, value: displayValue, originalValue: displayValue, column, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } });
            }}
          >
            {activeValues.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <span className={`text-[11px] italic ${canEdit ? 'text-black/25 dark:text-white/25 group-hover:text-emerald-600/60 dark:group-hover:text-emerald-400/60' : 'text-black/20 dark:text-white/20'}`}>
                  {canEdit ? '+ Add space' : '—'}
                </span>
              </div>
            ) : (
              activeValues.map((v, i) => (
                <div 
                  key={v} 
                  className={`flex flex-1 items-center justify-center px-3 py-1 text-center text-[10px] font-semibold transition-colors bg-white/5 text-black/80 dark:bg-white/5 dark:text-white/80 ${
                    i !== activeValues.length - 1 ? 'border-b border-black/5 dark:border-white/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 leading-tight">
                    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 flex-none opacity-20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span className="truncate">{v}</span>
                  </div>
                </div>
              ))
            )}
            {canEdit && (
              <div className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                <svg viewBox="0 0 24 24" className="h-3 w-3 text-emerald-600/40 dark:text-emerald-400/40" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            )}
          </div>
        );
      }

      if (col === 'color' || col === 'material' || col === 'category') {
        const displayValue = formatScalar(value);
        const activeValues = (displayValue || '').split(',').map(s => s.trim()).filter(Boolean);
        const isActiveEdit = editingUrl?.id === recordId && editingUrl?.column === column;

        return (
          <div
            className={`group relative flex flex-col h-full min-h-[44px] w-full items-stretch overflow-hidden ${canEdit ? 'cursor-pointer' : ''} ${isActiveEdit ? 'ring-2 ring-inset ring-emerald-500/40' : ''}`}
            onClick={(e) => {
              if (!canEdit) return;
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setEditingUrl({ id: recordId, value: displayValue, originalValue: displayValue, column, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } });
            }}
          >
            {activeValues.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <span className={`text-[11px] italic ${canEdit ? 'text-black/25 dark:text-white/25 group-hover:text-emerald-600/60 dark:group-hover:text-emerald-400/60' : 'text-black/20 dark:text-white/20'}`}>
                  {canEdit ? `+ Add ${col}` : '—'}
                </span>
              </div>
            ) : (
              activeValues.map((v, i) => (
                <div 
                  key={v} 
                  className={`flex flex-1 items-center justify-center px-3 py-1 text-center text-[10px] font-semibold transition-colors border-b last:border-b-0 ${
                    col === 'category'
                      ? 'border-black/5 bg-white/5 text-black/80 dark:bg-white/5 dark:text-white/80'
                      : col === 'color'
                      ? `${getTagColorStyles(v)} border-black/5 dark:border-white/5`
                      : `${getTagMaterialStyles(v)} border-black/5 dark:border-white/5`
                  }`}
                >
                  <span className="truncate">{v}</span>
                </div>
              ))
            )}
            {canEdit && (
              <div className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                <svg viewBox="0 0 24 24" className="h-3 w-3 text-black/40 dark:text-white/40" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            )}
          </div>
        );
      }

      if (col === 'price') {
        const formatted = formatPrice(value);
        if (!formatted) return formatScalar(value);
        return (
          <span className="hidden items-baseline gap-1 sm:inline-flex">
            <span className="inline-flex items-baseline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${basePath}/fonts/Dirham%20Currency%20Symbol%20-%20Black.svg`}
                alt="AED"
                className="inline-block h-[9px] w-auto"
                onLoad={(e) => {
                  const parent = e.currentTarget.parentElement;
                  const fallback = parent?.querySelector('[data-dirham-fallback]') as HTMLElement | null;
                  if (fallback) fallback.style.display = 'none';
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span data-dirham-fallback className="text-[11px] text-black/80">
                AED
              </span>
            </span>
            <span>{formatted}</span>
          </span>
        );
      }
      if (col === 'image' || col === 'dam') {
        const urls = extractUrls(value);

        // For image and dam: only show the image stack, or 'No image' if empty
        if (urls.length === 0) {
          if (col === 'dam' && canEdit) {
            if (editingUrl?.id === recordId && editingUrl.column === column) {
              return (
                <div
                  className="absolute inset-0 z-10 bg-white dark:bg-black"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <textarea
                    className="h-full w-full resize-none overflow-hidden border-2 border-emerald-500 bg-transparent p-2 text-[11px] font-medium leading-relaxed outline-none dark:border-emerald-400"
                    value={editingUrl.value}
                    onChange={(e) => setEditingUrl({ ...editingUrl, value: e.target.value })}
                    autoFocus
                    placeholder="URL for Image..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSaveUrl();
                      } else if (e.key === 'Escape' || e.key === 'Esc') {
                        setEditingUrl(null);
                      }
                    }}
                  />
                  {isSaving && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px] dark:bg-black/50">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div className="flex h-12 w-full items-center justify-center">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingUrl({ id: recordId, value: '', column });
                  }}
                  className="group flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-600 transition-all hover:bg-red-500 hover:text-white dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500 dark:hover:text-white pointer-events-auto cursor-pointer"
                  title="Add URL for Image"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            );
          }

          return (
            <div className="flex h-12 w-full items-center justify-center bg-black/5 dark:bg-white/5 rounded-md">
              <span className="text-[10px] font-medium italic text-black/40 dark:text-white/40 uppercase tracking-tight">
                No image
              </span>
            </div>
          );
        }

        const maxItems = 4;
        const visibleUrls = urls.slice(0, maxItems);

        return (
          <>
            <div className="relative h-24 w-24 flex items-center justify-center">
              {visibleUrls
                .slice()
                .reverse()
                .map((u, i) => {
                  const revIdx = visibleUrls.length - 1 - i;
                  const finalUrl = getDriveDirectLink(u);
                  return (
                    <button
                      key={u + i}
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        openPreviewByUrl?.(finalUrl);
                      }}
                      title={finalUrl ? `Image ${revIdx + 1} of ${urls.length} (Click to maximize)` : 'No image'}
                      style={{
                        transformOrigin: 'bottom center',
                        transform: `rotate(${revIdx * 3.2}deg) translate(${revIdx * 4}px, ${-revIdx * 2}px)`,
                        zIndex: visibleUrls.length - revIdx,
                      }}
                      className="absolute pointer-events-auto"
                    >
                      <span className="block h-24 w-24 overflow-hidden rounded-md border border-black/80 bg-white shadow-sm dark:border-white/25 dark:bg-black/60 ring-1 ring-black/10 dark:ring-white/10 backdrop-blur-[2px] transition-transform hover:scale-110 active:scale-95">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={finalUrl}
                          alt="product"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          className="block h-full w-full object-cover"
                        />
                      </span>
                    </button>
                  );
                })}
              {urls.length > 1 && (
                <div className="absolute bottom-1 right-1 z-[10] flex h-6 min-w-6 items-center justify-center rounded-full border border-white/30 bg-emerald-600 px-1.5 text-[10px] font-black text-white shadow-xl translate-x-[20%] translate-y-[20%]">
                  +{urls.length - 1}
                </div>
              )}
            </div>
          </>
        );
      }

      if (Array.isArray(value)) {
        const arr = value as unknown[];
        const allStrings = arr.every((x) => typeof x === 'string');
        if (allStrings) {
          const items = arr as string[];
          return (
            <div className="flex flex-wrap gap-1">
              {items.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] dark:border-white/10 dark:bg-white/5"
                  title={label}
                >
                  <span className="max-w-[240px] truncate">{label}</span>
                </span>
              ))}
            </div>
          );
        }

        return <span className="text-xs text-black/60 dark:text-white/60">[{arr.length}]</span>;
      }

      const scalar = formatScalar(value);
      if (scalar) {
        const colLower = column.trim().toLowerCase();
        if (familyMode === 'main' && (colLower === 'num' || colLower === 'variant number')) {
          const rec = records.find(r => r.id === recordId);
          const key = (formatScalar(rec?.fields?.['Colecction Name']) || formatScalar(rec?.fields?.Name) || 
                      formatScalar(rec?.fields?.['Collection Name']) || '').trim();
          const count = variantCounts[key] || 0;
          const extra = count - 1;
          if (extra > 0) {
            return (
              <>
                <span className="truncate">{scalar}</span>
                <span className="absolute right-1 top-1 z-10 rounded bg-black/10 px-1 py-0.5 text-[8px] font-bold text-black/40 dark:bg-white/15 dark:text-white/40">
                  +{extra}
                </span>
              </>
            );
          }
        }
        return scalar;
      }

      if (typeof value === 'object') {
        const maybe = value as Record<string, unknown>;
        if (typeof maybe.name === 'string') return maybe.name;
        if (typeof maybe.url === 'string') return maybe.url;
        return <span className="text-xs text-black/60 dark:text-white/60">Object</span>;
      }

      return String(value);
    },
    [editingUrl, isSaving, handleSaveUrl, canEdit, openPreviewByUrl, familyMode, variantCounts, records]
  );


  const swipeRef = React.useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    moved: boolean;
    swiped: boolean;
  }>({ pointerId: null, startX: 0, startY: 0, moved: false, swiped: false });

  const variantSwipeRef = React.useRef<{
    pointerId: number | null;
    startX: number;
    moved: boolean;
    variantId: string | null;
  }>({ pointerId: null, startX: 0, moved: false, variantId: null });

  const handleVariantSwipeStart = (e: React.PointerEvent, variantId: string) => {
    e.stopPropagation();
    variantSwipeRef.current.pointerId = e.pointerId;
    variantSwipeRef.current.startX = e.clientX;
    variantSwipeRef.current.moved = false;
    variantSwipeRef.current.variantId = variantId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleVariantSwipeMove = (e: React.PointerEvent) => {
    if (variantSwipeRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - variantSwipeRef.current.startX;
    if (!variantSwipeRef.current.moved) {
      if (Math.abs(dx) < 8) return;
      variantSwipeRef.current.moved = true;
    }
  };

  const handleVariantSwipeEnd = (e: React.PointerEvent) => {
    if (variantSwipeRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - variantSwipeRef.current.startX;
    const variantId = variantSwipeRef.current.variantId;

    // Reset swipe state
    variantSwipeRef.current.pointerId = null;
    variantSwipeRef.current.variantId = null;

    // Check if it was a swipe
    if (Math.abs(dx) > 50 && variantId) {
      if (dx > 0) {
        // Swipe right - select
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.add(variantId);
          return next;
        });
      } else {
        // Swipe left - deselect
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(variantId);
          return next;
        });
      }
    }
  };

  React.useEffect(() => {
    const isOpen = Boolean(currentItem?.url);
    if (!isOpen) return;

    const el = document.documentElement;
    const body = document.body;

    const prevOverflowEl = el.style.overflow;
    const prevOverflowBody = body.style.overflow;
    const prevPaddingRightBody = body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - el.clientWidth;
    el.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      el.style.overflow = prevOverflowEl;
      body.style.overflow = prevOverflowBody;
      body.style.paddingRight = prevPaddingRightBody;
    };
  }, [currentItem?.url]);

  const shareSelected = React.useCallback(async () => {
    const items = getSelectedItems(previewIndex);
    if (items.length === 0) return;

    const urls = items.map((x) => x.url);

    try {
      logFrontendEvent('PRODUCT_SHARE', `Shared ${items.length} items: ${items.map(x => x.code || x.title).join(', ')}`);
      const canNativeShare =
        typeof navigator !== 'undefined' &&
        typeof (navigator as Navigator & { share?: unknown }).share === 'function' &&
        typeof (navigator as Navigator & { canShare?: unknown }).canShare === 'function';

      if (canNativeShare) {
        const files: File[] = [];
        for (const item of items) {
          const res = await fetch(item.url, { cache: 'no-store' });
          if (!res.ok) continue;
          const blob = await res.blob();
          const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
          const filenameBase = (item.code || item.title || 'image').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 64);
          files.push(new File([blob], `${filenameBase}.${ext}`, { type: blob.type || 'image/jpeg' }));
        }

        const shareData = {
          title: items.length === 1 ? items[0].title : 'Products',
          text: items.length === 1 ? items[0].title : `Selected: ${items.length}`,
          files,
        };

        const nav = navigator as Navigator & { share: (data: unknown) => Promise<void>; canShare: (data: unknown) => boolean };
        if (files.length > 0 && nav.canShare(shareData)) {
          await nav.share(shareData);
          return;
        }
      }
    } catch {
      // fallthrough
    }

    try {
      await navigator.clipboard.writeText(urls.join('\n'));
    } catch {
      // ignore
    }
  }, [getSelectedItems, previewIndex]);

  const goNext = React.useCallback(() => {
    setPreviewIndex((i) => {
      if (i === null) return i;
      const n = galleryItems.length;
      if (n <= 1) return i;
      const nextIndex = (i + 1) % n;
      const next = galleryItems[nextIndex];
      setPreviewId(next?.id ?? null);
      // Auto-collapse table when navigating
      setLightboxDetailsCollapsed(true);
      return nextIndex;
    });
  }, [galleryItems]);

  const toggleSort = React.useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey]
  );

  React.useEffect(() => {
    if (previewIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // Keys that should be blocked from affecting the background
      const blockedKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
      if (blockedKeys.includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'Escape') closePreview();
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [closePreview, goNext, goPrev, previewIndex]);

  React.useEffect(() => {
    const v = window.localStorage.getItem('products_view_mode');
    if (v === 'list' || v === 'gallery') setViewMode(v);
  }, []);

  React.useEffect(() => {
    const stored = window.localStorage.getItem('products_theme');
    if (stored === 'dark' || stored === 'light') setTheme(stored);
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem('products_theme', theme);
    const el = document.documentElement;
    if (theme === 'dark') el.classList.add('dark');
    else el.classList.remove('dark');
  }, [theme]);

  // Lock body scroll when preview is open
  React.useEffect(() => {
    if (previewIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [previewIndex]);

  React.useEffect(() => {
    window.localStorage.setItem('products_view_mode', viewMode);
  }, [viewMode]);

  const headerToggleBase =
    'inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-all active:scale-95';

  const viewToggleNode = (
    <button
      type="button"
      onClick={() => setViewMode((v) => (v === 'list' ? 'gallery' : 'list'))}
      aria-pressed={viewMode === 'list'}
      title={viewMode === 'list' ? 'Switch to Gallery View' : 'Switch to List View'}
      className={
        headerToggleBase +
        (viewMode === 'list'
          ? ' border-emerald-500/20 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400'
          : ' border-black/10 bg-white/50 text-black/60 hover:bg-white/80 hover:text-black dark:border-white/10 dark:bg-black/40 dark:text-white/60 dark:hover:bg-black/60 dark:hover:text-white')
      }
    >
      {viewMode === 'gallery' ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      )}
    </button>
  );

  const familyToggleNode = (
    <button
      type="button"
      onClick={() => {
        setFamilyMode((m) => (m === 'main' ? 'collection' : 'main'));
        setFamilyCollectionName(null);
      }}
      aria-pressed={familyMode === 'collection'}
      title={familyMode === 'collection' ? 'Collection View' : 'All Products'}
      className={
        headerToggleBase +
        (familyMode === 'collection'
          ? ' border-emerald-500/20 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400'
          : ' border-black/10 bg-white/50 text-black/60 hover:bg-white/80 hover:text-black dark:border-white/10 dark:bg-black/40 dark:text-white/60 dark:hover:bg-black/60 dark:hover:text-white')
      }
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 12 12 17 22 12" />
        <polyline points="2 17 12 22 22 17" />
      </svg>
    </button>
  );

  const themeToggleNode = (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      aria-pressed={theme === 'dark'}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={
        headerToggleBase +
        ' border-black/10 bg-white/50 text-black/60 hover:bg-white/80 hover:text-black dark:border-white/10 dark:bg-black/40 dark:text-white/60 dark:hover:bg-black/60 dark:hover:text-white'
      }
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" fill="white" stroke="white" />
          <line x1="12" y1="1" x2="12" y2="3" stroke="white" />
          <line x1="12" y1="21" x2="12" y2="23" stroke="white" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="white" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="white" />
          <line x1="1" y1="12" x2="3" y2="12" stroke="white" />
          <line x1="21" y1="12" x2="23" y2="12" stroke="white" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="white" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="white" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="black" />
        </svg>
      )}
    </button>
  );

  // Portal dropdown for Space/Color/Material/Category editing
  const fieldEditPortal = React.useMemo(() => {
    if (typeof document === 'undefined') return null;
    if (!editingUrl?.rect) return null;

    const colName = (editingUrl.column || '').trim().toLowerCase();
    const isSpace = colName === 'space';
    const isCategory = colName === 'category';
    const isColor = colName === 'color';
    const isMaterial = colName === 'material';
    if (!isSpace && !isCategory && !isColor && !isMaterial) return null;

    const { top, left, width, height } = editingUrl.rect;
    const isCheckbox = isSpace || isCategory || isColor || isMaterial;
    const POPUP_W = 260;
    const POPUP_H = isSpace || isCategory ? 430 : 260;
    const spaceBelow = window.innerHeight - (top + height);
    const spaceRight = window.innerWidth - left;
    const popupLeft = spaceRight >= POPUP_W ? left : Math.max(8, left + width - POPUP_W);
    const popupTop = spaceBelow >= POPUP_H ? top + height + 4 : Math.max(8, top - POPUP_H - 4);

    const currentSet = new Set((editingUrl.value || '').split(',').map(s => s.trim()).filter(Boolean));
    const col = colName;
    const column = editingUrl.column || '';
    const recordId = editingUrl.id;
    const originalValue = editingUrl.originalValue ?? '';

    const doSave = () => {
      handleSaveField(recordId, column, editingUrl.value);
    };
    const doCancel = () => setEditingUrl(null);

    const portal = (
      <>
        {/* Backdrop — click outside saves */}
        <div
          className="fixed inset-0 z-[998]"
          onClick={doSave}
          onKeyDown={(e) => { 
            if (e.key === 'Escape') { e.preventDefault(); doCancel(); }
            else if (e.key === 'Enter') { e.preventDefault(); doSave(); }
          }}
          tabIndex={-1}
        />
        {/* Dropdown */}
        <div
          className="fixed z-[999] flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900"
          style={{ top: popupTop, left: popupLeft, width: POPUP_W }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => { 
            if (e.key === 'Escape') { e.preventDefault(); doCancel(); }
            else if (e.key === 'Enter') { e.preventDefault(); doSave(); }
          }}
        >
          {(isSpace || isCategory || isColor || isMaterial) ? (
            <>
              <div className="scrollbar-minimal overflow-y-auto p-2" style={{ maxHeight: 320 }}>
                <div className="grid grid-cols-1 gap-1.5">
                  {(isSpace ? SPACE_OPTIONS : isColor ? COLOR_OPTIONS : isMaterial ? MATERIAL_OPTIONS : CATEGORY_OPTIONS).map(opt => {
                    const sel = currentSet.has(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const next = new Set(currentSet);
                          if (sel) next.delete(opt); else next.add(opt);
                          setEditingUrl({ ...editingUrl, value: Array.from(next).join(', ') });
                        }}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[12px] font-medium transition-all ${
                          sel
                            ? isColor 
                              ? `${getTagColorStyles(opt)} shadow-sm border` 
                              : isMaterial
                                ? `${getTagMaterialStyles(opt)} shadow-sm border`
                                : 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-black/[0.03] text-black/75 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-white/5 dark:text-white/75 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300'
                        }`}
                      >
                        <span className={`flex h-4 w-4 flex-none items-center justify-center transition-all rounded border-2 ${
                          sel ? 'border-white/60 bg-white/25' : 'border-black/20 dark:border-white/25'
                        }`}>
                          {sel && <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </>
    );

    return createPortal(portal, document.body);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingUrl, isSaving]);

  return (
    <main
      className="flex min-h-0 w-full flex-1 flex-col gap-2 text-black dark:text-white/85 sm:gap-4"
    >
      <style>{`
        .scrollbar-minimal::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .scrollbar-minimal::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-minimal::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.2);
          border-radius: 20px;
          border: 1.5px solid transparent;
          background-clip: content-box;
        }
        .scrollbar-minimal:hover::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.45);
          background-clip: content-box;
        }
        .dark .scrollbar-minimal::-webkit-scrollbar-thumb {
          background: rgba(52, 211, 153, 0.2);
        }
        .dark .scrollbar-minimal:hover::-webkit-scrollbar-thumb {
          background: rgba(52, 211, 153, 0.45);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
      <TopProgressBar loading={loading} />
      <div className="sticky top-0 z-40 -mx-5 px-5 py-2 border-b border-black/10 bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-black/35">
        <div className="flex w-full items-center gap-2 sm:hidden">
          {mobileTitleNode ?? <h1 className="min-w-0 flex-none truncate text-lg font-semibold">{title}</h1>}
          <input
            className="h-10 w-full min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 text-base dark:border-white/15 dark:bg-black/25 dark:text-white"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-none items-center gap-2">
            {familyToggleNode}
            {viewToggleNode}
            {themeToggleNode}
            <AccountMenu onAuthChange={fetchUserSession} />
          </div>
        </div>

        <div className="hidden w-full sm:flex sm:items-center sm:justify-between">
          <div>
            {titleNode ?? <h1 className="text-2xl font-semibold">{title}</h1>}
            <p className="mt-1 text-sm text-black/60 dark:text-white/55"></p>
          </div>

          <div className="flex items-center gap-2">
            <input
              className="h-[64px] w-[260px] flex-none rounded-md border border-black/15 bg-white px-3 text-sm dark:border-white/15 dark:bg-black/25 dark:text-white"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex items-center gap-2">
              {familyToggleNode}
              {viewToggleNode}
              {themeToggleNode}
              <AccountMenu onAuthChange={fetchUserSession} />
            </div>
          </div>
        </div>
      </div>

      <div className="-mx-5 px-5">
        <div className="mt-1 text-[11px] leading-tight text-black/50 dark:text-white/45">
          <span className="font-medium text-black/60 dark:text-white/60">Variant:</span>{' '}
          {data ? (
            <span className="animate-fade-in">{data.count}</span>
          ) : (
            <span className="inline-block h-3 w-8 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          )}
          <span className="mx-2 text-black/25 dark:text-white/20">|</span>
          <span className="font-medium text-black/60 dark:text-white/60">List:</span>{' '}
          {data ? (
            <span className="animate-fade-in">{visibleRecords.length}</span>
          ) : (
            <span className="inline-block h-3 w-8 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          )}
          
          <span className="mx-2 text-black/25 dark:text-white/20">|</span>
          <div className="inline-flex items-center gap-2">
            <div className="inline-flex items-center gap-2">
              <FilterDropdown
                id="category"
                title="Category"
                options={uniqueCategories}
                selected={selectedCategories}
                activeDropdown={activeFilterDropdown}
                setActiveDropdown={setActiveFilterDropdown}
                onChange={setSelectedCategories}
              />
              <FilterDropdown
                id="color"
                title="Color"
                options={uniqueColors}
                selected={selectedColors}
                activeDropdown={activeFilterDropdown}
                setActiveDropdown={setActiveFilterDropdown}
                onChange={setSelectedColors}
              />
              <FilterDropdown
                id="space"
                title="Space"
                options={uniqueSpaces}
                selected={selectedSpaces}
                activeDropdown={activeFilterDropdown}
                setActiveDropdown={setActiveFilterDropdown}
                onChange={setSelectedSpaces}
              />
              <FilterDropdown
                id="material"
                title="Material"
                options={uniqueMaterials}
                selected={selectedMaterials}
                activeDropdown={activeFilterDropdown}
                setActiveDropdown={setActiveFilterDropdown}
                onChange={setSelectedMaterials}
              />
            </div>
            {(selectedCategories.size > 0 || selectedColors.size > 0 || selectedSpaces.size > 0 || selectedMaterials.size > 0) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategories(new Set());
                  setSelectedColors(new Set());
                  setSelectedSpaces(new Set());
                  setSelectedMaterials(new Set());
                }}
                className="ml-1 text-[10px] font-bold text-red-500 hover:text-red-600 dark:text-red-400"
              >
                Reset All
              </button>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {viewMode === 'list' ? (
        <div className="scrollbar-minimal flex-1 min-h-0 w-full overflow-auto rounded-xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-black/25 animate-fade-in">
          <table className="min-w-full table-auto text-left text-sm">
            <thead className="bg-transparent text-xs uppercase tracking-wide text-black/60 dark:text-white/60">
              <tr>
                {displayedColumns.map((c, idx) => {
                  const normalizedCol = c.trim().toLowerCase();
                  const isURL = normalizedCol === 'url';
                  return (
                    <th
                      key={c}
                      className={
                        'sticky top-0 bg-white/70 shadow-sm backdrop-blur-md dark:bg-black/45 ' +
                        (idx === 0 ? 'left-0 z-30 ' : 'z-20 ') +
                        (isURL ? 'w-[150px] min-w-[150px] max-w-[150px] ' : '') +
                        'px-4 py-3 text-left'
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(c)}
                        className="inline-flex items-center gap-2 hover:text-black dark:hover:text-white"
                        title="Sort"
                      >
                        <span>{c}</span>
                        {sortKey === c ? (
                          <span className="text-[10px] text-black/40 dark:text-white/35">{sortDir === 'asc' ? '▲' : '▼'}</span>
                        ) : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading && records.length === 0 ? (
                <ProductsSkeleton viewMode="list" rowsOnly />
              ) : (
                visibleRecords.map((r, i) => {
                  const getCollectionKey = (rec: any) => {
                    return (formatScalar(rec.fields?.['Colecction Name']) || 
                            formatScalar(rec.fields?.Name) || 
                            formatScalar(rec.fields?.['Collection Name']) || 
                            '').trim();
                  };
                  const currentKey = getCollectionKey(r);
                  const prevKey = i > 0 ? getCollectionKey(visibleRecords[i-1]) : null;
                  const nextKey = i < visibleRecords.length - 1 ? getCollectionKey(visibleRecords[i+1]) : null;

                  const isGroupStart = currentKey !== '' && currentKey !== prevKey && currentKey === nextKey;
                  const isGroupEnd = currentKey !== '' && currentKey !== nextKey && currentKey === prevKey;
                  const isMiddleInGroup = currentKey !== '' && currentKey === prevKey && currentKey === nextKey;
                  const isInGroup = currentKey !== '' && (currentKey === prevKey || currentKey === nextKey);

                  const groupBorderClass = 'border-emerald-500/30 dark:border-emerald-400/25';
                  
                  return (
                    <tr
                      key={r.id}
                      className={
                        'align-middle transition-colors ' +
                        (isGroupStart ? `border-t-2 ${groupBorderClass} ` : 
                         isInGroup ? 'border-t-0 ' : 
                         'border-t border-black/10 dark:border-white/10 ') +
                        (isGroupEnd ? `border-b-2 ${groupBorderClass} ` : '') +
                        (selectedIds.has(r.id) 
                          ? 'bg-emerald-50/80 dark:bg-emerald-900/30' 
                          : isInGroup 
                            ? 'bg-emerald-500/[0.02] dark:bg-emerald-400/[0.02]' 
                            : 'bg-white dark:bg-black/10')
                      }
                    >
                      {displayedColumns.map((c, idx) => {
                        const normalizedCol = c.trim().toLowerCase();
                        const isDAM = normalizedCol === 'dam';
                        const isURL = normalizedCol === 'url';
                        const isEditableTag = normalizedCol === 'space' || normalizedCol === 'color' || normalizedCol === 'material' || normalizedCol === 'category';
                        let cellValue = r.fields?.[c];
                        if (isDAM) {
                          const urlEntry = Object.entries(r.fields || {}).find(([k]) => {
                            const kl = k.trim().toLowerCase();
                            return kl === 'url' || kl.endsWith(' url') || kl.endsWith('_url') || kl.endsWith('-url');
                          });
                          cellValue = urlEntry?.[1];
                        }
                        const isEmpty = extractUrls(cellValue).length === 0;
                        const isDebugType = (isDAM || isURL) && isEmpty;
                        
                        const isFirstCol = idx === 0;
                        const isLastCol = idx === displayedColumns.length - 1;

                        return (
                          <td
                            key={c}
                            className={
                              'relative ' +
                              (isFirstCol
                                ? 'sticky left-0 z-10 ' +
                                  (isGroupStart ? `border-t-0 ` : '') +
                                  (selectedIds.has(r.id)
                                    ? 'bg-emerald-50 dark:bg-emerald-900/30 '
                                    : isInGroup
                                      ? 'bg-emerald-50/40 dark:bg-emerald-900/10 '
                                      : 'bg-white dark:bg-black/10 ')
                                : '') +
                              (isInGroup && isFirstCol ? `border-l-2 ${groupBorderClass} ` : '') +
                              (isInGroup && isLastCol ? `border-r-2 ${groupBorderClass} ` : '') +
                              (isURL ? 'w-[150px] min-w-[150px] max-w-[150px] overflow-hidden ' : '') +
                              (isFirstCol
                                ? 'px-4 py-1 whitespace-pre-wrap text-xs text-black/80 dark:text-white/80'
                                : (isEditableTag 
                                    ? 'p-0 h-px' 
                                    : (isDAM
                                      ? 'px-1 py-1 whitespace-pre-wrap text-xs text-black/80 dark:text-white/80'
                                      : (isURL ? 'px-0 py-3' : 'px-4 py-3') + ' whitespace-pre-wrap text-xs text-black/80 dark:text-white/80'))) +
                              (isDebugType ? ' bg-red-500/20 ring-1 ring-red-500/30' : '')
                            }
                            onClick={() => {
                              const colLower = c.trim().toLowerCase();
                              if (colLower === 'image' || isDAM) {
                                const u = extractUrls(cellValue)[0] ?? '';
                                const finalUrl = isDAM ? getDriveDirectLink(u) : u;
                                if (finalUrl) openPreviewByUrl(finalUrl);
                                return;
                              }
                              toggleSelected(r.id);
                            }}
                          >
                            {renderCell(c, cellValue, r.id)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
              {records.length === 0 && !loading ? (
                <tr>
                  <td className="px-4 py-5 text-sm text-black/50 dark:text-white/50" colSpan={displayedColumns.length}>
                    No records.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-minimal w-full rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/25 animate-fade-in">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {loading && records.length === 0 ? (
              <ProductsSkeleton viewMode="gallery" />
            ) : visibleRecords.map((r) => {
              const urlEntry = Object.entries(r.fields || {}).find(([k]) => {
                const kl = k.trim().toLowerCase();
                return kl === 'url' || kl.endsWith(' url') || kl.endsWith('_url') || kl.endsWith('-url');
              });
              const urlValue = urlEntry?.[1];
              const rawImg = extractUrls(urlValue || r.fields?.DAM || r.fields?.Image)[0] ?? '';
              const img = getDriveDirectLink(rawImg);
              const name = formatScalar(r.fields?.['Colecction Name']) || formatScalar(r.fields?.Name);
              const code = formatScalar(r.fields?.['Colecction Code']) || formatScalar(r.fields?.Code);
              const variant = formatScalar(r.fields?.['Variant Number']) || formatScalar(r.fields?.Num);
              const fields = r.fields ?? {};
              const dimensionKey = (() => {
                const keys = Object.keys(fields);
                const normalized = keys.map((k) => ({ k, n: k.trim().toLowerCase() }));
                const mm = normalized.find((x) => x.n.includes('dimension') && x.n.includes('mm'))?.k;
                if (mm) return mm;
                const dim = normalized.find((x) => x.n.startsWith('dimension'))?.k;
                if (dim) return dim;
                const size = normalized.find((x) => x.n.startsWith('size'))?.k;
                if (size) return size;
                return null;
              })();

              const size =
                formatScalar(fields['DIMENSION (mm)']) ||
                formatScalar(fields['Dimension (mm)']) ||
                (dimensionKey ? formatScalar(fields[dimensionKey]) : '') ||
                formatScalar(fields['DIMENSION']) ||
                formatScalar(fields['DIMENSIONS']) ||
                formatScalar(fields['Dimension']) ||
                formatScalar(fields['Dimensions']) ||
                formatScalar(fields['SIZE']) ||
                formatScalar(fields['Size']);
              const price = formatPrice(r.fields?.Price) ?? null;

              return (
                <div key={r.id} className="overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-black/20">
                  <div className="block w-full">
                    <div className="relative aspect-square w-full bg-black/5 dark:bg-white/5">
                      {img ? (
                        <button
                          type="button"
                          className="h-full w-full outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/30"
                          onClick={() => openPreviewByUrl?.(img)}
                          title="Click to maximize"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img}
                            alt="product"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-black/5 text-xs italic text-black/40 dark:bg-white/5 dark:text-white/40">
                          No image
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={
                      'block w-full text-left space-y-0.5 p-2.5 ' +
                      (selectedIds.has(r.id) ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-white dark:bg-black/10')
                    }
                    onClick={() => toggleSelected(r.id)}
                    title={selectedIds.has(r.id) ? 'Selected' : 'Select'}
                    aria-pressed={selectedIds.has(r.id)}
                  >
                    <div className="flex items-start justify-between gap-2 leading-snug">
                      <div className="line-clamp-2 min-w-0 text-sm font-semibold text-black dark:text-white">{name || '—'}</div>
                      <div className="flex-none text-sm font-semibold text-black dark:text-white">
                        {price ? (
                          <>
                            <span className="hidden sm:inline">AED </span>
                            {price}
                          </>
                        ) : (
                          ''
                        )}
                      </div>
                    </div>
                    <div className="text-xs leading-snug text-black/60 dark:text-white/55">{code ? `Code: ${code}` : ' '}</div>
                    <div className="flex items-center justify-between gap-2 text-xs leading-snug text-black/70 dark:text-white/65">
                      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                        <span className="truncate">{variant ? `Variant: ${variant}` : ''}</span>
                        {familyMode === 'main' && (name?.trim() ? (variantCounts[name.trim()] || 0) : 0) > 1 && (
                          <span className="flex-none rounded bg-black/5 px-1 py-0.5 text-[9px] font-bold text-black/40 dark:bg-white/10 dark:text-white/40">
                            +{(variantCounts[name?.trim() || ''] || 0) - 1}
                          </span>
                        )}
                      </div>
                      <span className={selectedIds.has(r.id) ? 'text-emerald-700 dark:text-emerald-300' : 'text-black/35 dark:text-white/30'}>
                        {selectedIds.has(r.id) ? 'Selected' : ''}
                      </span>
                    </div>
                    <div className="text-xs leading-snug text-black/55 dark:text-white/50">{size ? `Size: ${size}` : ' '}</div>
                  </button>
                </div>
              );
            })}
          </div>

          {records.length === 0 && visibleRecords.length === 0 && !loading ? (
            <div className="px-2 py-6 text-sm text-black/50 dark:text-white/50">No records.</div>
          ) : null}
        </div>
      )}

      {selectedCount > 0 && !currentItem ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <div className="mx-auto max-w-xl transform transition-all duration-200 ease-out translate-y-0 opacity-100">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-2 text-black shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/35 dark:text-white">
              <div className="flex items-center justify-between gap-3 px-2 pb-2">
                <div className="text-xs font-medium text-black/60 dark:text-white/70">Selected: {selectedCount}</div>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs font-semibold text-black/60 hover:text-black dark:text-white/70 dark:hover:text-white"
                >
                  Clear
                </button>
              </div>

              <div className="rounded-2xl border border-black/10 bg-black/5 p-1 backdrop-blur dark:border-white/10 dark:bg-black/25">
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => void downloadSelected()}
                    className="h-11 w-full min-w-0 rounded-xl border border-black/10 bg-white/70 px-2 text-[11px] font-medium tracking-wide text-black/80 hover:bg-white dark:border-white/15 dark:bg-black/10 dark:text-white/90 dark:hover:bg-white/10"
                  >
                    <span className="truncate">Download</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void shareSelected()}
                    className="h-11 w-full min-w-0 rounded-xl border border-black/10 bg-white/70 px-2 text-[11px] font-medium tracking-wide text-black/80 hover:bg-white dark:border-white/15 dark:bg-black/10 dark:text-white/90 dark:hover:bg-white/10"
                  >
                    <span className="truncate">Share</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (familyCollectionName) {
                        setFamilyCollectionName(null);
                        return;
                      }
                      setShowSelectedOnly((v) => !v);
                    }}
                    className={
                      'h-11 w-full min-w-0 rounded-xl border px-2 text-[11px] font-medium tracking-wide ' +
                      (familyCollectionName || showSelectedOnly
                        ? 'border-red-200 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100 dark:hover:bg-red-900/30'
                        : 'border-black/10 bg-white/70 text-black/80 hover:bg-white dark:border-white/15 dark:bg-black/10 dark:text-white/90 dark:hover:bg-white/10')
                    }
                  >
                    <span className="truncate">{familyCollectionName ? 'ALL' : showSelectedOnly ? 'ALL' : 'Selected'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {currentItem?.url ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-white/85 backdrop-blur-[2px] p-4 text-black dark:bg-black/85 dark:text-white"
          role="dialog"
          aria-modal="true"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) closePreview();
          }}
        >
          {/* Top Controls */}
          <div className="fixed left-3 top-3 z-[1010] flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/70 text-black/80 shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/35 dark:text-white/85 transition-colors hover:bg-white dark:hover:bg-black/50"
              onClick={(e) => {
                e.stopPropagation();
                closePreview();
              }}
              title="Close"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>

            <div className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-semibold text-black/80 backdrop-blur-md dark:border-white/10 dark:bg-black/35 dark:text-white/85">
              {(typeof currentIndex === 'number' ? currentIndex + 1 : 1)} / {galleryItems.length}
            </div>
          </div>

          {/* Selection Status */}
          {selectedIds.has(currentItem.id) && (
            <div
              className="fixed right-3 top-3 z-[1010] inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300/70 bg-emerald-500/15 text-emerald-700 shadow-lg backdrop-blur dark:border-emerald-200/60 dark:bg-emerald-500/20 dark:text-emerald-50 animate-fade-in"
              onPointerDown={(e) => e.stopPropagation()}
              title="Selected"
              aria-label="Selected"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          {/* Image Container */}
          <div
            className="relative flex items-center justify-center"
            style={{ transform: 'translateY(-15%)' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (galleryItems.length <= 1) return;
              swipeRef.current.pointerId = e.pointerId;
              swipeRef.current.startX = e.clientX;
              swipeRef.current.startY = e.clientY;
              swipeRef.current.moved = false;
              swipeRef.current.swiped = false;
              try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
            }}
            onPointerMove={(e) => {
              if (swipeRef.current.pointerId !== e.pointerId) return;
              const dx = e.clientX - swipeRef.current.startX;
              const dy = e.clientY - swipeRef.current.startY;
              if (!swipeRef.current.moved) {
                if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
                swipeRef.current.moved = true;
              }
              if (swipeRef.current.swiped) return;
              if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 40) {
                swipeRef.current.swiped = true;
                if (dx < 0) goNext(); else goPrev();
              }
            }}
            onPointerUp={(e) => { if (swipeRef.current.pointerId === e.pointerId) swipeRef.current.pointerId = null; }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getDriveDirectLink(currentItem.url)}
              alt={currentItem.title}
              className="max-h-[85vh] w-auto max-w-[95vw] select-none object-contain shadow-2xl transition-transform duration-300"
              draggable={false}
              style={{ touchAction: 'pan-y' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (swipeRef.current.swiped) return;
                if (e.shiftKey || e.pointerType === 'mouse') {
                  toggleSelected(currentItem.id);
                }
              }}
            />
          </div>

          {/* Navigation Arrows */}
          {galleryItems.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                onPointerDown={(e) => e.stopPropagation()}
                className="fixed left-0 top-0 flex h-full w-[60px] items-center justify-center bg-transparent group"
                aria-label="Previous"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white/55 text-lg font-semibold text-black shadow-sm backdrop-blur transition-all group-hover:bg-white dark:border-white/15 dark:bg-black/20 dark:text-white dark:group-hover:bg-black/40">
                  ‹
                </span>
              </button>
              <button
                type="button"
                onClick={goNext}
                onPointerDown={(e) => e.stopPropagation()}
                className="fixed right-0 top-0 flex h-full w-[60px] items-center justify-center bg-transparent group"
                aria-label="Next"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white/55 text-lg font-semibold text-black shadow-sm backdrop-blur transition-all group-hover:bg-white dark:border-white/15 dark:bg-black/20 dark:text-white dark:group-hover:bg-black/40">
                  ›
                </span>
              </button>
            </>
          )}

          {/* Details Panel */}
          <div
            className="fixed bottom-0 left-0 right-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              className={
                'mx-auto max-h-[45vh] max-w-xl rounded-2xl border p-4 pb-28 text-black shadow-lg backdrop-blur dark:text-white transition-all duration-300 ease-out ' +
                (selectedIds.has(currentItem.id)
                  ? 'border-emerald-300/40 bg-emerald-500/10 dark:border-emerald-200/40 dark:bg-emerald-900/20'
                  : 'border-black/10 bg-white/70 dark:border-white/10 dark:bg-black/35') +
                (lightboxDetailsCollapsed ? ' max-h-[120px] sm:max-h-[200px] overflow-hidden mt-8' : ' max-h-[55vh] sm:max-h-[45vh] overflow-auto')
              }
              onClick={() => {
                if (currentCollectionVariants.length > 1) {
                  setLightboxDetailsCollapsed((v) => !v);
                }
              }}
            >
              <div className="relative">
                {currentCollectionVariants.length > 1 && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxDetailsCollapsed((v) => !v);
                    }}
                    className="absolute left-1/2 top-0 z-10 inline-flex h-10 w-10 -translate-x-1/2 -translate-y-[27px] items-center justify-center text-black/60 hover:text-black dark:text-white/55 dark:hover:text-white"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={'h-5 w-5 transition-transform duration-200 ease-out ' + (lightboxDetailsCollapsed ? '' : 'rotate-180')}
                      fill="none"
                    >
                      <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}

                <div className="overflow-hidden rounded-xl border border-black/10 bg-black/5 transition-all duration-300 dark:border-white/10 dark:bg-black/10">
                  <div className="grid grid-cols-5 gap-px bg-black/10 dark:bg-white/10">
                    <div className="min-h-10 bg-white/60 px-3 py-2 text-[11px] font-medium leading-tight text-black/60 dark:bg-black/20 dark:text-white/70">Collection</div>
                    <div className="min-h-10 bg-white/60 px-3 py-2 text-[11px] font-medium leading-tight text-black/60 dark:bg-black/20 dark:text-white/70">Code</div>
                    <div className="min-h-10 bg-white/60 px-3 py-2 text-[11px] font-medium leading-tight text-black/60 dark:bg-black/20 dark:text-white/70">Variant</div>
                    <div className="min-h-10 bg-white/60 px-3 py-2 text-[11px] font-medium leading-tight text-black/60 dark:bg-black/20 dark:text-white/70">Dimension</div>
                    <div className="min-h-10 bg-white/60 px-3 py-2 text-[11px] font-medium leading-tight text-black/60 dark:bg-black/20 dark:text-white/70">Price</div>

                    {currentCollectionVariants[0] && (
                      <React.Fragment key={currentCollectionVariants[0].id}>
                        {(() => {
                          const v = currentCollectionVariants[0];
                          const baseClass = selectedIds.has(v.id)
                            ? 'bg-emerald-100 px-3 py-2 text-left text-sm leading-tight hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 font-semibold text-emerald-900 dark:text-emerald-100'
                            : 'bg-white/70 px-3 py-2 text-left text-sm leading-tight hover:bg-white dark:bg-black/20 dark:hover:bg-black/30 font-semibold text-black dark:text-white';
                          const handler = (e: React.PointerEvent | React.MouseEvent) => {
                            e.stopPropagation();
                            if (e.shiftKey) { toggleSelected(v.id); return; }
                            const key = (v.collectionNameNormalized || '').trim();
                            if (key) setFamilyCollectionName(key);
                            setPreviewId(v.id);
                            setPreviewIndex((i) => (i === null ? 0 : i));
                            setLightboxDetailsCollapsed(true);
                          };
                          return (
                            <>
                              <button type="button" className={baseClass} onClick={handler}><div className="truncate">{v.title}</div></button>
                              <button type="button" className={baseClass} onClick={handler}><div className="truncate">{v.code || '—'}</div></button>
                              <button type="button" className={baseClass} onClick={handler}><div className="truncate">{v.variant || '—'}</div></button>
                              <button type="button" className={baseClass} onClick={handler}><div className="truncate">{v.dimension || '—'}</div></button>
                              <button type="button" className={baseClass} onClick={handler}><div className="truncate">{v.price ? <><span className="hidden sm:inline">AED </span>{v.price}</> : '—'}</div></button>
                            </>
                          );
                        })()}
                      </React.Fragment>
                    )}
                  </div>

                  <div className={'transition-[max-height] duration-300 ease-out ' + (lightboxDetailsCollapsed ? 'max-h-0 pointer-events-none overflow-hidden' : 'max-h-[50vh] overflow-y-auto')}>
                    <div className="grid grid-cols-5 gap-px bg-black/10 dark:bg-white/10">
                      {currentCollectionVariants.slice(1).map((v) => (
                        <React.Fragment key={v.id}>
                          <button
                            type="button"
                            className={selectedIds.has(v.id) ? 'bg-emerald-100 px-3 py-2 text-left text-sm text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100' : 'bg-white/70 px-3 py-2 text-left text-sm text-black/70 hover:bg-white dark:bg-black/20 dark:text-white/65'}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (e.shiftKey) { toggleSelected(v.id); return; }
                              const key = (v.collectionNameNormalized || '').trim();
                              if (key) setFamilyCollectionName(key);
                              setPreviewId(v.id);
                              setPreviewIndex((i) => (i === null ? 0 : i));
                              setLightboxDetailsCollapsed(true);
                            }}
                          >
                            <div className="truncate">{v.title}</div>
                          </button>
                          {/* Code, Variant, Dimension, Price buttons... keep concise */}
                          <div className="bg-white/70 px-3 py-2 text-sm dark:bg-black/20">{v.code || '—'}</div>
                          <div className="bg-white/70 px-3 py-2 text-sm dark:bg-black/20">{v.variant || '—'}</div>
                          <div className="bg-white/70 px-3 py-2 text-sm dark:bg-black/20">{v.dimension || '—'}</div>
                          <div className="bg-white/70 px-3 py-2 text-sm dark:bg-black/20">{v.price ? <><span className="hidden sm:inline">AED </span>{v.price}</> : '—'}</div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lightbox Selection Bar */}
          <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5" onPointerDown={(e) => e.stopPropagation()}>
            <div className="mx-auto max-w-xl">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-2 shadow-lg backdrop-blur">
                <div className="flex items-center justify-between gap-3 px-2 pb-2">
                  <div className="text-xs font-medium text-white/70">Selected: {selectedCount}</div>
                  {selectedCount > 0 && (
                    <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs font-semibold text-white/70 hover:text-white">Clear</button>
                  )}
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-1">
                  <div className="grid grid-cols-3 gap-1">
                    <button type="button" onClick={() => void downloadSelected()} className="h-11 rounded-xl border border-white/15 bg-black/10 text-[11px] font-medium text-white/90 hover:bg-white/10">Download</button>
                    <button type="button" onClick={() => void shareSelected()} className="h-11 rounded-xl border border-white/15 bg-black/10 text-[11px] font-medium text-white/90 hover:bg-white/10">Share</button>
                    <button
                      type="button"
                      onClick={() => {
                        const key = (currentItem?.collectionNameNormalized || '').trim();
                        if (familyCollectionName) setFamilyCollectionName(null);
                        else if (key) setFamilyCollectionName(key);
                      }}
                      className={'h-11 rounded-xl border px-2 text-[11px] font-medium ' + (familyCollectionName ? 'border-red-300 bg-red-500/10 text-red-100' : 'border-white/15 bg-black/10 text-white/90')}
                    >
                      {familyCollectionName ? 'ALL' : 'Collection'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {fieldEditPortal}
      <ActivityLogModal isOpen={showActivityLogs} onClose={() => setShowActivityLogs(false)} />
    </main>
  );
}
