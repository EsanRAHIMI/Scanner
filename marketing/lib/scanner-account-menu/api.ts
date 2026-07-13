import type { AuthMe } from './types';

function joinPath(prefix: string, path: string): string {
  const base = prefix.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export function createAuthApi(authApiPrefix: string) {
  const base = authApiPrefix.replace(/\/+$/, '');

  async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    const url = joinPath(base, path);
    return fetch(url, {
      cache: 'no-store',
      credentials: 'include',
      ...init,
    });
  }

  async function loadMe(): Promise<AuthMe | null> {
    const res = await apiFetch('/auth/me');
    if (res.status === 401) return null;
    const text = await res.text();
    if (!res.ok) throw new Error(text || `Failed to load user (${res.status})`);
    const data = JSON.parse(text) as {
      email?: string;
      username?: string;
      is_admin?: boolean;
      permissions?: unknown;
    };
    const perms = Array.isArray(data.permissions)
      ? data.permissions.filter((p): p is string => typeof p === 'string')
      : [];
    if (!data.email || !data.username) throw new Error('Invalid /auth/me response');
    return {
      email: data.email,
      username: data.username,
      is_admin: Boolean(data.is_admin),
      permissions: perms,
    };
  }

  async function login(email: string, password: string): Promise<void> {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || `Login failed (${res.status})`);
  }

  async function register(
    email: string,
    username: string,
    password: string,
  ): Promise<{ status: string; user_id: string }> {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || `Register failed (${res.status})`);
    return JSON.parse(text) as { status: string; user_id: string };
  }

  async function logout(): Promise<void> {
    const res = await apiFetch('/auth/logout', { method: 'POST' });
    const text = await res.text();
    if (!res.ok) throw new Error(text || `Logout failed (${res.status})`);
  }

  return { loadMe, login, register, logout };
}
