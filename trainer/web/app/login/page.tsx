'use client';

import * as React from 'react';

import { apiFetch } from '@/lib/api';
import { BrandHeaderAuth } from '@/lib/brand-header';
import { ErrorBanner } from '@/lib/trainer-ui';

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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center animate-fade-in">
      <div className="dash-card p-8 pt-9">
        <BrandHeaderAuth title="Login" description="Use your approved account." />

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label className="field-label">Email</label>
            <input
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="field-label">Password</label>
            <input
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? <ErrorBanner>{error}</ErrorBanner> : null}

          <button className="btn-primary w-full" disabled={loading} type="submit">
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <a className="block text-center text-sm font-medium text-brand-burgundy hover:text-brand-black" href="/register">
            Create an account
          </a>
        </form>
      </div>
    </main>
  );
}
