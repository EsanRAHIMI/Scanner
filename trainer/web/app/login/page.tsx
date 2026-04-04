'use client';

import * as React from 'react';

import { apiFetch } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  function normalizeNext(raw: string | null) {
    if (!raw) return '/';
    if (!raw.startsWith('/')) return '/';
    return raw;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `Login failed (${res.status})`);
      }

      const url = new URL(window.location.href);
      const next = normalizeNext(url.searchParams.get('next'));
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
      <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="text-xl font-semibold">Login</div>
        <div className="mt-1 text-sm text-black/60">Use your approved account.</div>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-xs text-black/60">Email</label>
            <input
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-black/60">Password</label>
            <input
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? <div className="text-sm text-red-700">{error}</div> : null}

          <button
            className="w-full rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/90 disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <a className="block text-center text-sm text-black/70 underline" href="/register">
            Create an account
          </a>
        </form>
      </div>
    </main>
  );
}
