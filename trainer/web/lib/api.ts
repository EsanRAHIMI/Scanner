import { getTrainerApiBase } from '@/lib/env';

export async function apiFetch(path: string, init?: RequestInit) {
  const base = getTrainerApiBase();
  const url = `${base}${path}`;

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
