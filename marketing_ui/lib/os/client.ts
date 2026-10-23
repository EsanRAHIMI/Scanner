'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const MESSAGES: Record<string, string> = {
  ADMIN_REQUIRED: 'Only an admin can do this.',
  NOT_AUTHENTICATED: 'Your session ended. Sign in again.',
  TOKEN_EXPIRED: 'Your session ended. Sign in again.',
  TITLE_REQUIRED: 'Add a title.',
  NAME_REQUIRED: 'Add a name.',
  START_DATE_REQUIRED: 'Add a start date.',
  END_DATE_BEFORE_START: 'The end date is before the start date.',
  CAMPAIGN_NOT_FOUND: 'That campaign no longer exists.',
  LINK_NOT_FOUND: 'The linked item no longer exists.',
  NOT_FOUND: 'That record is gone.',
  CONFLICT: 'Someone else just updated this. Refresh and try again.',
  LANE_LOCKED: 'That lane cannot be changed.',
  LANE_IN_USE: 'Move or remove activities before deleting this lane.',
  LINKED_ACTIVITY: 'This activity is a live record. Edit it, do not delete it here.',
  PERSON_REQUIRED: 'Choose a person.',
  TIMER_NOT_FOUND: 'No timer is running.',
  TIMER_RUNNING: 'Stop the timer before editing this log.',
  WORK_NOT_FOUND: 'That task is gone.',
  MONGODB_NOT_CONFIGURED: 'The marketing database is not reachable.',
  STARTING: 'The marketing service is still getting ready.',
  START_FAILED: 'The marketing service could not start.',
};

function messageFor(status: number, detail: unknown): string {
  if (typeof detail === 'string') return MESSAGES[detail] ?? detail.replace(/_/g, ' ').toLowerCase();
  if (Array.isArray(detail)) return 'Some fields are not valid.';
  if (status >= 500) return 'The marketing service did not respond. Try again.';
  return 'Request failed.';
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`/api/os/${path.replace(/^\//, '')}`, {
    cache: 'no-store',
    ...rest,
    headers: json !== undefined ? { 'content-type': 'application/json', ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    throw new ApiError(res.status, messageFor(res.status, (body as { detail?: unknown } | null)?.detail));
  }
  return body as T;
}

/** Start a source refresh and wait until it finishes. The POST itself returns immediately. */
export async function syncSources(onProgress?: (elapsedSeconds: number) => void): Promise<void> {
  const started = Date.now();
  await api('sync', { method: 'POST' });
  const deadline = started + 10 * 60_000;
  for (;;) {
    await wait(1000);
    onProgress?.(Math.max(1, Math.round((Date.now() - started) / 1000)));
    const status = await api<{ state?: string; ok?: boolean; detail?: string | null }>('sync');
    if (status.state === 'running') {
      if (Date.now() > deadline) throw new ApiError(504, 'Sync is still running. The cards will update when it finishes.');
      continue;
    }
    if (status.ok === false) throw new ApiError(502, status.detail || 'Sync did not finish.');
    return;
  }
}

type Entry = { data?: unknown; at: number; promise?: Promise<unknown>; listeners: Set<() => void> };
const cache = new Map<string, Entry>();

function entry(key: string): Entry {
  let found = cache.get(key);
  if (!found) {
    found = { at: 0, listeners: new Set() };
    cache.set(key, found);
  }
  return found;
}

function retryable(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true;
  return err.status === 503 || err.status === 0;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function load(key: string): Promise<unknown> {
  const slot = entry(key);
  if (slot.promise) return slot.promise;
  slot.promise = (async () => {
    const deadline = Date.now() + 25_000;
    let pause = 250;
    for (;;) {
      try {
        const data = await api<unknown>(key);
        slot.data = data;
        slot.at = Date.now();
        slot.listeners.forEach((listener) => listener());
        return data;
      } catch (err) {
        if (!retryable(err) || Date.now() + pause > deadline) throw err;
        await wait(pause);
        pause = Math.min(pause + 200, 1000);
      }
    }
  })().finally(() => {
    slot.promise = undefined;
  });
  return slot.promise;
}

/** Revalidate every cached response whose path starts with one of the prefixes. */
export function invalidate(...prefixes: string[]) {
  for (const key of cache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      void load(key).catch(() => undefined);
    }
  }
}

/**
 * Cached GET. A revisit shows the last response at once and refreshes it in the background.
 * Pass null to skip.
 */
function asApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError(0, 'Network error. Check the connection.');
}

export function useApi<T>(path: string | null) {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!path) return () => undefined;
      const slot = entry(path);
      slot.listeners.add(notify);
      return () => {
        slot.listeners.delete(notify);
      };
    },
    [path],
  );
  const data = useSyncExternalStore(
    subscribe,
    () => (path ? (cache.get(path)?.data as T | undefined) : undefined),
    () => undefined,
  );
  const [failure, setFailure] = useState<{ path: string; error: ApiError } | null>(null);

  useEffect(() => {
    if (!path) return;
    const slot = entry(path);
    if (slot.data && Date.now() - slot.at <= 15_000) return;
    let live = true;
    load(path)
      .then(() => live && setFailure(null))
      .catch((err: unknown) => live && setFailure({ path, error: asApiError(err) }));
    return () => {
      live = false;
    };
  }, [path]);

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      await load(path);
      setFailure(null);
    } catch (err) {
      setFailure({ path, error: asApiError(err) });
    }
  }, [path]);

  const error = failure && failure.path === path ? failure.error : null;

  const mutate = useCallback(
    (next: T | ((current: T | undefined) => T)) => {
      if (!path) return;
      const slot = entry(path);
      slot.data = typeof next === 'function' ? (next as (current: T | undefined) => T)(slot.data as T | undefined) : next;
      slot.at = Date.now();
      slot.listeners.forEach((listener) => listener());
    },
    [path],
  );

  return { data, error, loading: !data && !error, reload, mutate };
}

const memory = new Map<string, string>();
const storageListeners = new Set<() => void>();

function subscribeStorage(notify: () => void) {
  storageListeners.add(notify);
  window.addEventListener('storage', notify);
  return () => {
    storageListeners.delete(notify);
    window.removeEventListener('storage', notify);
  };
}

function readStored(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** State that survives reloads, for filters and view choices. */
export function usePersisted<T>(key: string, initial: T): [T, (value: T | ((current: T) => T)) => void] {
  const name = `mos:${key}`;
  const raw = useSyncExternalStore(subscribeStorage, () => readStored(name), () => null);
  const value = useMemo(() => {
    if (raw == null) return initial;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  }, [raw, initial]);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const update = useCallback(
    (next: T | ((current: T) => T)) => {
      const resolved = typeof next === 'function' ? (next as (current: T) => T)(latest.current) : next;
      const text = JSON.stringify(resolved);
      latest.current = resolved;
      memory.set(name, text);
      try {
        window.localStorage.setItem(name, text);
      } catch {
        /* storage full or blocked; the choice still applies for this visit */
      }
      storageListeners.forEach((notify) => notify());
    },
    [name],
  );

  return [value, update];
}
