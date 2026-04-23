import { getTrainerApiBase } from '@/lib/env';

export async function apiFetch(path: string, init?: RequestInit) {
  const base = getTrainerApiBase();
  let baseResolved = base;
  let cookieHeader: string | null = null;
  if (base.startsWith('/') && typeof window === 'undefined') {
    const { headers } = await import('next/headers');
    const h = await headers();
    const host = h.get('host');
    cookieHeader = h.get('cookie');
    const proto =
      h.get('x-forwarded-proto') ??
      (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const origin = host ? `${proto}://${host}` : 'http://localhost:3010';
    baseResolved = `${origin}${base}`;
  }

  const url = `${baseResolved}${path}`;

  const headers = new Headers(init?.headers);
  if (cookieHeader && !headers.has('Cookie')) {
    headers.set('Cookie', cookieHeader);
  }

  const res = await fetch(url, {
    cache: 'no-store',
    credentials: 'include',
    ...init,
    headers,
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
