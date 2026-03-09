'use client';

import * as React from 'react';

import { apiFetch } from '@/lib/api';

export default function RegisterPage() {
  const [email, setEmail] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState<{ status: string; user_id: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `Register failed (${res.status})`);
      }
      const data = JSON.parse(text) as { status: string; user_id: string };
      setDone({ status: data.status, user_id: data.user_id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Register failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
      <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="text-xl font-semibold">Register</div>
        <div className="mt-1 text-sm text-black/60">Your account needs admin approval unless you are the admin.</div>

        {done ? (
          <div className="mt-5 space-y-2">
            <div className="rounded-md border border-black/10 bg-black/5 p-3 text-sm">
              Status: <span className="font-medium">{done.status}</span>
            </div>
            <a className="block text-center text-sm text-black/70 underline" href="/trainer/login">
              Go to login
            </a>
          </div>
        ) : (
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
              <label className="text-xs text-black/60">Username</label>
              <input
                className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                type="text"
                autoComplete="username"
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
                autoComplete="new-password"
                required
              />
            </div>

            {error ? <div className="text-sm text-red-700">{error}</div> : null}

            <button
              className="w-full rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/90 disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? 'Creating...' : 'Create account'}
            </button>

            <a className="block text-center text-sm text-black/70 underline" href="/trainer/login">
              Back to login
            </a>
          </form>
        )}
      </div>
    </main>
  );
}
