'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { BrandHeader } from '@/lib/brand-header';
import type { Me } from '@/lib/os/model';

type Session = { me: Me | null; isAdmin: boolean; reload: () => Promise<void> };

const SessionContext = createContext<Session>({ me: null, isAdmin: false, reload: async () => undefined });

export function useSession(): Session {
  return useContext(SessionContext);
}

type State = { kind: 'loading' } | { kind: 'signed-out' } | { kind: 'pending' } | { kind: 'down' } | { kind: 'ready'; me: Me };

let cached: { at: number; state: Exclude<State, { kind: 'loading' }> } | null = null;

async function check(force = false): Promise<State> {
  if (!force && cached && Date.now() - cached.at < 30_000) return cached.state;
  const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch('/api/trainer/auth/me', { cache: 'no-store', signal: ctrl.signal });
    if (res.status === 401) {
      cached = { at: Date.now(), state: { kind: 'signed-out' } };
      return cached.state;
    }
    if (res.status === 403) {
      const text = await res.text();
      cached = {
        at: Date.now(),
        state: { kind: text.includes('USER_NOT_APPROVED') ? 'pending' : 'signed-out' },
      };
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
  if (state.kind === 'pending') return <WaitingApproval />;
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

const WAITING =
  'Your account is waiting for super admin approval. You cannot see products, prices, strategy, or anything else until it is approved.';

function WaitingApproval() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-light-gray p-4">
      <div className="os-panel w-full max-w-md p-7 text-sm leading-6">{WAITING}</div>
    </div>
  );
}

function SignIn({ onDone }: { onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(mode === 'login' ? '/api/trainer/auth/login' : '/api/trainer/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'login' ? { email, password } : { email, username, password }),
      });
      const text = await res.text();
      if (!res.ok) {
        if (res.status === 403 || text.includes('USER_NOT_APPROVED')) {
          setWaiting(true);
          return;
        }
        setError(res.status === 401 ? 'Email or password is not right.' : 'Sign-in failed. Try again.');
        return;
      }
      if (mode === 'register') {
        const data = JSON.parse(text) as { status?: string };
        if (data.status !== 'approved') {
          setWaiting(true);
          return;
        }
        setMode('login');
        setPassword('');
        setError('Account created. Sign in to continue.');
        return;
      }
      await onDone();
    } catch {
      setError('Sign-in service is not reachable.');
    } finally {
      setBusy(false);
    }
  }

  if (waiting) return <WaitingApproval />;

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
          <h1 className="text-lg font-semibold">{mode === 'login' ? 'Sign in' : 'Register'}</h1>
          <p className="mt-0.5 text-sm text-brand-dark-gray">
            {mode === 'login'
              ? 'Use your Lorenzo platform account.'
              : 'A new account cannot see anything until a super admin approves it.'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/5 p-1 text-sm">
          <button type="button" className={`rounded-md px-3 py-2 ${mode === 'login' ? 'bg-white shadow-sm' : ''}`} onClick={() => setMode('login')}>Sign in</button>
          <button type="button" className={`rounded-md px-3 py-2 ${mode === 'register' ? 'bg-white shadow-sm' : ''}`} onClick={() => setMode('register')}>Register</button>
        </div>
        <input className="os-input" type="email" autoComplete="username" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode === 'register' ? (
          <input className="os-input" type="text" autoComplete="username" required minLength={3} placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        ) : null}
        <input className="os-input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button className="btn-primary w-full py-2.5" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <p className="text-center text-xs text-brand-dark-gray">
          <a className="underline underline-offset-2" href="/privacy">
            Privacy policy
          </a>
        </p>
      </form>
    </div>
  );
}
