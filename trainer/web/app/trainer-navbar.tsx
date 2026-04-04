'use client';

import Link from 'next/link';
import * as React from 'react';

import { apiFetch } from '@/lib/api';

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-md px-3 py-2 text-sm text-black/70 hover:bg-black/5 hover:text-black">
      {label}
    </Link>
  );
}

export function TrainerNavbar({ scannerUrl }: { scannerUrl: string }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [me, setMe] = React.useState<{ email: string; username: string; is_admin: boolean; permissions: string[] } | null>(null);
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
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `Failed to load user (${res.status})`);
      }
      const data = JSON.parse(text) as { email?: string; username?: string; is_admin?: boolean; permissions?: unknown };
      const perms = Array.isArray(data.permissions) ? data.permissions.filter((p): p is string => typeof p === 'string') : [];
      if (!data.email || !data.username) {
        throw new Error('Invalid /auth/me response');
      }
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
    if (next && !me && !loading) {
      await loadMe();
    }
  }

  async function onLogout() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/auth/logout', { method: 'POST' });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `Logout failed (${res.status})`);
      }
      window.location.href = '/login';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Logout failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={
        'sticky top-0 z-30 -mx-5 overflow-visible sm:mx-0 ' +
        'transition-[max-height,transform,opacity] duration-300 ease-in-out ' +
        'translate-y-0 opacity-100 max-h-[140px]'
      }
    >
      <header className="border-b border-black/10 bg-white/90 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/70 sm:px-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs tracking-[0.35em] text-black/60">LORENZO</div>
            <div className="text-lg font-semibold">Trainer</div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex flex-wrap gap-1">
              <NavLink href="/" label="Dashboard" />
              <NavLink href="/upload" label="Upload" />
              <NavLink href="/queue" label="Queue" />
              <NavLink href="/classes" label="Classes" />
              <NavLink href="/train" label="Train" />
              <NavLink href="/dam" label="DAM" />
              <NavLink href="/products" label="Products" />
              <a href={scannerUrl} className="rounded-md px-3 py-2 text-sm text-black/70 hover:bg-black/5 hover:text-black">
                Scanner
              </a>
            </nav>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={onToggle}
                className="rounded-md px-3 py-2 text-sm text-black/70 hover:bg-black/5 hover:text-black"
                aria-haspopup="menu"
                aria-expanded={open}
                title="Account"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path
                      d="M20 21a8 8 0 0 0-16 0"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </button>

              {open ? (
                <div
                  className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-black/10 bg-white p-3 shadow-sm"
                  role="menu"
                >
                  {loading ? <div className="text-sm text-black/60">Loading...</div> : null}

                  {!loading && me ? (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-black/10 bg-black/5 p-3">
                        <div className="text-xs text-black/60">Signed in as</div>
                        <div className="mt-1 text-sm font-medium text-black">{me.username}</div>
                        <div className="text-xs text-black/70">{me.email}</div>
                      </div>

                      {me.is_admin ? (
                        <a
                          className="block w-full rounded-md border border-black/15 px-4 py-2 text-center text-sm text-black hover:bg-black/5"
                          href="/admin/users"
                          role="menuitem"
                        >
                          Manage users
                        </a>
                      ) : null}

                      {error ? <div className="text-sm text-red-700">{error}</div> : null}

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
                    <div className="space-y-2">
                      {error ? <div className="text-sm text-red-700">{error}</div> : null}
                      <button
                        type="button"
                        onClick={loadMe}
                        disabled={loading}
                        className="w-full rounded-md border border-black/15 px-4 py-2 text-sm text-black hover:bg-black/5 disabled:opacity-60"
                        role="menuitem"
                      >
                        Retry
                      </button>
                      <a
                        className="block w-full rounded-md border border-black/15 px-4 py-2 text-center text-sm text-black hover:bg-black/5"
                        href="/login"
                        role="menuitem"
                      >
                        Go to login
                      </a>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
