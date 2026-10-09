'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

import { createAuthApi } from './api';
import { buildDefaultMenuItems, LOCAL_SERVICE_URLS } from './menu-items';
import type { AccountMenuItem, AuthMe, ScannerAccountMenuProps, ScannerServiceUrls } from './types';

function isLocalHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

type MenuItemVariant = 'default' | 'accent' | 'primary';

function itemClass(variant: MenuItemVariant = 'default', darkChrome = false): string {
  const base =
    'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2';
  if (darkChrome) {
    if (variant === 'primary') {
      return `${base} bg-white text-zinc-950 hover:bg-zinc-100 focus-visible:ring-white/30`;
    }
    if (variant === 'accent') {
      return `${base} bg-violet-500/20 text-violet-100 hover:bg-violet-500/30 focus-visible:ring-violet-400/30`;
    }
    return `${base} text-zinc-100 hover:bg-zinc-800 focus-visible:ring-zinc-500/40`;
  }
  if (variant === 'primary') {
    return `${base} bg-black text-white hover:bg-black/90 focus-visible:ring-black/10`;
  }
  if (variant === 'accent') {
    return `${base} bg-violet-500/10 text-violet-700 hover:bg-violet-500/15 focus-visible:ring-violet-500/20`;
  }
  return `${base} text-black/75 hover:bg-black/[0.05] focus-visible:ring-black/10`;
}

function getInitial(value?: string): string {
  const text = value?.trim();
  return text ? text[0].toUpperCase() : 'U';
}

export function ScannerAccountMenu({
  authApiPrefix = '/api/trainer',
  serviceUrlsPath = '/api/service-urls',
  app = 'products',
  extraMenuItems = [],
  menuItems,
  onAuthChange,
  onLoggedOut,
  onActivityLogs,
  surface,
  className,
  align = 'right',
}: ScannerAccountMenuProps) {
  const auth = React.useMemo(() => createAuthApi(authApiPrefix), [authApiPrefix]);

  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [me, setMe] = React.useState<AuthMe | null>(null);
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [email, setEmail] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [registerDone, setRegisterDone] = React.useState<{ status: string; user_id: string } | null>(
    null,
  );
  const [serviceUrls, setServiceUrls] = React.useState<ScannerServiceUrls | null>(null);

  const triggerRef = React.useRef<HTMLDivElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [panelPos, setPanelPos] = React.useState({ top: 0, left: 0, width: 340 });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isLocalHost()) {
      setServiceUrls(LOCAL_SERVICE_URLS);
      return;
    }
    let cancelled = false;
    fetch(serviceUrlsPath, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`service-urls ${res.status}`);
        return res.json() as Promise<ScannerServiceUrls>;
      })
      .then((data) => {
        if (!cancelled) setServiceUrls(data);
      })
      .catch(() => {
        if (!cancelled) setServiceUrls(null);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceUrlsPath]);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onMouseDown(e: MouseEvent) {
      if (!open) return;
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [open]);

  const updatePanelPosition = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 16);
    const top = rect.bottom + 8;
    const left =
      align === 'right'
        ? Math.max(8, rect.right - width)
        : Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setPanelPos({ top, left, width });
  }, [align]);

  React.useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  const resolvedMenuItems = React.useMemo(() => {
    if (menuItems) return menuItems;
    return [
      ...buildDefaultMenuItems(app, serviceUrls, { onActivityLogs }),
      ...extraMenuItems,
    ];
  }, [app, extraMenuItems, menuItems, onActivityLogs, serviceUrls]);

  const visibleItems = React.useMemo(() => {
    if (!me) return [];
    return resolvedMenuItems.filter((item) => !item.adminOnly || me.is_admin);
  }, [me, resolvedMenuItems]);

  async function loadMe() {
    setError(null);
    setLoading(true);
    try {
      const user = await auth.loadMe();
      setMe(user);
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
      await auth.logout();
      setMe(null);
      setMode('login');
      onLoggedOut?.();
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
        await auth.login(email, password);
        await loadMe();
        setOpen(false);
        onAuthChange?.();
        return;
      }
      const data = await auth.register(email, username, password);
      setRegisterDone({ status: data.status, user_id: data.user_id });
    } catch (e) {
      setError(e instanceof Error ? e.message : mode === 'login' ? 'Login failed' : 'Register failed');
    } finally {
      setLoading(false);
    }
  }

  const darkChrome = surface === 'dark';

  const panelShellClass =
    'overflow-hidden rounded-2xl border shadow-2xl ' +
    (darkChrome
      ? 'border-zinc-600 bg-zinc-900 text-zinc-100 shadow-black/70'
      : 'border-black/10 bg-white text-black shadow-black/10');

  return (
    <>
      <div ref={triggerRef} className={['relative', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        onClick={() => void onToggle()}
        className={
          'group inline-flex h-10 items-center gap-2 rounded-full border px-1.5 pr-2.5 text-sm shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2' +
          (darkChrome
            ? ' border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 focus-visible:ring-zinc-500/50' +
              (open ? ' ring-2 ring-zinc-500/60' : '')
            : ' border-black/10 bg-white text-black hover:bg-zinc-50 focus-visible:ring-black/15' +
              (open ? ' ring-2 ring-black/10' : ''))
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title="Account"
      >
        <span
          className={
            'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ' +
            (darkChrome ? 'bg-white text-zinc-950' : 'bg-black text-white')
          }
        >
          {me ? (
            getInitial(me.username || me.email)
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </span>
        <span className="hidden max-w-24 truncate font-medium sm:inline">
          {me?.username || 'Account'}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className={`h-4 w-4 transition-transform ${darkChrome ? 'text-zinc-400' : 'text-black/45'} ${open ? 'rotate-180' : ''}`}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 8 4 4 4-4" />
        </svg>
      </button>
      </div>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              className="fixed z-[9999]"
              style={{
                top: panelPos.top,
                left: panelPos.left,
                width: panelPos.width,
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className={panelShellClass}>
                <div className="max-h-[min(70vh,520px)] overflow-y-auto p-2.5">
            {loading ? (
              <div className="space-y-2 p-1">
                <div
                  className={`h-16 animate-pulse rounded-xl ${darkChrome ? 'bg-zinc-800' : 'bg-black/5'}`}
                />
                <div
                  className={`h-10 animate-pulse rounded-lg ${darkChrome ? 'bg-zinc-800' : 'bg-black/5'}`}
                />
                <div
                  className={`h-10 animate-pulse rounded-lg ${darkChrome ? 'bg-zinc-800' : 'bg-black/5'}`}
                />
              </div>
            ) : null}

            {!loading && me ? (
              <div className="space-y-2">
                <div
                  className={`rounded-xl p-3 ${darkChrome ? 'bg-zinc-800' : 'bg-black/[0.035]'}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ' +
                        (darkChrome ? 'bg-white text-zinc-950' : 'bg-black text-white')
                      }
                    >
                      {getInitial(me.username || me.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          'text-[11px] font-medium uppercase tracking-[0.14em] ' +
                          (darkChrome ? 'text-zinc-400' : 'text-black/45')
                        }
                      >
                        Signed in as
                      </p>
                      <p
                        className={
                          'mt-1 truncate text-sm font-semibold ' +
                          (darkChrome ? 'text-white' : 'text-black')
                        }
                      >
                        {me.username}
                      </p>
                      <p
                        className={
                          'truncate text-xs ' + (darkChrome ? 'text-zinc-300' : 'text-black/55')
                        }
                      >
                        {me.email}
                      </p>
                    </div>
                    {me.is_admin ? (
                      <span
                        className={
                          'shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ' +
                          (darkChrome
                            ? 'bg-emerald-500/20 text-emerald-200'
                            : 'bg-emerald-500/10 text-emerald-700')
                        }
                      >
                        Admin
                      </span>
                    ) : null}
                  </div>
                </div>

                {error ? (
                  <p
                    className={
                      'rounded-lg px-3 py-2 text-sm ' +
                      (darkChrome
                        ? 'bg-red-950/80 text-red-200'
                        : 'bg-red-500/10 text-red-700')
                    }
                  >
                    {error}
                  </p>
                ) : null}

                <div
                  className={
                    'space-y-1 border-t pt-2 ' +
                    (darkChrome ? 'border-zinc-700' : 'border-black/5')
                  }
                >
                  {visibleItems.length ? (
                    <p
                      className={
                        'px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.14em] ' +
                        (darkChrome ? 'text-zinc-500' : 'text-black/40')
                      }
                    >
                      Workspace
                    </p>
                  ) : null}
                  {visibleItems.map((item) => {
                    if (item.kind === 'link') {
                      const disabled = !item.href || item.href === '#';
                      return (
                        <a
                          key={item.id}
                          href={item.href}
                          className={
                            itemClass(item.variant ?? 'default', darkChrome) +
                            (disabled ? ' pointer-events-none opacity-50' : '')
                          }
                          role="menuitem"
                          aria-disabled={disabled}
                          onClick={() => setOpen(false)}
                        >
                          {item.label}
                        </a>
                      );
                    }
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={itemClass('default', darkChrome)}
                        role="menuitem"
                        onClick={() => {
                          item.onClick();
                          setOpen(false);
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => void onLogout()}
                  disabled={loading}
                  className={
                    'mt-2 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ' +
                    (darkChrome
                      ? 'text-red-300 hover:bg-red-950/60'
                      : 'text-red-600 hover:bg-red-500/10')
                  }
                  role="menuitem"
                >
                  <span>Logout</span>
                  <span aria-hidden>&gt;</span>
                </button>
              </div>
            ) : null}

            {!loading && !me ? (
              <div className="space-y-3 p-1">
                <div>
                  <p
                    className={
                      'text-sm font-semibold ' + (darkChrome ? 'text-white' : 'text-black')
                    }
                  >
                    Account access
                  </p>
                  <p
                    className={
                      'mt-1 text-xs leading-5 ' +
                      (darkChrome ? 'text-zinc-300' : 'text-black/55')
                    }
                  >
                    Sign in once to use the same account across services.
                  </p>
                </div>
                <div
                  className={
                    'flex gap-1 rounded-lg p-1 ' +
                    (darkChrome ? 'bg-zinc-800' : 'bg-black/5')
                  }
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setRegisterDone(null);
                      setError(null);
                    }}
                    className={
                      'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
                      (mode === 'login'
                        ? darkChrome
                          ? 'bg-white text-zinc-950 shadow-sm'
                          : 'bg-white text-black shadow-sm'
                        : darkChrome
                          ? 'text-zinc-400 hover:text-white'
                          : 'text-black/60 hover:text-black')
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
                      'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
                      (mode === 'register'
                        ? darkChrome
                          ? 'bg-white text-zinc-950 shadow-sm'
                          : 'bg-white text-black shadow-sm'
                        : darkChrome
                          ? 'text-zinc-400 hover:text-white'
                          : 'text-black/60 hover:text-black')
                    }
                  >
                    Register
                  </button>
                </div>

                {registerDone ? (
                  <div
                    className={
                      'rounded-lg p-3 text-sm ' +
                      (darkChrome
                        ? 'bg-emerald-950/70 text-emerald-200'
                        : 'bg-emerald-500/10 text-emerald-800')
                    }
                  >
                    Account created — status:{' '}
                    <span className="font-medium">{registerDone.status}</span>
                  </div>
                ) : (
                  <form className="space-y-2.5" onSubmit={(e) => void onSubmit(e)}>
                    <Field label="Email" darkChrome={darkChrome}>
                      <input
                        className={inputClass(darkChrome)}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        autoComplete="email"
                        required
                      />
                    </Field>
                    {mode === 'register' ? (
                      <Field label="Username" darkChrome={darkChrome}>
                        <input
                          className={inputClass(darkChrome)}
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          type="text"
                          autoComplete="username"
                          required
                        />
                      </Field>
                    ) : null}
                    <Field label="Password" darkChrome={darkChrome}>
                      <input
                        className={inputClass(darkChrome)}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        required
                      />
                    </Field>
                    {error ? (
                      <p
                        className={
                          'text-sm ' + (darkChrome ? 'text-red-300' : 'text-red-700')
                        }
                      >
                        {error}
                      </p>
                    ) : null}
                    <button
                      className={
                        'w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ' +
                        (darkChrome
                          ? 'bg-white text-zinc-950 hover:bg-zinc-100'
                          : 'bg-black text-white hover:bg-black/90')
                      }
                      disabled={loading}
                      type="submit"
                    >
                      {mode === 'login'
                        ? loading
                          ? 'Logging in…'
                          : 'Login'
                        : loading
                          ? 'Creating…'
                          : 'Create account'}
                    </button>
                  </form>
                )}
              </div>
            ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function inputClass(darkChrome = false): string {
  if (darkChrome) {
    return (
      'h-11 w-full rounded-xl border border-zinc-600 bg-zinc-800 px-3 text-sm text-white outline-none ring-0 transition-all ' +
      'placeholder:text-zinc-500 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-500/40'
    );
  }
  return (
    'h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm text-black outline-none ring-0 transition-all ' +
    'placeholder:text-black/30 focus:border-black/30 focus:ring-2 focus:ring-black/10'
  );
}

function Field({
  label,
  children,
  darkChrome = false,
}: {
  label: string;
  children: React.ReactNode;
  darkChrome?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label
        className={
          'text-xs font-medium ' + (darkChrome ? 'text-zinc-300' : 'text-black/55')
        }
      >
        {label}
      </label>
      {children}
    </div>
  );
}
