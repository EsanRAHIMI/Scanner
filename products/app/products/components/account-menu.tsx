'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';
import { AuthMe } from '../types';

interface AccountMenuProps {
  onAuthChange?: () => void;
}

export function AccountMenu({ onAuthChange }: AccountMenuProps) {
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
