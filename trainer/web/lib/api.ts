import { getTrainerApiBase } from '@/lib/env';

export async function apiFetch(path: string, init?: RequestInit) {
  const base = getTrainerApiBase();

  let baseResolved = base;
  if (base.startsWith('/')) {
    if (typeof window === 'undefined') {
      const { headers } = await import('next/headers');
      const h = await headers();
      const host = h.get('host');
      const proto =
        h.get('x-forwarded-proto') ??
        (process.env.NODE_ENV === 'production' ? 'https' : 'http');
      const origin = host ? `${proto}://${host}` : 'http://localhost:3010';
      baseResolved = `${origin}${base}`;
    } else {
      baseResolved = base;
    }
  }

  const url = `${baseResolved}${path}`;

  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
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
