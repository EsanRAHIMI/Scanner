'use client';

import * as React from 'react';

import { apiFetch } from '@/lib/api';
import { BrandHeaderAuth } from '@/lib/brand-header';
import { ErrorBanner } from '@/lib/trainer-ui';

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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center animate-fade-in">
      <div className="dash-card p-8 pt-9">
        <BrandHeaderAuth
          title="Register"
          description="Your account needs admin approval unless you are the admin."
        />

        {done ? (
          <div className="mt-6 space-y-3">
            <div className="rounded-xl border border-brand-medium-gray/30 bg-brand-light-gray/50 p-4 text-sm text-brand-black">
              Status: <span className="font-semibold">{done.status}</span>
            </div>
            <a className="block text-center text-sm font-medium text-brand-burgundy hover:text-brand-black" href="/login">
              Go to login
            </a>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <label className="field-label">Email</label>
              <input className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required />
            </div>

            <div className="space-y-1.5">
              <label className="field-label">Username</label>
              <input className="field-input" value={username} onChange={(e) => setUsername(e.target.value)} type="text" autoComplete="username" required />
            </div>

            <div className="space-y-1.5">
              <label className="field-label">Password</label>
              <input className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" required />
            </div>

            {error ? <ErrorBanner>{error}</ErrorBanner> : null}

            <button className="btn-primary w-full" disabled={loading} type="submit">
              {loading ? 'Creating...' : 'Create account'}
            </button>

            <a className="block text-center text-sm font-medium text-brand-burgundy hover:text-brand-black" href="/login">
              Back to login
            </a>
          </form>
        )}
      </div>
    </main>
  );
}
