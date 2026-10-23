'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

type Gate = 'loading' | 'ready' | 'signed-out' | 'pending' | 'down';

const WAITING =
  'Your account is waiting for super admin approval. You cannot see products, prices, or anything else until it is approved.';

function clearCatalogCache() {
  try {
    window.sessionStorage.removeItem('products_assets_cache_v1');
  } catch {
    /* ignore */
  }
}

async function readDetail(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { detail?: unknown };
    if (data.detail === 'USER_NOT_APPROVED') return WAITING;
    if (typeof data.detail === 'string' && data.detail) return data.detail;
  } catch {
    /* plain text */
  }
  return text || `Request failed (${res.status})`;
}

export function AccessGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<Gate>('loading');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/trainer/auth/me', { cache: 'no-store', credentials: 'include' });
        if (!live) return;
        if (res.status === 401) {
          clearCatalogCache();
          setGate('signed-out');
          return;
        }
        if (res.status === 403) {
          clearCatalogCache();
          const detail = await readDetail(res);
          setInfo(detail === WAITING || detail.includes('USER_NOT_APPROVED') ? WAITING : detail);
          setGate('pending');
          return;
        }
        if (!res.ok) {
          setGate('down');
          return;
        }
        setGate('ready');
      } catch {
        if (live) setGate('down');
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const body =
        mode === 'login'
          ? { email, password }
          : { email, username, password };
      const res = await fetch(`/api/trainer${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await readDetail(res);
        if (res.status === 403 || detail === WAITING) {
          clearCatalogCache();
          setInfo(WAITING);
          setGate('pending');
          return;
        }
        setError(detail);
        return;
      }
      if (mode === 'register') {
        const data = (await res.json()) as { status?: string };
        clearCatalogCache();
        if (data.status === 'approved') {
          setInfo('Account created. Sign in to continue.');
          setMode('login');
          setPassword('');
          return;
        }
        setInfo(WAITING);
        setGate('pending');
        return;
      }
      setGate('ready');
    } catch {
      setError('Sign-in service is not reachable.');
    } finally {
      setBusy(false);
    }
  }

  if (gate === 'loading') {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-black/60" aria-busy="true">
        Checking access…
      </div>
    );
  }

  if (gate === 'ready') return <>{children}</>;

  if (gate === 'down') {
    return (
      <div className="flex h-dvh items-center justify-center p-6 text-center text-sm">
        Sign-in service is not reachable.
      </div>
    );
  }

  if (gate === 'pending') {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm leading-6">
          {info || WAITING}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh items-center justify-center p-6">
      <form className="w-full max-w-sm space-y-3 rounded-2xl border border-black/10 bg-white p-6 shadow-sm" onSubmit={(e) => void submit(e)}>
        <div>
          <h1 className="text-lg font-semibold">Products</h1>
          <p className="mt-1 text-sm text-black/60">Sign in to see the catalog. New accounts stay empty until a super admin approves them.</p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/5 p-1 text-sm">
          <button type="button" className={`rounded-md px-3 py-2 ${mode === 'login' ? 'bg-white shadow-sm' : ''}`} onClick={() => { setMode('login'); setError(null); setInfo(null); }}>
            Sign in
          </button>
          <button type="button" className={`rounded-md px-3 py-2 ${mode === 'register' ? 'bg-white shadow-sm' : ''}`} onClick={() => { setMode('register'); setError(null); setInfo(null); }}>
            Register
          </button>
        </div>
        <label className="block text-sm">
          Email
          <input className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode === 'register' ? (
          <label className="block text-sm">
            Username
            <input className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" type="text" autoComplete="username" required minLength={3} value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
        ) : null}
        <label className="block text-sm">
          Password
          <input className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {info ? <p className="text-sm text-amber-900">{info}</p> : null}
        <button className="w-full rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={busy} type="submit">
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
