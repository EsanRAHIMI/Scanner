'use client';

import * as React from 'react';

import { apiFetch } from '@/lib/api';
import { useProductsCache } from '../products-cache-provider';
import type { ProductsRecord } from '@/types/trainer';

type AuthMe = {
  email: string;
  username: string;
  is_admin: boolean;
  permissions: string[];
};

function AccountMenu() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [me, setMe] = React.useState<AuthMe | null>(null);
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [email, setEmail] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [registerDone, setRegisterDone] = React.useState<{ status: string; user_id: string } | null>(null);

  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onMouseDown(e: MouseEvent) {
      const el = menuRef.current;
      if (!el) return;
      if (open && e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [open]);

  async function loadMe() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/auth/me');
      if (res.status === 401) {
        setMe(null);
        return;
      }
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Failed to load user (${res.status})`);
      const data = JSON.parse(text) as { email?: string; username?: string; is_admin?: boolean; permissions?: unknown };
      const perms = Array.isArray(data.permissions) ? data.permissions.filter((p): p is string => typeof p === 'string') : [];
      if (!data.email || !data.username) throw new Error('Invalid /auth/me response');
      setMe({ email: data.email, username: data.username, is_admin: Boolean(data.is_admin), permissions: perms });
    } catch (e) {
      setMe(null);
      setError(e instanceof Error ? e.message : 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }

  async function onToggle() {
    const next = !open;
    setOpen(next);
    setError(null);
    if (next) {
      setRegisterDone(null);
      await loadMe();
    }
  }

  async function onLogout() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/auth/logout', { method: 'POST' });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Logout failed (${res.status})`);
      setMe(null);
      setMode('login');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Logout failed');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await apiFetch('/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(text || `Login failed (${res.status})`);
        await loadMe();
        setOpen(false);
        return;
      }

      const res = await apiFetch('/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Register failed (${res.status})`);
      const data = JSON.parse(text) as { status: string; user_id: string };
      setRegisterDone({ status: data.status, user_id: data.user_id });
    } catch (e) {
      setError(e instanceof Error ? e.message : mode === 'login' ? 'Login failed' : 'Register failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/50 text-black/60 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 hover:text-black hover:shadow-md active:scale-95 dark:border-white/10 dark:bg-black/40 dark:text-white/60 dark:hover:bg-black/60 dark:hover:text-white"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Account"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/70"
          role="menu"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {loading ? <div className="text-sm text-black/60 dark:text-white/60">Loading...</div> : null}

          {!loading && me ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-black/10 bg-black/5 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="text-xs text-black/60 dark:text-white/60">Signed in as</div>
                <div className="mt-1 text-sm font-medium text-black dark:text-white">{me.username}</div>
                <div className="text-xs text-black/70 dark:text-white/70">{me.email}</div>
              </div>

              {error ? <div className="text-sm text-red-700 dark:text-red-200">{error}</div> : null}

              <button
                type="button"
                onClick={onLogout}
                disabled={loading}
                className="w-full rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/90 disabled:opacity-60"
                role="menuitem"
              >
                Logout
              </button>
            </div>
          ) : null}

          {!loading && !me ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setRegisterDone(null);
                    setError(null);
                  }}
                  className={
                    'flex-1 rounded-md px-3 py-2 text-sm font-medium border ' +
                    (mode === 'login'
                      ? 'border-black/20 bg-black text-white dark:border-white/15'
                      : 'border-black/15 bg-transparent text-black/70 hover:bg-black/5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/5')
                  }
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setRegisterDone(null);
                    setError(null);
                  }}
                  className={
                    'flex-1 rounded-md px-3 py-2 text-sm font-medium border ' +
                    (mode === 'register'
                      ? 'border-black/20 bg-black text-white dark:border-white/15'
                      : 'border-black/15 bg-transparent text-black/70 hover:bg-black/5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/5')
                  }
                >
                  Register
                </button>
              </div>

              {registerDone ? (
                <div className="rounded-lg border border-black/10 bg-black/5 p-3 text-sm text-black/80 dark:border-white/10 dark:bg-white/5 dark:text-white/75">
                  Status: <span className="font-medium">{registerDone.status}</span>
                </div>
              ) : (
                <form className="space-y-2" onSubmit={onSubmit}>
                  <div className="space-y-1">
                    <label className="text-xs text-black/60 dark:text-white/60">Email</label>
                    <input
                      className="h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm dark:border-white/15 dark:bg-black/25 dark:text-white"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      autoComplete="email"
                      required
                    />
                  </div>

                  {mode === 'register' ? (
                    <div className="space-y-1">
                      <label className="text-xs text-black/60 dark:text-white/60">Username</label>
                      <input
                        className="h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm dark:border-white/15 dark:bg-black/25 dark:text-white"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        type="text"
                        autoComplete="username"
                        required
                      />
                    </div>
                  ) : null}

                  <div className="space-y-1">
                    <label className="text-xs text-black/60 dark:text-white/60">Password</label>
                    <input
                      className="h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm dark:border-white/15 dark:bg-black/25 dark:text-white"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      required
                    />
                  </div>

                  {error ? <div className="text-sm text-red-700 dark:text-red-200">{error}</div> : null}

                  <button
                    className="w-full rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/90 disabled:opacity-60"
                    disabled={loading}
                    type="submit"
                  >
                    {mode === 'login' ? (loading ? 'Logging in...' : 'Login') : loading ? 'Creating...' : 'Create account'}
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return '';
}

function extractUrls(v: unknown): string[] {
  if (typeof v === 'string') {
    const parts = v.split(/[\s,\n]+/).map((s) => s.trim()).filter(Boolean);
    return parts.filter((s) => /^https?:\/\//i.test(s));
  }
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      if (typeof item === 'string') {
        const s = item.trim();
        if (/^https?:\/\//i.test(s)) out.push(s);
      } else if (item && typeof item === 'object') {
        const maybe = (item as Record<string, unknown>).url;
        if (typeof maybe === 'string') {
          const s = maybe.trim();
          if (/^https?:\/\//i.test(s)) out.push(s);
        }
      }
    }
    return out;
  }
  if (v && typeof v === 'object') {
    const maybe = (v as Record<string, unknown>).url;
    if (typeof maybe === 'string') {
      const s = maybe.trim();
      return /^https?:\/\//i.test(s) ? [s] : [];
    }
  }
  return [];
}

function getDriveDirectLink(url: string): string {
  if (!url.includes('drive.google.com') && !url.includes('google.com/file/d/')) return url;

  // Extract ID from various formats
  // Format 1: /file/d/[ID]/view
  // Format 2: ?id=[ID]
  // Format 3: /open?id=[ID]

  let id = '';
  // Try to find the /file/d/ pattern
  const matchD = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD && matchD[1]) {
    id = matchD[1];
  } else {
    // Try query parameters
    try {
      const u = new URL(url);
      id = u.searchParams.get('id') || u.searchParams.get('fileId') || '';
    } catch {
      // Fallback: search for id= pattern manually if URL parsing fails
      const manualMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (manualMatch) id = manualMatch[1];
    }
  }

  if (id) {
    // High-performance direct link format requested by user
    return `https://lh3.googleusercontent.com/d/${id}=w1000`;
  }
  return url;
}

function formatPrice(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('en-US').format(value);
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;

    const cleaned = raw.replace(/,/g, '');
    const n = Number(cleaned);
    if (Number.isFinite(n)) return new Intl.NumberFormat('en-US').format(n);
  }
  return null;
}


export function ProductsView({
  title = 'Products',
  titleNode,
  mobileTitleNode,
}: {
  title?: string;
  titleNode?: React.ReactNode;
  mobileTitleNode?: React.ReactNode;
}) {
  const { data, loading, error, setData } = useProductsCache();
  const [search, setSearch] = React.useState<string>('');
  const [showSelectedOnly, setShowSelectedOnly] = React.useState<boolean>(false);
  const [familyMode, setFamilyMode] = React.useState<'collection' | 'main'>('main');
  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');
  const [sortKey, setSortKey] = React.useState<string>('Num');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = React.useState<'list' | 'gallery'>('gallery');
  const [previewIndex, setPreviewIndex] = React.useState<number | null>(null);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [familyCollectionName, setFamilyCollectionName] = React.useState<string | null>(null);
  const [lightboxDetailsCollapsed, setLightboxDetailsCollapsed] = React.useState<boolean>(true);
  const [tableSwipeStart, setTableSwipeStart] = React.useState<{ x: number; y: number } | null>(null);
  const [imageLongPressTimer, setImageLongPressTimer] = React.useState<NodeJS.Timeout | null>(null);
  const [user, setUser] = React.useState<{ role: string; is_admin: boolean } | null>(null);
  const [editingUrl, setEditingUrl] = React.useState<{ id: string; value: string; column?: string; index?: number | null; mode?: 'replace' | 'append' | 'prepend' }| null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/trainer/auth/me');
        if (res.ok) {
          const json = await res.json();
          setUser({
            role: json.role || 'user',
            is_admin: Boolean(json.is_admin || json.role === 'admin')
          });
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const canEdit = user?.is_admin || user?.role === 'admin' || user?.role === 'sales';

  const handleSaveUrl = async () => {
    if (!editingUrl || isSaving) return;
    setIsSaving(true);
    try {
      // Find the actual field name for URL
      const urlFieldName = columns.find(c => c.trim().toLowerCase() === 'url') || 'URL';

      let finalValueToSave = editingUrl.value;
      if (typeof editingUrl.index === 'number' && data?.records) {
        const record = data.records.find(r => r.id === editingUrl.id);
        if (record) {
          const currentFieldValue = String(record.fields[urlFieldName] || '');
          const urls = extractUrls(currentFieldValue);
          if (editingUrl.index >= 0 && editingUrl.index < urls.length) {
            urls[editingUrl.index] = editingUrl.value;
            finalValueToSave = urls.join('\n');
          }
        }
      } else if (editingUrl.mode === 'prepend' && data?.records) {
        const record = data.records.find(r => r.id === editingUrl.id);
        const currentFieldValue = String(record?.fields[urlFieldName] || '').trim();
        finalValueToSave = currentFieldValue ? (editingUrl.value + '\n' + currentFieldValue) : editingUrl.value;
      }

      const res = await fetch(`/api/products/${editingUrl.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            [urlFieldName]: finalValueToSave
          }
        })
      });
      if (!res.ok) throw new Error('Failed to save');

      // Update local state without reload
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          records: prev.records.map(r => r.id === (editingUrl?.id) ? {
            ...r,
            fields: {
              ...r.fields,
              [urlFieldName]: finalValueToSave
            }
          } : r) as any
        };
      });
      setEditingUrl(null);
    } catch (err) {
      alert('Error saving URL: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };


  const columns: string[] = data?.columns ?? [];
  const records: ProductsRecord[] = data?.records ?? [];

  const displayedColumns = React.useMemo(() => {
    const ordered = [
      'Image',
      'DAM',
      'Price',
      'URL',
      'Colecction Name',
      'Colecction Code',
      'Variant Number',
      'Category',
      'Content Calendar',
      'DIMENSION (mm)',
      'Note',
      'CODE NUMBER',
      'L000',
      'Num'
    ] as const;
    const orderedSet = new Set<string>(ordered as readonly string[]);

    const out: string[] = [];

    // Push ordered headers that exist in API columns (or ones we want always like DAM)
    for (const key of ordered) {
      if (columns.includes(key) || key === 'DAM') {
        out.push(key);
      }
    }

    // Add any unknown columns coming from API as extras
    const extras = columns
      .filter((c) => !orderedSet.has(c))
      .sort((a, b) => a.localeCompare(b));
    out.push(...extras);

    return out;
  }, [columns]);

  const getSearchText = React.useCallback((r: ProductsRecord, usedColumns: string[]) => {
    const parts: string[] = [];
    for (const c of usedColumns) {
      const v = r.fields?.[c];
      if (v === null || v === undefined) continue;

      const colLower = c.trim().toLowerCase();
      if (colLower === 'image' || colLower === 'dam') {
        const urls = extractUrls(v);
        if (urls.length > 0) parts.push(urls.join(' | '));
        continue;
      }

      if (Array.isArray(v)) {
        const arr = v as unknown[];
        const allStrings = arr.every((x) => typeof x === 'string');
        if (allStrings) parts.push((arr as string[]).join(' | '));
        else parts.push(String(arr.length));
        continue;
      }

      const s = formatScalar(v);
      if (s) {
        parts.push(s);
        continue;
      }

      if (typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        if (typeof obj.name === 'string') parts.push(obj.name);
        else if (typeof obj.url === 'string') parts.push(obj.url);
      }
    }
    return parts.join(' \n ').toLowerCase();
  }, []);

  const filteredRecords = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = !q ? records : records.filter((r) => getSearchText(r, displayedColumns).includes(q));
    if (!showSelectedOnly) return base;
    return base.filter((r) => selectedIds.has(r.id));
  }, [displayedColumns, getSearchText, records, search, selectedIds, showSelectedOnly]);

  const getSortValue = React.useCallback((r: ProductsRecord, key: string) => {
    const k = key.trim().toLowerCase();

    if (k === 'image') {
      const urls = extractUrls(r.fields?.[key]);
      return urls[0] ?? '';
    }

    const v = r.fields?.[key];
    if (v === null || v === undefined) return '';

    if (k === 'price') {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const cleaned = v.trim().replace(/,/g, '');
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : '';
      }
      return '';
    }

    if (k === 'num' || k === 'variant number') {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = Number(v.trim());
        return Number.isFinite(n) ? n : '';
      }
      return '';
    }

    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string') return v.toLowerCase();
    if (Array.isArray(v)) {
      const arr = v as unknown[];
      const allStrings = arr.every((x) => typeof x === 'string');
      if (allStrings) return (arr as string[]).join(' | ').toLowerCase();
      return arr.length;
    }
    if (typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      if (typeof obj.name === 'string') return obj.name.toLowerCase();
      if (typeof obj.url === 'string') return obj.url.toLowerCase();
    }
    return '';
  }, []);

  const sortedRecords = React.useMemo(() => {
    const base = [...filteredRecords];

    base.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);

      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return base;
  }, [filteredRecords, getSortValue, sortDir, sortKey]);

  const visibleRecords = React.useMemo(() => {
    if (familyMode !== 'main') return sortedRecords;

    const seen = new Set<string>();
    const out: ProductsRecord[] = [];

    for (const r of sortedRecords) {
      const raw =
        formatScalar(r.fields?.['Colecction Name']) ||
        formatScalar(r.fields?.Name) ||
        formatScalar(r.fields?.['Collection Name']) ||
        '';
      const key = raw.trim();

      if (!key) {
        out.push(r);
        continue;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }

    return out;
  }, [familyMode, sortedRecords]);

  const baseGalleryItems = React.useMemo(() => {
    return visibleRecords
      .map((r) => {
        const fields = r.fields ?? {};
        const urlEntry = Object.entries(fields).find(([k]) => {
          const kl = k.trim().toLowerCase();
          return kl === 'url' || kl.endsWith(' url') || kl.endsWith('_url') || kl.endsWith('-url');
        });
        const damUrls = extractUrls(urlEntry?.[1]);
        const imageUrls = extractUrls(fields.Image);
        const url = damUrls[0] || imageUrls[0] || '';
        const collectionName =
          formatScalar(r.fields?.['Colecction Name']) || formatScalar(r.fields?.Name) || '';
        const collectionNameNormalized = collectionName.trim();
        const title = collectionName || 'Product';
        const code = formatScalar(r.fields?.['Colecction Code']) || formatScalar(r.fields?.Code);
        const variant = formatScalar(r.fields?.['Variant Number']) || formatScalar(r.fields?.Num);
        const price = formatPrice(r.fields?.Price) ?? null;

        const dimensionKey = (() => {
          const keys = Object.keys(fields);
          const normalized = keys.map((k) => ({ k, n: k.trim().toLowerCase() }));
          const mm = normalized.find((x) => x.n.includes('dimension') && x.n.includes('mm'))?.k;
          if (mm) return mm;
          const dim = normalized.find((x) => x.n.startsWith('dimension'))?.k;
          if (dim) return dim;
          return null;
        })();

        const dimension =
          formatScalar(fields['DIMENSION (mm)']) ||
          formatScalar(fields['Dimension (mm)']) ||
          (dimensionKey ? formatScalar(fields[dimensionKey]) : '') ||
          formatScalar(fields['DIMENSION']) ||
          formatScalar(fields['DIMENSIONS']) ||
          formatScalar(fields['Dimension']) ||
          formatScalar(fields['Dimensions']);

        const noteKey = (() => {
          const keys = Object.keys(fields);
          const normalized = keys.map((k) => ({ k, n: k.trim().toLowerCase() }));
          return normalized.find((x) => x.n === 'note' || x.n.startsWith('note ') || x.n.includes('note'))?.k ?? null;
        })();

        const note =
          formatScalar(fields['Note']) ||
          formatScalar(fields['NOTE']) ||
          (noteKey ? formatScalar(fields[noteKey]) : '');

        return {
          id: r.id,
          url,
          title,
          collectionName,
          collectionNameNormalized,
          code,
          variant,
          dimension,
          note,
          price,
        };
      })
      .filter((x) => Boolean(x.url));
  }, [visibleRecords]);

  const allGalleryItems = React.useMemo(() => {
    return sortedRecords
      .map((r) => {
        const fields = r.fields ?? {};
        const urlEntry = Object.entries(fields).find(([k]) => {
          const kl = k.trim().toLowerCase();
          return kl === 'url' || kl.endsWith(' url') || kl.endsWith('_url') || kl.endsWith('-url');
        });
        const damUrls = extractUrls(urlEntry?.[1]);
        const imageUrls = extractUrls(fields.Image);
        const url = damUrls[0] || imageUrls[0] || '';
        const collectionName =
          formatScalar(r.fields?.['Colecction Name']) || formatScalar(r.fields?.Name) || '';
        const collectionNameNormalized = collectionName.trim();

        const title = collectionName;
        const code = formatScalar(fields['Colecction Code']) || formatScalar(fields['Code']);
        const variant = formatScalar(fields['Variant Number']) || formatScalar(fields['Num']);
        const dimension =
          formatScalar(fields['DIMENSION (mm)']) || formatScalar(fields['Dimension (mm)']) || formatScalar(fields['Dimensions']);

        const noteKey = (() => {
          const keys = Object.keys(fields);
          const normalized = keys.map((k) => ({ k, n: k.trim().toLowerCase() }));
          return normalized.find((x) => x.n === 'note' || x.n.startsWith('note ') || x.n.includes('note'))?.k ?? null;
        })();

        const note =
          formatScalar(fields['Note']) ||
          formatScalar(fields['NOTE']) ||
          (noteKey ? formatScalar(fields[noteKey]) : '');

        const price = formatPrice(fields['Price']);

        return {
          id: r.id,
          url,
          title,
          collectionName,
          collectionNameNormalized,
          code,
          variant,
          dimension,
          note,
          price,
        };
      })
      .filter((x) => Boolean(x.url));
  }, [sortedRecords]);

  const galleryItems = React.useMemo(() => {
    if (!familyCollectionName) return baseGalleryItems;
    const key = familyCollectionName.trim();
    return allGalleryItems.filter((x) => x.collectionNameNormalized === key);
  }, [allGalleryItems, baseGalleryItems, familyCollectionName]);

  const openPreviewByUrl = React.useCallback(
    (url: string) => {
      if (!url) return;
      const idx = galleryItems.findIndex((x) => x.url === url);
      const resolvedIndex = idx >= 0 ? idx : 0;
      const resolved = galleryItems[resolvedIndex];
      setPreviewIndex(resolvedIndex);
      setPreviewId(resolved?.id ?? null);
    },
    [galleryItems]
  );

  const closePreview = React.useCallback(() => {
    setPreviewIndex(null);
    setPreviewId(null);
    setLightboxDetailsCollapsed(true);
    setFamilyCollectionName(null);
  }, []);

  const goPrev = React.useCallback(() => {
    setPreviewIndex((i) => {
      if (i === null) return i;
      const n = galleryItems.length;
      if (n <= 1) return i;
      const nextIndex = (i - 1 + n) % n;
      const next = galleryItems[nextIndex];
      setPreviewId(next?.id ?? null);
      // Auto-collapse table when navigating
      setLightboxDetailsCollapsed(true);
      return nextIndex;
    });
  }, [galleryItems]);

  React.useEffect(() => {
    if (previewIndex === null) return;
    if (!previewId) return;

    const idx = galleryItems.findIndex((x) => x.id === previewId);
    if (idx >= 0) {
      if (idx !== previewIndex) setPreviewIndex(idx);
      return;
    }

    const prev = allGalleryItems.find((x) => x.id === previewId) ?? null;
    const familyKey = (prev?.collectionNameNormalized || '').trim();
    if (familyKey) {
      const mappedIdx = galleryItems.findIndex((x) => x.collectionNameNormalized === familyKey);
      if (mappedIdx >= 0) {
        setPreviewIndex(mappedIdx);
        setPreviewId(galleryItems[mappedIdx].id);
        return;
      }
    }

    if (galleryItems.length > 0) {
      setPreviewIndex(0);
      setPreviewId(galleryItems[0].id);
    }
  }, [previewId, previewIndex, allGalleryItems.map((x) => x.id).join('|'), galleryItems.map((x) => x.id).join('|')]);

  const toggleSelected = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const getSelectedItems = React.useCallback(
    (fallbackIndex: number | null) => {
      const byId = new Map(baseGalleryItems.map((x) => [x.id, x] as const));
      const picked = [...selectedIds].map((id) => byId.get(id)).filter((x): x is (typeof galleryItems)[number] => !!x);
      if (picked.length > 0) return picked;
      if (fallbackIndex === null) return [];
      const current = galleryItems[fallbackIndex];
      return current ? [current] : [];
    },
    [baseGalleryItems, galleryItems, selectedIds]
  );

  const downloadSelected = React.useCallback(async () => {
    const items = getSelectedItems(previewIndex);
    if (items.length === 0) return;

    for (const item of items) {
      try {
        const res = await fetch(item.url, { cache: 'no-store' });
        if (!res.ok) continue;
        const blob = await res.blob();
        const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
        const filenameBase = (item.code || item.title || 'image').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 64);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${filenameBase}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      } catch {
        // ignore
      }
    }
  }, [getSelectedItems, previewIndex]);

  const selectedCount = selectedIds.size;
  React.useEffect(() => {
    if (selectedIds.size === 0 && showSelectedOnly) setShowSelectedOnly(false);
  }, [selectedIds, showSelectedOnly]);

  const currentIndex = React.useMemo(() => {
    if (previewId) {
      const idx = galleryItems.findIndex((x) => x.id === previewId);
      return idx >= 0 ? idx : null;
    }
    if (previewIndex === null) return null;
    return previewIndex;
  }, [galleryItems, previewId, previewIndex]);

  const currentItem = React.useMemo(() => {
    if (previewId) {
      const found = galleryItems.find((x) => x.id === previewId);
      if (found) return found;
    }
    if (previewIndex === null) return null;
    return galleryItems[previewIndex] ?? null;
  }, [galleryItems, previewId, previewIndex]);

  const currentCollectionVariants = React.useMemo(() => {
    const key = (currentItem?.collectionNameNormalized || '').trim();
    if (!key) return [] as (typeof allGalleryItems)[number][];

    const variants = allGalleryItems.filter((x) => x.collectionNameNormalized === key);

    const currentId = currentItem?.id ?? null;
    if (!currentId) return variants;

    const current = variants.find((x) => x.id === currentId) ?? null;
    const rest = variants.filter((x) => x.id !== currentId);

    rest.sort((a, b) => {
      const av = (a.variant || '').toString();
      const bv = (b.variant || '').toString();
      const an = Number.parseFloat(av);
      const bn = Number.parseFloat(bv);
      if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
      const ac = (a.code || '').toString();
      const bc = (b.code || '').toString();
      return ac.localeCompare(bc);
    });

    return current ? [current, ...rest] : [...variants];
  }, [allGalleryItems, currentItem?.collectionNameNormalized, currentItem?.id]);

  const renderCell = React.useCallback(
    (column: string, value: unknown, recordId: string) => {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
      const col = column.trim().toLowerCase();

      const isUrl = col === 'url' || col.endsWith(' url') || col.endsWith('_url') || col.endsWith('-url');
      const isDAM = col === 'dam';

      if ((value === null || value === undefined) && !isUrl && !isDAM) return null;

      if (isUrl) {
        if (editingUrl?.id === recordId && (editingUrl.column === column || !editingUrl.column) && (editingUrl.index === undefined || editingUrl.index === null)) {
          return (
            <div
              className="absolute inset-0 z-40 bg-white dark:bg-black"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <textarea
                className="h-full w-full resize-none border-2 border-emerald-500 bg-transparent p-2 text-[11px] font-medium leading-relaxed outline-none dark:border-emerald-400"
                value={editingUrl.value}
                onChange={(e) => setEditingUrl({ ...editingUrl, value: e.target.value })}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveUrl();
                  } else if (e.key === 'Escape' || e.key === 'Esc') {
                    setEditingUrl(null);
                  }
                }}
              />
              {isSaving && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px] dark:bg-black/50">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                </div>
              )}
            </div>
          );
        }

        const urls = extractUrls(value);
        return (
          <>
            {canEdit && urls.length > 0 && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingUrl({ id: recordId, value: '', column, mode: 'prepend' });
                }}
                className="absolute left-0 top-0 z-[60] flex h-6 w-6 items-center justify-center rounded-br-lg bg-emerald-600 text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 pointer-events-auto cursor-pointer"
                title="Add URL to top"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <div className={`group flex min-h-[1.5rem] flex-col gap-1 ${urls.length === 0 ? 'items-center justify-center' : ''}`}>
              {urls.length === 0 ? (
                <div className="flex w-full items-center justify-center py-1">
                  {canEdit ? (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingUrl({ id: recordId, value: '', column });
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-600 transition-all hover:bg-red-500 hover:text-white dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500 dark:hover:text-white pointer-events-auto cursor-pointer"
                      title="Add URL"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : (
                    <span className="text-2xl font-light text-red-500/60 dark:text-red-400/60">+</span>
                  )}
                </div>
              ) : (
                <div className="scrollbar-minimal flex max-h-[120px] flex-col gap-1.5 overflow-y-auto py-0.5">

                {editingUrl?.id === recordId && (editingUrl.column === column || !editingUrl.column) && editingUrl.mode === 'prepend' && (
                  <div className="flex min-w-0 items-center gap-1 relative z-50 bg-white dark:bg-black pl-4 pr-1">
                    <input
                      className="flex-1 min-w-0 rounded border-2 border-emerald-500 bg-transparent px-2 py-1 text-[11px] font-medium leading-relaxed outline-none dark:border-emerald-400"
                      value={editingUrl.value}
                      onChange={(e) => setEditingUrl({ ...editingUrl, value: e.target.value })}
                      autoFocus
                      placeholder="New URL..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveUrl();
                        } else if (e.key === 'Escape' || e.key === 'Esc') {
                          setEditingUrl(null);
                        }
                      }}
                    />
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={(e) => { e.stopPropagation(); handleSaveUrl(); }}
                        className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditingUrl(null); }}
                        className="flex h-6 w-6 items-center justify-center rounded bg-black/10 text-black/60 hover:bg-black/20 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
                {urls.map((u, i) => {
                  const isBeingEdited = editingUrl?.id === recordId && (editingUrl.column === column || !editingUrl.column) && editingUrl.index === i;
                  if (isBeingEdited) {
                    return (
                      <div key={i} className="flex min-w-0 items-center gap-1 relative z-50 bg-white dark:bg-black pl-4 pr-1">
                        <input
                          className="flex-1 min-w-0 rounded border-2 border-emerald-500 bg-transparent px-2 py-1 text-[11px] font-medium leading-relaxed outline-none dark:border-emerald-400"
                          value={editingUrl.value}
                          onChange={(e) => setEditingUrl({ ...editingUrl, value: e.target.value })}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveUrl();
                            } else if (e.key === 'Escape' || e.key === 'Esc') {
                              setEditingUrl(null);
                            }
                          }}
                        />
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={(e) => { e.stopPropagation(); handleSaveUrl(); }}
                            className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditingUrl(null); }}
                            className="flex h-6 w-6 items-center justify-center rounded bg-black/10 text-black/60 hover:bg-black/20 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20"
                          >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={u + i} className="group/link flex min-w-0 items-center gap-1.5 pl-4 pr-1">
                      <a
                        href={u}
                        target="_blank"
                        rel="noreferrer"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-0 rounded border border-emerald-500/10 bg-emerald-500/[0.03] px-2 py-1 text-[11px] font-medium text-emerald-700 transition-all hover:bg-emerald-500/10 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                        title={u}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <svg viewBox="0 0 24 24" className="h-3 w-3 flex-none" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="truncate">{u}</span>
                        </div>
                      </a>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingUrl({ id: recordId, value: u, column, index: i });
                          }}
                          className="hidden h-7 w-7 items-center justify-center rounded-md bg-black/5 text-black/40 hover:bg-black/10 group-hover/link:flex dark:bg-white/5 dark:text-white/40 dark:hover:bg-white/10"
                          title="Edit this link"
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </>
        );
      }

      if (col === 'price') {
        const formatted = formatPrice(value);
        if (!formatted) return formatScalar(value);
        return (
          <span className="inline-flex items-baseline gap-1">
            <span className="inline-flex items-baseline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${basePath}/fonts/Dirham%20Currency%20Symbol%20-%20Black.svg`}
                alt="AED"
                className="inline-block h-[9px] w-auto"
                onLoad={(e) => {
                  const parent = e.currentTarget.parentElement;
                  const fallback = parent?.querySelector('[data-dirham-fallback]') as HTMLElement | null;
                  if (fallback) fallback.style.display = 'none';
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span data-dirham-fallback className="text-[11px] text-black/80">
                AED
              </span>
            </span>
            <span>{formatted}</span>
          </span>
        );
      }
      if (col === 'image' || col === 'dam') {
        const urls = extractUrls(value);

        // For image and dam: only show the image stack, or 'No image' if empty
        if (urls.length === 0) {
          if (col === 'dam' && canEdit) {
            if (editingUrl?.id === recordId && editingUrl.column === column) {
              return (
                <div
                  className="absolute inset-0 z-40 bg-white dark:bg-black"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <textarea
                    className="h-full w-full resize-none overflow-hidden border-2 border-emerald-500 bg-transparent p-2 text-[11px] font-medium leading-relaxed outline-none dark:border-emerald-400"
                    value={editingUrl.value}
                    onChange={(e) => setEditingUrl({ ...editingUrl, value: e.target.value })}
                    autoFocus
                    placeholder="URL for Image..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSaveUrl();
                      } else if (e.key === 'Escape' || e.key === 'Esc') {
                        setEditingUrl(null);
                      }
                    }}
                  />
                  {isSaving && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px] dark:bg-black/50">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div className="flex h-12 w-full items-center justify-center">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingUrl({ id: recordId, value: '', column });
                  }}
                  className="group flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-600 transition-all hover:bg-red-500 hover:text-white dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500 dark:hover:text-white pointer-events-auto cursor-pointer"
                  title="Add URL for Image"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            );
          }
          return (
            <div className="flex h-20 w-20 items-center justify-center rounded-md border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
              <span className="text-[10px] items-center justify-center font-medium italic text-black/40 dark:text-white/40">
                No image
              </span>
            </div>
          );
        }

        const maxItems = 4;
        const visibleUrls = urls.slice(0, maxItems);

        return (
          <>
            {canEdit && urls.length > 0 && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingUrl({ id: recordId, value: '', column });
                }}
                className="absolute left-0 top-0 z-[60] flex h-6 w-6 items-center justify-center rounded-br-lg bg-emerald-600 text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 pointer-events-auto cursor-pointer"
                title="Add Image URL"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          <div className="relative h-24 w-24 flex items-center justify-center">
            {visibleUrls
              .slice()
              .reverse()
              .map((u, i) => {
                const revIdx = visibleUrls.length - 1 - i;
                const finalUrl = col === 'dam' ? getDriveDirectLink(u) : u;
                return (
                  <button
                    key={u + i}
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      openPreviewByUrl?.(finalUrl);
                    }}
                    title={finalUrl ? `Image ${revIdx + 1} of ${urls.length} (Click to maximize)` : 'No image'}
                    style={{
                      transformOrigin: 'bottom center',
                      transform: `rotate(${revIdx * 3.2}deg) translate(${revIdx * 4}px, ${-revIdx * 2}px)`,
                      zIndex: visibleUrls.length - revIdx,
                    }}
                    className="absolute pointer-events-auto"
                  >
                    <span className="block h-24 w-24 overflow-hidden rounded-md border border-black/80 bg-white shadow-sm dark:border-white/25 dark:bg-black/60 ring-1 ring-black/10 dark:ring-white/10 backdrop-blur-[2px] transition-transform hover:scale-110 active:scale-95">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={finalUrl}
                        alt="product"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        className="block h-full w-full object-cover"
                      />
                    </span>
                  </button>
                );
              })}
            {urls.length > 1 && (
              <div className="absolute bottom-1 right-1 z-[100] flex h-6 min-w-6 items-center justify-center rounded-full border border-white/30 bg-emerald-600 px-1.5 text-[10px] font-black text-white shadow-xl translate-x-[20%] translate-y-[20%]">
                +{urls.length - 1}
              </div>
            )}
          </div>
          </>
        );
      }

      if (Array.isArray(value)) {
        const arr = value as unknown[];
        const allStrings = arr.every((x) => typeof x === 'string');
        if (allStrings) {
          const items = arr as string[];
          return (
            <div className="flex flex-wrap gap-1">
              {items.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] dark:border-white/10 dark:bg-white/5"
                  title={label}
                >
                  <span className="max-w-[240px] truncate">{label}</span>
                </span>
              ))}
            </div>
          );
        }

        return <span className="text-xs text-black/60 dark:text-white/60">[{arr.length}]</span>;
      }

      const scalar = formatScalar(value);
      if (scalar) return scalar;

      if (typeof value === 'object') {
        const maybe = value as Record<string, unknown>;
        if (typeof maybe.name === 'string') return maybe.name;
        if (typeof maybe.url === 'string') return maybe.url;
        return <span className="text-xs text-black/60 dark:text-white/60">Object</span>;
      }

      return String(value);
    },
    [editingUrl, isSaving, handleSaveUrl, canEdit, openPreviewByUrl]
  );


  const swipeRef = React.useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    moved: boolean;
    swiped: boolean;
  }>({ pointerId: null, startX: 0, startY: 0, moved: false, swiped: false });

  const variantSwipeRef = React.useRef<{
    pointerId: number | null;
    startX: number;
    moved: boolean;
    variantId: string | null;
  }>({ pointerId: null, startX: 0, moved: false, variantId: null });

  const handleVariantSwipeStart = (e: React.PointerEvent, variantId: string) => {
    e.stopPropagation();
    variantSwipeRef.current.pointerId = e.pointerId;
    variantSwipeRef.current.startX = e.clientX;
    variantSwipeRef.current.moved = false;
    variantSwipeRef.current.variantId = variantId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleVariantSwipeMove = (e: React.PointerEvent) => {
    if (variantSwipeRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - variantSwipeRef.current.startX;
    if (!variantSwipeRef.current.moved) {
      if (Math.abs(dx) < 8) return;
      variantSwipeRef.current.moved = true;
    }
  };

  const handleVariantSwipeEnd = (e: React.PointerEvent) => {
    if (variantSwipeRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - variantSwipeRef.current.startX;
    const variantId = variantSwipeRef.current.variantId;

    // Reset swipe state
    variantSwipeRef.current.pointerId = null;
    variantSwipeRef.current.variantId = null;

    // Check if it was a swipe
    if (Math.abs(dx) > 50 && variantId) {
      if (dx > 0) {
        // Swipe right - select
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.add(variantId);
          return next;
        });
      } else {
        // Swipe left - deselect
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(variantId);
          return next;
        });
      }
    }
  };

  React.useEffect(() => {
    const isOpen = Boolean(currentItem?.url);
    if (!isOpen) return;

    const el = document.documentElement;
    const body = document.body;

    const prevOverflowEl = el.style.overflow;
    const prevOverflowBody = body.style.overflow;
    const prevPaddingRightBody = body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - el.clientWidth;
    el.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      el.style.overflow = prevOverflowEl;
      body.style.overflow = prevOverflowBody;
      body.style.paddingRight = prevPaddingRightBody;
    };
  }, [currentItem?.url]);

  const shareSelected = React.useCallback(async () => {
    const items = getSelectedItems(previewIndex);
    if (items.length === 0) return;

    const urls = items.map((x) => x.url);

    try {
      const canNativeShare =
        typeof navigator !== 'undefined' &&
        typeof (navigator as Navigator & { share?: unknown }).share === 'function' &&
        typeof (navigator as Navigator & { canShare?: unknown }).canShare === 'function';

      if (canNativeShare) {
        const files: File[] = [];
        for (const item of items) {
          const res = await fetch(item.url, { cache: 'no-store' });
          if (!res.ok) continue;
          const blob = await res.blob();
          const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
          const filenameBase = (item.code || item.title || 'image').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 64);
          files.push(new File([blob], `${filenameBase}.${ext}`, { type: blob.type || 'image/jpeg' }));
        }

        const shareData = {
          title: items.length === 1 ? items[0].title : 'Products',
          text: items.length === 1 ? items[0].title : `Selected: ${items.length}`,
          files,
        };

        const nav = navigator as Navigator & { share: (data: unknown) => Promise<void>; canShare: (data: unknown) => boolean };
        if (files.length > 0 && nav.canShare(shareData)) {
          await nav.share(shareData);
          return;
        }
      }
    } catch {
      // fallthrough
    }

    try {
      await navigator.clipboard.writeText(urls.join('\n'));
    } catch {
      // ignore
    }
  }, [getSelectedItems, previewIndex]);

  const goNext = React.useCallback(() => {
    setPreviewIndex((i) => {
      if (i === null) return i;
      const n = galleryItems.length;
      if (n <= 1) return i;
      const nextIndex = (i + 1) % n;
      const next = galleryItems[nextIndex];
      setPreviewId(next?.id ?? null);
      // Auto-collapse table when navigating
      setLightboxDetailsCollapsed(true);
      return nextIndex;
    });
  }, [galleryItems]);

  const toggleSort = React.useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey]
  );

  React.useEffect(() => {
    if (previewIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreview();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closePreview, goNext, goPrev, previewIndex]);

  React.useEffect(() => {
    const v = window.localStorage.getItem('products_view_mode');
    if (v === 'list' || v === 'gallery') setViewMode(v);
  }, []);

  React.useEffect(() => {
    const stored = window.localStorage.getItem('products_theme');
    if (stored === 'dark' || stored === 'light') setTheme(stored);
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem('products_theme', theme);
    const el = document.documentElement;
    if (theme === 'dark') el.classList.add('dark');
    else el.classList.remove('dark');
  }, [theme]);

  React.useEffect(() => {
    window.localStorage.setItem('products_view_mode', viewMode);
  }, [viewMode]);

  const headerToggleBase =
    'inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-all active:scale-95';

  const viewToggleNode = (
    <button
      type="button"
      onClick={() => setViewMode((v) => (v === 'list' ? 'gallery' : 'list'))}
      aria-pressed={viewMode === 'list'}
      title={viewMode === 'list' ? 'List View' : 'Gallery View'}
      className={
        headerToggleBase +
        (viewMode === 'list'
          ? ' border-emerald-500/20 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400'
          : ' border-black/10 bg-white/50 text-black/60 hover:bg-white/80 hover:text-black dark:border-white/10 dark:bg-black/40 dark:text-white/60 dark:hover:bg-black/60 dark:hover:text-white')
      }
    >
      {viewMode === 'list' ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      )}
    </button>
  );

  const familyToggleNode = (
    <button
      type="button"
      onClick={() => {
        setFamilyMode((m) => (m === 'main' ? 'collection' : 'main'));
        setFamilyCollectionName(null);
      }}
      aria-pressed={familyMode !== 'main'}
      title={familyMode !== 'main' ? 'Collection View' : 'All Products'}
      className={
        headerToggleBase +
        (familyMode !== 'main'
          ? ' border-emerald-500/20 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400'
          : ' border-black/10 bg-white/50 text-black/60 hover:bg-white/80 hover:text-black dark:border-white/10 dark:bg-black/40 dark:text-white/60 dark:hover:bg-black/60 dark:hover:text-white')
      }
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 12 12 17 22 12" />
        <polyline points="2 17 12 22 22 17" />
      </svg>
    </button>
  );

  const themeToggleNode = (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      aria-pressed={theme === 'dark'}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={
        headerToggleBase +
        (theme === 'dark'
          ? ' border-emerald-500/20 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400'
          : ' border-black/10 bg-white/50 text-black/60 hover:bg-white/80 hover:text-black dark:border-white/10 dark:bg-black/40 dark:text-white/60 dark:hover:bg-black/60 dark:hover:text-white')
      }
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
    </button>
  );

  return (
    <main
      className="flex min-h-0 w-full flex-1 flex-col gap-2 text-black dark:text-white/85 sm:gap-4"
    >
      <style>{`
        .scrollbar-minimal::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .scrollbar-minimal::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-minimal::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.2);
          border-radius: 20px;
          border: 1.5px solid transparent;
          background-clip: content-box;
        }
        .scrollbar-minimal:hover::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.45);
          background-clip: content-box;
        }
        .dark .scrollbar-minimal::-webkit-scrollbar-thumb {
          background: rgba(52, 211, 153, 0.2);
        }
        .dark .scrollbar-minimal:hover::-webkit-scrollbar-thumb {
          background: rgba(52, 211, 153, 0.45);
        }
      `}</style>
      <div className="sticky top-0 z-40 -mx-5 px-5 py-2 border-b border-black/10 bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-black/35">
        <div className="flex w-full items-center gap-2 sm:hidden">
          {mobileTitleNode ?? <h1 className="min-w-0 flex-none truncate text-lg font-semibold">{title}</h1>}
          <input
            className="h-10 w-full min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 text-base dark:border-white/15 dark:bg-black/25 dark:text-white"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-none items-center gap-2">
            {viewToggleNode}
            {familyToggleNode}
            {themeToggleNode}
            <AccountMenu />
          </div>
        </div>

        <div className="hidden w-full sm:flex sm:items-center sm:justify-between">
          <div>
            {titleNode ?? <h1 className="text-2xl font-semibold">{title}</h1>}
            <p className="mt-1 text-sm text-black/60 dark:text-white/55"></p>
          </div>

          <div className="flex items-center gap-2">
            <input
              className="h-[64px] w-[260px] flex-none rounded-md border border-black/15 bg-white px-3 text-sm dark:border-white/15 dark:bg-black/25 dark:text-white"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex items-center gap-2">
              {viewToggleNode}
              {familyToggleNode}
              {themeToggleNode}
              <AccountMenu />
            </div>
          </div>
        </div>
      </div>

      <div className="-mx-5 px-5">
        <div className="mt-1 text-[11px] leading-tight text-black/50 dark:text-white/45">
          <span className="font-medium text-black/60 dark:text-white/60">Records:</span> {data ? data.count : '—'}
          <span className="mx-2 text-black/25 dark:text-white/20">|</span>
          <span className="font-medium text-black/60 dark:text-white/60">Matched:</span> {data ? visibleRecords.length : '—'}
          <span className="mx-2 text-black/25 dark:text-white/20">|</span>
          <span className="font-medium text-black/60 dark:text-white/60">Columns:</span> {data ? columns.length : '—'}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {viewMode === 'list' ? (
        <div className="scrollbar-minimal flex-1 min-h-0 w-full overflow-auto rounded-xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-black/25">
          <table className="min-w-full table-auto text-left text-sm">
            <thead className="bg-transparent text-xs uppercase tracking-wide text-black/60 dark:text-white/60">
              <tr>
                {displayedColumns.map((c, idx) => {
                  const normalizedCol = c.trim().toLowerCase();
                  const isURL = normalizedCol === 'url';
                  return (
                    <th
                      key={c}
                      className={
                        'sticky top-0 bg-white/70 shadow-sm backdrop-blur-md dark:bg-black/45 ' +
                        (idx === 0 ? 'left-0 z-30 ' : 'z-20 ') +
                        (isURL ? 'w-[150px] min-w-[150px] max-w-[150px] ' : '') +
                        'px-4 py-3 text-left'
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(c)}
                        className="inline-flex items-center gap-2 hover:text-black dark:hover:text-white"
                        title="Sort"
                      >
                        <span>{c}</span>
                        {sortKey === c ? (
                          <span className="text-[10px] text-black/40 dark:text-white/35">{sortDir === 'asc' ? '▲' : '▼'}</span>
                        ) : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((r) => (
                <tr
                  key={r.id}
                  className={
                    'border-t border-black/10 align-middle dark:border-white/10 ' +
                    (selectedIds.has(r.id) ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-white dark:bg-black/10')
                  }
                >
                  {displayedColumns.map((c, idx) => {
                    const normalizedCol = c.trim().toLowerCase();
                    const isDAM = normalizedCol === 'dam';
                    const isURL = normalizedCol === 'url';
                    let cellValue = r.fields?.[c];
                    if (isDAM) {
                      const urlEntry = Object.entries(r.fields || {}).find(([k]) => {
                        const kl = k.trim().toLowerCase();
                        return kl === 'url' || kl.endsWith(' url') || kl.endsWith('_url') || kl.endsWith('-url');
                      });
                      cellValue = urlEntry?.[1];
                    }
                    const isEmpty = extractUrls(cellValue).length === 0;
                    const isDebugType = (isDAM || isURL) && isEmpty;
                    return (
                      <td
                        key={c}
                        className={
                          'relative ' +
                          (idx === 0
                            ? 'sticky left-0 z-10 ' +
                            (selectedIds.has(r.id)
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 '
                              : 'bg-white dark:bg-black/10 ')
                            : '') +
                          (isURL ? 'w-[150px] min-w-[150px] max-w-[150px] overflow-hidden ' : '') +
                          (idx === 0
                            ? 'px-4 py-1 whitespace-pre-wrap text-xs text-black/80 dark:text-white/80'
                            : (isDAM
                              ? 'px-1 py-1 whitespace-pre-wrap text-xs text-black/80 dark:text-white/80'
                              : (isURL ? 'px-0 py-3' : 'px-4 py-3') + ' whitespace-pre-wrap text-xs text-black/80 dark:text-white/80')) +
                          (isDebugType ? ' bg-red-500/20 ring-1 ring-red-500/30' : '')
                        }
                        onClick={() => {
                          const colLower = c.trim().toLowerCase();
                          if (colLower === 'image' || isDAM) {
                            const u = extractUrls(cellValue)[0] ?? '';
                            const finalUrl = isDAM ? getDriveDirectLink(u) : u;
                            if (finalUrl) openPreviewByUrl(finalUrl);
                            return;
                          }
                          toggleSelected(r.id);
                        }}
                      >
                        {renderCell(c, cellValue, r.id)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {records.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-sm text-black/50 dark:text-white/50" colSpan={displayedColumns.length}>
                    {loading ? 'Loading…' : 'No records.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="w-full rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/25">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleRecords.map((r) => {
              const urlEntry = Object.entries(r.fields || {}).find(([k]) => {
                const kl = k.trim().toLowerCase();
                return kl === 'url' || kl.endsWith(' url') || kl.endsWith('_url') || kl.endsWith('-url');
              });
              const urlValue = urlEntry?.[1];
              const img = extractUrls(urlValue || r.fields?.DAM || r.fields?.Image)[0] ?? '';
              const name = formatScalar(r.fields?.['Colecction Name']) || formatScalar(r.fields?.Name);
              const code = formatScalar(r.fields?.['Colecction Code']) || formatScalar(r.fields?.Code);
              const variant = formatScalar(r.fields?.['Variant Number']) || formatScalar(r.fields?.Num);
              const fields = r.fields ?? {};
              const dimensionKey = (() => {
                const keys = Object.keys(fields);
                const normalized = keys.map((k) => ({ k, n: k.trim().toLowerCase() }));
                const mm = normalized.find((x) => x.n.includes('dimension') && x.n.includes('mm'))?.k;
                if (mm) return mm;
                const dim = normalized.find((x) => x.n.startsWith('dimension'))?.k;
                if (dim) return dim;
                const size = normalized.find((x) => x.n.startsWith('size'))?.k;
                if (size) return size;
                return null;
              })();

              const size =
                formatScalar(fields['DIMENSION (mm)']) ||
                formatScalar(fields['Dimension (mm)']) ||
                (dimensionKey ? formatScalar(fields[dimensionKey]) : '') ||
                formatScalar(fields['DIMENSION']) ||
                formatScalar(fields['DIMENSIONS']) ||
                formatScalar(fields['Dimension']) ||
                formatScalar(fields['Dimensions']) ||
                formatScalar(fields['SIZE']) ||
                formatScalar(fields['Size']);
              const price = formatPrice(r.fields?.Price) ?? null;

              return (
                <div key={r.id} className="overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-black/20">
                  <div className="block w-full">
                    <div className="aspect-square w-full bg-black/5 dark:bg-white/5">
                      {img ? (
                        <button
                          type="button"
                          className="h-full w-full outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/30"
                          onClick={() => openPreviewByUrl?.(img)}
                          title="Click to maximize"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img}
                            alt="product"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-black/5 text-xs italic text-black/40 dark:bg-white/5 dark:text-white/40">
                          No image
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={
                      'block w-full text-left space-y-0.5 p-2.5 ' +
                      (selectedIds.has(r.id) ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-white dark:bg-black/10')
                    }
                    onClick={() => toggleSelected(r.id)}
                    title={selectedIds.has(r.id) ? 'Selected' : 'Select'}
                    aria-pressed={selectedIds.has(r.id)}
                  >
                    <div className="flex items-start justify-between gap-2 leading-snug">
                      <div className="line-clamp-2 min-w-0 text-sm font-semibold text-black dark:text-white">{name || '—'}</div>
                      <div className="flex-none text-sm font-semibold text-black dark:text-white">{price ? `AED ${price}` : ''}</div>
                    </div>
                    <div className="text-xs leading-snug text-black/60 dark:text-white/55">{code ? `Code: ${code}` : ' '}</div>
                    <div className="flex items-center justify-between gap-2 text-xs leading-snug text-black/70 dark:text-white/65">
                      <span className="truncate">{variant ? `Variant: ${variant}` : ''}</span>
                      <span className={selectedIds.has(r.id) ? 'text-emerald-700 dark:text-emerald-300' : 'text-black/35 dark:text-white/30'}>
                        {selectedIds.has(r.id) ? 'Selected' : ''}
                      </span>
                    </div>
                    <div className="text-xs leading-snug text-black/55 dark:text-white/50">{size ? `Size: ${size}` : ' '}</div>
                  </button>
                </div>
              );
            })}
          </div>

          {records.length === 0 ? (
            <div className="px-2 py-6 text-sm text-black/50 dark:text-white/50">{loading ? 'Loading…' : 'No records.'}</div>
          ) : null}
        </div>
      )}

      {selectedCount > 0 && !currentItem ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <div className="mx-auto max-w-xl transform transition-all duration-200 ease-out translate-y-0 opacity-100">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-2 text-black shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/35 dark:text-white">
              <div className="flex items-center justify-between gap-3 px-2 pb-2">
                <div className="text-xs font-medium text-black/60 dark:text-white/70">Selected: {selectedCount}</div>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs font-semibold text-black/60 hover:text-black dark:text-white/70 dark:hover:text-white"
                >
                  Clear
                </button>
              </div>

              <div className="rounded-2xl border border-black/10 bg-black/5 p-1 backdrop-blur dark:border-white/10 dark:bg-black/25">
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => void downloadSelected()}
                    className="h-11 w-full min-w-0 rounded-xl border border-black/10 bg-white/70 px-2 text-[11px] font-medium tracking-wide text-black/80 hover:bg-white dark:border-white/15 dark:bg-black/10 dark:text-white/90 dark:hover:bg-white/10"
                  >
                    <span className="truncate">Download</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void shareSelected()}
                    className="h-11 w-full min-w-0 rounded-xl border border-black/10 bg-white/70 px-2 text-[11px] font-medium tracking-wide text-black/80 hover:bg-white dark:border-white/15 dark:bg-black/10 dark:text-white/90 dark:hover:bg-white/10"
                  >
                    <span className="truncate">Share</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (familyCollectionName) {
                        setFamilyCollectionName(null);
                        return;
                      }
                      setShowSelectedOnly((v) => !v);
                    }}
                    className={
                      'h-11 w-full min-w-0 rounded-xl border px-2 text-[11px] font-medium tracking-wide ' +
                      (familyCollectionName || showSelectedOnly
                        ? 'border-red-200 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100 dark:hover:bg-red-900/30'
                        : 'border-black/10 bg-white/70 text-black/80 hover:bg-white dark:border-white/15 dark:bg-black/10 dark:text-white/90 dark:hover:bg-white/10')
                    }
                  >
                    <span className="truncate">{familyCollectionName ? 'ALL' : showSelectedOnly ? 'ALL' : 'Selected'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {currentItem?.url ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/85 backdrop-blur-[2px] p-4 text-black dark:bg-black/85 dark:text-white"
          role="dialog"
          aria-modal="true"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) closePreview();
          }}
        >
          <div className="fixed left-3 top-3 z-30 flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/70 text-black/80 shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/35 dark:text-white/85"
              onClick={(e) => {
                e.stopPropagation();
                closePreview();
              }}
              title="Close"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <div className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-semibold text-black/80 backdrop-blur-md dark:border-white/10 dark:bg-black/35 dark:text-white/85">
              {(typeof currentIndex === 'number' ? currentIndex + 1 : 1)} / {galleryItems.length}
            </div>
          </div>

          {selectedIds.has(currentItem.id) ? (
            <div
              className="fixed right-3 top-3 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300/70 bg-emerald-500/15 text-emerald-700 shadow-lg backdrop-blur dark:border-emerald-200/60 dark:bg-emerald-500/20 dark:text-emerald-50"
              onPointerDown={(e) => e.stopPropagation()}
              title="Selected"
              aria-label="Selected"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          ) : null}

          <div
            className="relative flex items-center justify-center"
            style={{ transform: 'translateY(-20%)' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (galleryItems.length <= 1) return;
              swipeRef.current.pointerId = e.pointerId;
              swipeRef.current.startX = e.clientX;
              swipeRef.current.startY = e.clientY;
              swipeRef.current.moved = false;
              swipeRef.current.swiped = false;
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // ignore
              }
            }}
            onPointerMove={(e) => {
              if (swipeRef.current.pointerId !== e.pointerId) return;
              const dx = e.clientX - swipeRef.current.startX;
              const dy = e.clientY - swipeRef.current.startY;
              if (!swipeRef.current.moved) {
                if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
                swipeRef.current.moved = true;
              }

              if (swipeRef.current.swiped) return;
              // Improved swipe detection: lower threshold and better horizontal vs vertical detection
              if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 40) {
                swipeRef.current.swiped = true;
                if (dx < 0) goNext();
                else goPrev();
              }
            }}
            onPointerUp={(e) => {
              if (swipeRef.current.pointerId !== e.pointerId) return;
              swipeRef.current.pointerId = null;
            }}
            onPointerCancel={(e) => {
              if (swipeRef.current.pointerId !== e.pointerId) return;
              swipeRef.current.pointerId = null;
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentItem.url}
              alt={currentItem.title}
              className="max-h-[90vh] w-auto max-w-[95vw] select-none object-contain"
              draggable={false}
              style={{ touchAction: 'pan-y' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (swipeRef.current.swiped) return;

                // Don't handle if parent container has pointer capture
                if (swipeRef.current.pointerId !== null) return;

                // Handle Shift+Click for selection/deselection
                if (e.shiftKey) {
                  toggleSelected(currentItem.id);
                  return;
                }

                // Handle regular click for selection (mouse only)
                if (e.pointerType === 'mouse') {
                  toggleSelected(currentItem.id);
                  return;
                }

                // For touch, don't handle selection - only swipe navigation
                // This prevents accidental selection when trying to swipe
              }}
              onPointerUp={(e) => {
                // Clear long press timer if released early or after swipe
                if (imageLongPressTimer) {
                  clearTimeout(imageLongPressTimer);
                  setImageLongPressTimer(null);
                }

                // Don't handle touch selection on maximized image - only swipe gestures
                // This prevents accidental selection when trying to swipe
              }}
              onPointerLeave={(e) => {
                // Clear long press timer if pointer leaves the image
                if (imageLongPressTimer) {
                  clearTimeout(imageLongPressTimer);
                  setImageLongPressTimer(null);
                }
              }}
            />
          </div>

          {galleryItems.length > 1 ? (
            <button
              type="button"
              onClick={goPrev}
              onPointerDown={(e) => e.stopPropagation()}
              className="fixed left-0 top-0 flex h-full w-[68px] items-center justify-center bg-transparent"
              aria-label="Previous"
            >
              <span className="pointer-events-none inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white/55 text-lg font-semibold text-black shadow-sm backdrop-blur transition dark:border-white/15 dark:bg-black/20 dark:text-white">
                ‹
              </span>
            </button>
          ) : null}

          {galleryItems.length > 1 ? (
            <button
              type="button"
              onClick={goNext}
              onPointerDown={(e) => e.stopPropagation()}
              className="fixed right-0 top-0 flex h-full w-[68px] items-center justify-center bg-transparent"
              aria-label="Next"
            >
              <span className="pointer-events-none inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white/55 text-lg font-semibold text-black shadow-sm backdrop-blur transition dark:border-white/15 dark:bg-black/20 dark:text-white">
                ›
              </span>
            </button>
          ) : null}

          <div
            className="fixed bottom-0 left-0 right-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              className={
                'mx-auto max-h-[45vh] max-w-xl rounded-2xl border p-4 pb-28 text-black shadow-lg backdrop-blur dark:text-white transition-all duration-300 ease-out ' +
                (selectedIds.has(currentItem.id)
                  ? 'border-emerald-300/40 bg-emerald-500/10 dark:border-emerald-200/40 dark:bg-emerald-900/20'
                  : 'border-black/10 bg-white/70 dark:border-white/10 dark:bg-black/35')
                +
                (lightboxDetailsCollapsed ? ' max-h-[120px] sm:max-h-[200px] overflow-hidden mt-8' : ' max-h-[55vh] sm:max-h-[45vh] overflow-auto')
              }
              onClick={() => {
                if (currentCollectionVariants.length > 1) {
                  setLightboxDetailsCollapsed((v) => !v);
                }
              }}
            >
              <div className="relative">
                {currentCollectionVariants.length > 1 && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxDetailsCollapsed((v) => !v);
                    }}
                    className="absolute left-1/2 top-0 z-10 inline-flex h-10 w-10 -translate-x-1/2 -translate-y-[27px] items-center justify-center text-black/60 hover:text-black dark:text-white/55 dark:hover:text-white"
                    aria-label={lightboxDetailsCollapsed ? 'Expand details' : 'Collapse details'}
                    title={lightboxDetailsCollapsed ? 'Expand' : 'Collapse'}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={
                        'h-5 w-5 transition-transform duration-200 ease-out ' +
                        (lightboxDetailsCollapsed ? '' : 'rotate-180')
                      }
                      fill="none"
                      aria-hidden="true"
                    >
                      <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}

                <div
                  className={
                    'overflow-hidden rounded-xl border border-black/10 bg-black/5 transition-all duration-300 ease-out dark:border-white/10 dark:bg-black/10' +
                    ''
                  }
                  onTouchStart={(e) => {
                    if (currentCollectionVariants.length <= 1) return;
                    const touch = e.touches[0];
                    setTableSwipeStart({ x: touch.clientX, y: touch.clientY });
                  }}
                  onTouchMove={(e) => {
                    if (!tableSwipeStart || currentCollectionVariants.length <= 1) return;
                    const touch = e.touches[0];
                    const deltaY = touch.clientY - tableSwipeStart.y;
                    const threshold = 50;

                    if (Math.abs(deltaY) > threshold) {
                      if (deltaY > 0 && !lightboxDetailsCollapsed) {
                        // Swipe down - collapse
                        setLightboxDetailsCollapsed(true);
                      } else if (deltaY < 0 && lightboxDetailsCollapsed) {
                        // Swipe up - expand
                        setLightboxDetailsCollapsed(false);
                      }
                      setTableSwipeStart(null);
                    }
                  }}
                  onTouchEnd={() => {
                    if (currentCollectionVariants.length > 1) {
                      setTableSwipeStart(null);
                    }
                  }}
                >
                  <div className="grid grid-cols-5 gap-px bg-black/10 dark:bg-white/10">
                    <div className="min-h-10 bg-white/60 px-3 py-2 text-[11px] font-medium leading-tight text-black/60 dark:bg-black/20 dark:text-white/70">
                      Collection Name
                    </div>
                    <div className="min-h-10 bg-white/60 px-3 py-2 text-[11px] font-medium leading-tight text-black/60 dark:bg-black/20 dark:text-white/70">
                      Collection Code
                    </div>
                    <div className="min-h-10 bg-white/60 px-3 py-2 text-[11px] font-medium leading-tight text-black/60 dark:bg-black/20 dark:text-white/70">
                      Variant Number
                    </div>
                    <div className="min-h-10 bg-white/60 px-3 py-2 text-[11px] font-medium leading-tight text-black/60 dark:bg-black/20 dark:text-white/70">
                      DIMENSION (mm)
                    </div>
                    <div className="min-h-10 bg-white/60 px-3 py-2 text-[11px] font-medium leading-tight text-black/60 dark:bg-black/20 dark:text-white/70">
                      Price
                    </div>

                    {currentCollectionVariants[0] ? (
                      <React.Fragment key={currentCollectionVariants[0].id}>
                        {(() => {
                          const v = currentCollectionVariants[0];
                          const baseClass =
                            selectedIds.has(v.id)
                              ? 'bg-emerald-100 px-3 py-2 text-left text-sm leading-tight hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 font-semibold text-emerald-900 dark:text-emerald-100'
                              : 'bg-white/70 px-3 py-2 text-left text-sm leading-tight hover:bg-white dark:bg-black/20 dark:hover:bg-black/30 font-semibold text-black dark:text-white';
                          const handler = (e: React.PointerEvent | React.MouseEvent) => {
                            e.stopPropagation();

                            // Handle Shift+Click for selection/deselection
                            if (e.shiftKey) {
                              toggleSelected(v.id);
                              return;
                            }

                            const key = (v.collectionNameNormalized || '').trim();
                            if (key) setFamilyCollectionName(key);
                            setPreviewId(v.id);
                            setPreviewIndex((i) => (i === null ? 0 : i));
                            // Auto-collapse table when clicking to view image
                            setLightboxDetailsCollapsed(true);
                          };
                          return (
                            <>
                              <button type="button" className={baseClass} onPointerDown={(e) => e.stopPropagation()} onClick={handler}>
                                <div className="whitespace-normal break-words sm:truncate">{v.title}</div>
                              </button>
                              <button type="button" className={baseClass} onPointerDown={(e) => e.stopPropagation()} onClick={handler}>
                                <div className="whitespace-normal break-words sm:truncate">{v.code || '—'}</div>
                              </button>
                              <button type="button" className={baseClass} onPointerDown={(e) => e.stopPropagation()} onClick={handler}>
                                <div className="whitespace-normal break-words sm:truncate">{v.variant || '—'}</div>
                              </button>
                              <button type="button" className={baseClass} onPointerDown={(e) => e.stopPropagation()} onClick={handler}>
                                <div className="whitespace-normal break-words sm:truncate">{v.dimension || '—'}</div>
                              </button>
                              <button type="button" className={baseClass} onPointerDown={(e) => e.stopPropagation()} onClick={handler}>
                                <div className="whitespace-normal break-words sm:truncate">{v.price ? `AED ${v.price}` : '—'}</div>
                              </button>
                            </>
                          );
                        })()}
                      </React.Fragment>
                    ) : null}
                  </div>

                  <div
                    className={
                      'transition-[max-height] duration-300 ease-out ' +
                      (lightboxDetailsCollapsed
                        ? 'max-h-0 sm:max-h-[96px] pointer-events-none overflow-hidden'
                        : 'max-h-[50vh] sm:max-h-[40vh] overflow-y-auto')
                    }
                  >
                    <div className="grid grid-cols-5 gap-px bg-black/10 dark:bg-white/10">
                      {currentCollectionVariants.slice(1).map((v) => (
                        <React.Fragment key={v.id}>
                          <button
                            type="button"
                            className={
                              selectedIds.has(v.id)
                                ? 'bg-emerald-100 px-3 py-2 text-left text-sm leading-tight text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:hover:bg-emerald-900/50'
                                : 'bg-white/70 px-3 py-2 text-left text-sm leading-tight text-black/70 hover:bg-white dark:bg-black/20 dark:text-white/65 dark:hover:bg-black/30'
                            }
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              handleVariantSwipeStart(e, v.id);
                            }}
                            onPointerMove={handleVariantSwipeMove}
                            onPointerUp={handleVariantSwipeEnd}
                            onClick={(e) => {
                              e.stopPropagation();

                              // Handle Shift+Click for selection/deselection
                              if (e.shiftKey) {
                                toggleSelected(v.id);
                                return;
                              }

                              const key = (v.collectionNameNormalized || '').trim();
                              if (key) setFamilyCollectionName(key);
                              setPreviewId(v.id);
                              setPreviewIndex((i) => (i === null ? 0 : i));
                              // Auto-collapse table when clicking to view image
                              setLightboxDetailsCollapsed(true);
                            }}
                          >
                            <div className="whitespace-normal break-words sm:truncate">{v.title}</div>
                          </button>
                          <button
                            type="button"
                            className={
                              selectedIds.has(v.id)
                                ? 'bg-emerald-100 px-3 py-2 text-left text-sm leading-tight text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:hover:bg-emerald-900/50'
                                : 'bg-white/70 px-3 py-2 text-left text-sm leading-tight text-black/70 hover:bg-white dark:bg-black/20 dark:text-white/65 dark:hover:bg-black/30'
                            }
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              handleVariantSwipeStart(e, v.id);
                            }}
                            onPointerMove={handleVariantSwipeMove}
                            onPointerUp={handleVariantSwipeEnd}
                            onClick={(e) => {
                              e.stopPropagation();

                              // Handle Shift+Click for selection/deselection
                              if (e.shiftKey) {
                                toggleSelected(v.id);
                                return;
                              }

                              const key = (v.collectionNameNormalized || '').trim();
                              if (key) setFamilyCollectionName(key);
                              setPreviewId(v.id);
                              setPreviewIndex((i) => (i === null ? 0 : i));
                              // Auto-collapse table when clicking to view image
                              setLightboxDetailsCollapsed(true);
                            }}
                          >
                            <div className="whitespace-normal break-words sm:truncate">{v.code || '—'}</div>
                          </button>
                          <button
                            type="button"
                            className={
                              selectedIds.has(v.id)
                                ? 'bg-emerald-100 px-3 py-2 text-left text-sm leading-tight text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:hover:bg-emerald-900/50'
                                : 'bg-white/70 px-3 py-2 text-left text-sm leading-tight text-black/70 hover:bg-white dark:bg-black/20 dark:text-white/65 dark:hover:bg-black/30'
                            }
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              handleVariantSwipeStart(e, v.id);
                            }}
                            onPointerMove={handleVariantSwipeMove}
                            onPointerUp={handleVariantSwipeEnd}
                            onClick={(e) => {
                              e.stopPropagation();

                              // Handle Shift+Click for selection/deselection
                              if (e.shiftKey) {
                                toggleSelected(v.id);
                                return;
                              }

                              const key = (v.collectionNameNormalized || '').trim();
                              if (key) setFamilyCollectionName(key);
                              setPreviewId(v.id);
                              setPreviewIndex((i) => (i === null ? 0 : i));
                              // Auto-collapse table when clicking to view image
                              setLightboxDetailsCollapsed(true);
                            }}
                          >
                            <div className="whitespace-normal break-words sm:truncate">{v.variant || '—'}</div>
                          </button>
                          <button
                            type="button"
                            className={
                              selectedIds.has(v.id)
                                ? 'bg-emerald-100 px-3 py-2 text-left text-sm leading-tight text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:hover:bg-emerald-900/50'
                                : 'bg-white/70 px-3 py-2 text-left text-sm leading-tight text-black/70 hover:bg-white dark:bg-black/20 dark:text-white/65 dark:hover:bg-black/30'
                            }
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              handleVariantSwipeStart(e, v.id);
                            }}
                            onPointerMove={handleVariantSwipeMove}
                            onPointerUp={handleVariantSwipeEnd}
                            onClick={(e) => {
                              e.stopPropagation();

                              // Handle Shift+Click for selection/deselection
                              if (e.shiftKey) {
                                toggleSelected(v.id);
                                return;
                              }

                              const key = (v.collectionNameNormalized || '').trim();
                              if (key) setFamilyCollectionName(key);
                              setPreviewId(v.id);
                              setPreviewIndex((i) => (i === null ? 0 : i));
                              // Auto-collapse table when clicking to view image
                              setLightboxDetailsCollapsed(true);
                            }}
                          >
                            <div className="whitespace-normal break-words sm:truncate">{v.dimension || '—'}</div>
                          </button>
                          <button
                            type="button"
                            className={
                              selectedIds.has(v.id)
                                ? 'bg-emerald-100 px-3 py-2 text-left text-sm leading-tight text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:hover:bg-emerald-900/50'
                                : 'bg-white/70 px-3 py-2 text-left text-sm leading-tight text-black/70 hover:bg-white dark:bg-black/20 dark:text-white/65 dark:hover:bg-black/30'
                            }
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              handleVariantSwipeStart(e, v.id);
                            }}
                            onPointerMove={handleVariantSwipeMove}
                            onPointerUp={handleVariantSwipeEnd}
                            onClick={(e) => {
                              e.stopPropagation();

                              // Handle Shift+Click for selection/deselection
                              if (e.shiftKey) {
                                toggleSelected(v.id);
                                return;
                              }

                              const key = (v.collectionNameNormalized || '').trim();
                              if (key) setFamilyCollectionName(key);
                              setPreviewId(v.id);
                              setPreviewIndex((i) => (i === null ? 0 : i));
                              // Auto-collapse table when clicking to view image
                              setLightboxDetailsCollapsed(true);
                            }}
                          >
                            <div className="whitespace-normal break-words sm:truncate">{v.price ? `AED ${v.price}` : '—'}</div>
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>

          <div
            className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="mx-auto max-w-xl transform transition-all duration-200 ease-out translate-y-0 opacity-100">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-2 text-white shadow-lg backdrop-blur">
                <div className="flex items-center justify-between gap-3 px-2 pb-2">
                  <div className="text-xs font-medium text-white/70">Selected: {selectedCount}</div>
                  {selectedCount > 0 ? (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setSelectedIds(new Set())}
                      className="text-xs font-semibold text-white/70 hover:text-white"
                    >
                      Clear
                    </button>
                  ) : (
                    <div className="text-xs font-semibold text-white/35">Clear</div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-1 backdrop-blur">
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => void downloadSelected()}
                      className="h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/10 px-2 text-[11px] font-medium tracking-wide text-white/90 hover:bg-white/10"
                    >
                      <span className="truncate">Download</span>
                    </button>

                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => void shareSelected()}
                      className="h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/10 px-2 text-[11px] font-medium tracking-wide text-white/90 hover:bg-white/10"
                    >
                      <span className="truncate">Share</span>
                    </button>

                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        if (familyCollectionName) {
                          const familyKey = (currentItem?.collectionNameNormalized || '').trim();
                          if (familyKey) {
                            const mappedIdx = baseGalleryItems.findIndex((x) => x.collectionNameNormalized === familyKey);
                            if (mappedIdx >= 0) {
                              setPreviewIndex(mappedIdx);
                              setPreviewId(baseGalleryItems[mappedIdx].id);
                            }
                          }
                          setFamilyCollectionName(null);
                          return;
                        }
                        const current =
                          typeof currentIndex === 'number' && currentIndex >= 0
                            ? galleryItems[currentIndex]
                            : (previewId ? baseGalleryItems.find((x) => x.id === previewId) : null) ??
                            currentItem;
                        const key = (current?.collectionNameNormalized || '').trim();
                        if (!key) return;
                        setFamilyCollectionName(key);
                      }}
                      disabled={!familyCollectionName && !(currentItem?.collectionNameNormalized || '').trim()}
                      className={
                        'h-11 w-full min-w-0 rounded-xl border px-2 text-[11px] font-medium tracking-wide ' +
                        (familyCollectionName
                          ? 'border-red-300 bg-red-500/10 text-red-100 hover:bg-red-500/20'
                          : (currentItem?.collectionNameNormalized || '').trim()
                            ? 'border-white/15 bg-black/10 text-white/90 hover:bg-white/10'
                            : 'border-white/10 bg-black/10 text-white/45')
                      }
                    >
                      <span className="truncate">{familyCollectionName ? 'ALL' : 'Collection'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
