'use client';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  if (init?.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, {
    cache: 'no-store',
    credentials: 'include',
    ...init,
    headers,
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      detail = JSON.parse(text)?.detail ?? text;
    } catch {
      /* keep raw */
    }
    const err = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** Trainer auth via the Next proxy — sets the cookie on this origin (required in local dev). */
export async function trainerApi<T>(path: string, init?: RequestInit): Promise<T> {
  return fetchJson<T>(`/api/trainer${path}`, init);
}

/** Client-side fetch helper — always same-origin through the Next proxy. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  if (init?.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetchJson<T>(`/api/proposals${path}`, { ...init, headers });
}

export function fmtMoney(value: number | null | undefined, currency = 'AED'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return `— ${currency}`;
  return `${Math.round(value).toLocaleString('en-US')} ${currency}`;
}

export function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-300',
  sent: 'bg-sky-50 text-sky-700 border-sky-300',
  approved: 'bg-green-50 text-green-700 border-green-300',
  rejected: 'bg-red-50 text-red-700 border-red-300',
  archived: 'bg-amber-50 text-amber-700 border-amber-300',
};
