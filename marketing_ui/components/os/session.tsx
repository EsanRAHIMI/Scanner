'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { BrandHeader } from '@/lib/brand-header';
import type { Me } from '@/lib/os/model';

type Session = { me: Me | null; isAdmin: boolean; reload: () => Promise<void> };

const SessionContext = createContext<Session>({ me: null, isAdmin: false, reload: async () => undefined });

export function useSession(): Session {
  return useContext(SessionContext);
}

type State = { kind: 'loading' } | { kind: 'signed-out' } | { kind: 'down' } | { kind: 'ready'; me: Me };

let cached: { at: number; state: Exclude<State, { kind: 'loading' }> } | null = null;

async function check(force = false): Promise<State> {
  if (!force && cached && Date.now() - cached.at < 30_000) return cached.state;
  const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch('/api/trainer/auth/me', { cache: 'no-store', signal: ctrl.signal });
    if (res.status === 401 || res.status === 403) {
      cached = { at: Date.now(), state: { kind: 'signed-out' } };
      return cached.state;
    }
    if (!res.ok) return { kind: 'down' };
    cached = { at: Date.now(), state: { kind: 'ready', me: (await res.json()) as Me } };
    return cached.state;
  } catch {
    return { kind: 'down' };
  } finally {
    window.clearTimeout(timer);
  }
}

export function SessionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const reload = useCallback(async () => {
    setState(await check(true));
  }, []);

  useEffect(() => {
    let live = true;
    void check().then((next) => live && setState(next));
    return () => {
      live = false;
    };
  }, []);

  if (state.kind === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-burgundy/20 border-t-brand-burgundy" />
      </div>
    );
  }
  if (state.kind === 'signed-out') return <SignIn onDone={reload} />;
  if (state.kind === 'down') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="os-panel max-w-sm p-6 text-center">
          <p className="font-semibold">Sign-in service is not reachable</p>
          <p className="mt-1 text-sm text-brand-dark-gray">The marketing app could not check your session.</p>
          <button type="button" className="btn-primary mt-4" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ me: state.me, isAdmin: Boolean(state.me.is_admin), reload }}>{children}</SessionContext.Provider>
  );
}

function SignIn({ onDone }: { onDone: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/trainer/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError(res.status === 401 ? 'Email or password is not right.' : 'Sign-in failed. Try again.');
        return;
      }
      await onDone();
    } catch {
      setError('Sign-in service is not reachable.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-light-gray p-4">
      <form
        className="os-panel w-full max-w-sm space-y-4 p-7"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <BrandHeader appName="Marketing" tagline="Lorenzo operating system" />
        <div>
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="mt-0.5 text-sm text-brand-dark-gray">Use your Lorenzo platform account.</p>
        </div>
        <input className="os-input" type="email" autoComplete="username" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="os-input" type="password" autoComplete="current-password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button className="btn-primary w-full py-2.5" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
