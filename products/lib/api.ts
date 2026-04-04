import { getTrainerApiBase } from '@/lib/env';

export async function apiFetch(path: string, init?: RequestInit) {
  const isBrowser = typeof window !== 'undefined';
  const base = isBrowser ? '/api/trainer' : getTrainerApiBase();
  let baseResolved = base;
  let cookieHeader: string | null = null;
  if (base.startsWith('/') && !isBrowser) {
    const { headers } = await import('next/headers');
    const h = await headers();
    const host = h.get('host');
    cookieHeader = h.get('cookie');
    const proto = h.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const origin = host ? `${proto}://${host}` : 'http://localhost:3004';
    baseResolved = `${origin}${base}`;
  }

  const url = `${baseResolved}${path}`;

  const res = await fetch(url, {
    cache: 'no-store',
    credentials: 'include',
    ...init,
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(init?.headers ?? {}),
    },
  });

  return res;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `Request failed (${res.status})`);
  }
  return JSON.parse(text) as T;
}
