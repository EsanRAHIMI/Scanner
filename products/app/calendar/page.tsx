'use client';

import * as React from 'react';

interface ContentItem {
  id: string;
  fields: Record<string, unknown>;
  publish_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

type ContentCalendarListResponse = {
  items: ContentItem[];
  limit: number;
  skip: number;
};

type TrainerMe = {
  id: string;
  email: string;
  username: string;
};

export default function ContentCalendarPage() {
  const [contentItems, setContentItems] = React.useState<ContentItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [logoLoaded, setLogoLoaded] = React.useState(false);
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');
  const [statusOptions, setStatusOptions] = React.useState<string[]>([
    'Published',
    'Scheduled',
    'In Progress',
    'Draft',
  ]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const deferredSearchTerm = React.useDeferredValue(searchTerm);
  const [allColumns, setAllColumns] = React.useState<string[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<ContentItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [editorFields, setEditorFields] = React.useState<Record<string, string>>({});
  const [editingCell, setEditingCell] = React.useState<{ id: string; column: string } | null>(null);
  const [cellDraftValue, setCellDraftValue] = React.useState<string>('');
  const [cellOriginalValue, setCellOriginalValue] = React.useState<string>('');
  const inlineTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({});
  const isResizingRef = React.useRef(false);
  const [contextMenu, setContextMenu] = React.useState<
    | null
    | {
        x: number;
        y: number;
        item: ContentItem | null;
      }
  >(null);
  const contextMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [authRequired, setAuthRequired] = React.useState(false);
  const [loginEmail, setLoginEmail] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [me, setMe] = React.useState<TrainerMe | null>(null);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [accountLoading, setAccountLoading] = React.useState(false);
  const [accountError, setAccountError] = React.useState<string | null>(null);
  const accountMenuRef = React.useRef<HTMLDivElement | null>(null);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

  const COLUMN_WIDTHS_STORAGE_KEY = 'contentCalendar.columnWidths.v1';
  const MIN_COL_PX = 120;
  const MAX_COL_PX = 420;

  const defaultColWidth = React.useCallback((col: string) => {
    const estimated = col.length * 8 + 40;
    return Math.min(MAX_COL_PX, Math.max(MIN_COL_PX, estimated));
  }, []);

  const isRtlText = React.useCallback((text: string) => {
    // Arabic + Persian blocks + Arabic presentation forms
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
  }, []);

  const dirForValue = React.useCallback(
    (value: unknown): 'rtl' | 'ltr' => {
      if (typeof value !== 'string') return 'ltr';
      return isRtlText(value) ? 'rtl' : 'ltr';
    },
    [isRtlText]
  );

  const alignClassForValue = React.useCallback(
    (value: unknown) => (dirForValue(value) === 'rtl' ? 'text-right' : 'text-left'),
    [dirForValue]
  );

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && Number.isFinite(v)) next[k] = v;
      }
      setColumnWidths(next);
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    if (!allColumns.length) return;
    setColumnWidths((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const col of allColumns) {
        if (typeof next[col] !== 'number') {
          next[col] = defaultColWidth(col);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [allColumns, defaultColWidth]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
    } catch {
      // ignore
    }
  }, [columnWidths]);

  const clampWidth = (col: string, px: number) => {
    const min = Math.max(MIN_COL_PX, defaultColWidth(col));
    return Math.min(MAX_COL_PX, Math.max(min, px));
  };

  const startResizeColumn = (e: React.PointerEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = columnWidths[col] ?? defaultColWidth(col);
    isResizingRef.current = true;

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      const next = clampWidth(col, startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [col]: next }));
    };
    const onUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  React.useEffect(() => {
    let cancelled = false;

    setLogoLoaded(false);
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setLogoLoaded(true);
    };
    img.onerror = () => {
      if (!cancelled) setLogoLoaded(false);
    };
    img.src = `${basePath}/Logo1.png`;

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    fetchContentCalendarData();
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const el = accountMenuRef.current;
      if (!el) return;
      if (accountOpen && e.target instanceof Node && !el.contains(e.target)) {
        setAccountOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [accountOpen]);

  React.useEffect(() => {
    if (!contextMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      const menuEl = contextMenuRef.current;
      const target = e.target as Node | null;
      if (!menuEl || !target) {
        setContextMenu(null);
        return;
      }
      if (!menuEl.contains(target)) setContextMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  const orderedColumns = React.useMemo(
    () => [
      'Title',
      'Publish Date',
      'Day of Week',
      'Content Pillar',
      'Format',
      'Status',
      'Caption Idea',
      'CTA',
      'Tone of Voice',
      'Target Audience',
      'Week Number',
      '# Hashtag',
      'Product',
      'Product Image',
    ],
    []
  );

  const openEditor = (item: ContentItem) => {
    setSelectedItem(item);
    const next: Record<string, string> = {};
    for (const col of orderedColumns) {
      const v = item.fields?.[col];
      next[col] = typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v);
    }
    setEditorFields(next);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setSelectedItem(null);
    setEditorFields({});
  };

  const beginCellEdit = (item: ContentItem, column: string) => {
    const raw = item.fields?.[column];
    const initial = typeof raw === 'string' ? raw : raw === null || raw === undefined ? '' : String(raw);
    setEditingCell({ id: item.id, column });
    setCellDraftValue(initial);
    setCellOriginalValue(initial);
  };

  const cancelCellEdit = () => {
    setEditingCell(null);
    setCellDraftValue('');
    setCellOriginalValue('');
    inlineTextareaRef.current = null;
  };

  const autosizeInlineTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const patchFields = async (id: string, fields: Record<string, string>) => {
    const res = await fetch(`/api/content-calendar/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    const text = await res.text();
    if (res.status === 401) {
      setAuthRequired(true);
      throw new Error('NOT_AUTHENTICATED');
    }
    if (!res.ok) throw new Error(text || `Request failed (${res.status})`);
  };

  const commitCellEdit = async (override?: { value: string }) => {
    try {
      if (!editingCell) return;
      if (isSaving) return;

      const { id, column } = editingCell;
      const nextValue = override ? override.value : cellDraftValue;

      if (nextValue === cellOriginalValue) {
        cancelCellEdit();
        return;
      }

      setIsSaving(true);
      setError(null);

      const colLower = column.trim().toLowerCase();
      const next: Record<string, string> = { [column]: nextValue };

      if (colLower === 'publish date') {
        const iso = normalizeDateForInput(nextValue);
        next[column] = iso;
        next['Day of Week'] = weekdayFromIsoDate(iso);
      }

      await patchFields(id, next);
      setContentItems((prev) =>
        prev.map((it) => {
          if (it.id !== id) return it;
          const fields = { ...(it.fields ?? {}) } as Record<string, unknown>;
          for (const [k, v] of Object.entries(next)) fields[k] = v;
          return { ...it, fields };
        })
      );
      cancelCellEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const loadMe = async () => {
    setAccountError(null);
    setAccountLoading(true);
    try {
      const res = await fetch('/api/trainer/auth/me', { cache: 'no-store' });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Failed to load user (${res.status})`);
      const data = JSON.parse(text) as Partial<TrainerMe>;
      if (!data?.email || !data?.username) throw new Error('Invalid /me response');
      setMe({ id: String(data.id ?? ''), email: String(data.email), username: String(data.username) });
    } catch (e) {
      setMe(null);
      setAccountError(e instanceof Error ? e.message : 'Failed to load user');
    } finally {
      setAccountLoading(false);
    }
  };

  const toggleAccount = async () => {
    const next = !accountOpen;
    setAccountOpen(next);
    if (next && !me && !accountLoading) {
      await loadMe();
    }
  };

  const logout = async () => {
    setAccountError(null);
    setAccountLoading(true);
    try {
      const res = await fetch('/api/trainer/auth/logout', { method: 'POST', cache: 'no-store' });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Logout failed (${res.status})`);
      setAccountOpen(false);
      setMe(null);
      setAuthRequired(true);
    } catch (e) {
      setAccountError(e instanceof Error ? e.message : 'Logout failed');
    } finally {
      setAccountLoading(false);
    }
  };

  const ensureStatusOption = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    setStatusOptions((prev) => {
      const exists = prev.some((p) => p.toLowerCase() === v.toLowerCase());
      if (exists) return prev;
      return [...prev, v];
    });
  };

  const CreatableSelect = (props: {
    value: string;
    options: string[];
    placeholder?: string;
    autoFocus?: boolean;
    className?: string;
    dir?: 'rtl' | 'ltr';
    onChange: (value: string) => void;
    onCommit?: (value: string) => void;
    onEscape?: () => void;
    onCreateOption?: (value: string) => void;
  }) => {
    const {
      value,
      options,
      placeholder,
      autoFocus,
      className,
      dir,
      onChange,
      onCommit,
      onEscape,
      onCreateOption,
    } = props;
    const [open, setOpen] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
      if (!open) return;
      const onPointerDown = (e: PointerEvent) => {
        const root = rootRef.current;
        const t = e.target as Node | null;
        if (!root || !t) {
          setOpen(false);
          return;
        }
        if (!root.contains(t)) setOpen(false);
      };
      document.addEventListener('pointerdown', onPointerDown, true);
      return () => document.removeEventListener('pointerdown', onPointerDown, true);
    }, [open]);

    const q = value.trim().toLowerCase();
    const filtered = q
      ? options.filter((o) => o.toLowerCase().includes(q))
      : options;

    const normalizedExisting = options.find((o) => o.toLowerCase() === q);
    const canCreate = value.trim() !== '' && !normalizedExisting;

    const commitValue = (raw: string) => {
      const v = raw.trim();
      if (!v) return;
      const existing = options.find((o) => o.toLowerCase() === v.toLowerCase());
      const next = existing ?? v;
      if (!existing) onCreateOption?.(next);
      onChange(next);
      setOpen(false);
      onCommit?.(next);
    };

    return (
      <div ref={rootRef} className="relative">
        <input
          autoFocus={autoFocus}
          className={className}
          dir={dir}
          value={value}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setOpen(false);
              onEscape?.();
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              commitValue(value);
              return;
            }
            if (e.key === 'ArrowDown') {
              setOpen(true);
            }
          }}
          onBlur={() => {
            if (onCommit) commitValue(value);
          }}
        />

        {open ? (
          <div className="cc-scroll absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-auto rounded-lg border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-950">
            {canCreate ? (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  commitValue(value);
                }}
              >
                Add "{value.trim()}"
              </button>
            ) : null}
            {filtered.length ? (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={
                    'w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5 ' +
                    (opt.toLowerCase() === q
                      ? 'bg-black/5 dark:bg-white/5'
                      : '')
                  }
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    commitValue(opt);
                  }}
                >
                  {opt}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-black/50 dark:text-white/50">No options</div>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  const createNew = async () => {
    try {
      setIsSaving(true);
      setError(null);
      const res = await fetch('/api/content-calendar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fields: {} }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Request failed (${res.status})`);
      const created = JSON.parse(text) as ContentItem;
      await fetchContentCalendarData();
      if (created?.id) {
        openEditor(created);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setIsSaving(false);
    }
  };

  const duplicateItem = async (source: ContentItem) => {
    try {
      setIsSaving(true);
      setError(null);
      const fields = { ...(source.fields ?? {}) } as Record<string, unknown>;
      const res = await fetch('/api/content-calendar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Request failed (${res.status})`);
      const created = JSON.parse(text) as ContentItem;
      setContentItems((prev) => [created, ...prev]);
      setContextMenu(null);
      openEditor(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to duplicate');
    } finally {
      setIsSaving(false);
    }
  };

  const saveEditor = async () => {
    try {
      if (!selectedItem?.id) return;
      setIsSaving(true);
      setError(null);
      const res = await fetch(`/api/content-calendar/${encodeURIComponent(selectedItem.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fields: editorFields }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Request failed (${res.status})`);
      await fetchContentCalendarData();
      closeEditor();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      setIsSaving(true);
      setError(null);
      const res = await fetch(`/api/content-calendar/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Request failed (${res.status})`);
      if (selectedItem?.id === id) closeEditor();
      await fetchContentCalendarData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchContentCalendarData = async () => {
    try {
      setLoading(true);
      setError(null);
      setAuthRequired(false);
      const response = await fetch('/api/content-calendar', { cache: 'no-store' });
      const text = await response.text();
      if (response.status === 401) {
        setAuthRequired(true);
        return;
      }
      if (!response.ok) {
        throw new Error(text || `Request failed (${response.status})`);
      }

      const data = JSON.parse(text) as ContentCalendarListResponse;
      const items = Array.isArray(data.items) ? data.items : [];

      setStatusOptions((prev) => {
        const next = [...prev];
        const seen = new Set(prev.map((p) => p.toLowerCase()));
        for (const it of items) {
          const raw = it?.fields?.['Status'];
          const v = typeof raw === 'string' ? raw.trim() : '';
          if (!v) continue;
          const key = v.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          next.push(v);
        }
        return next;
      });

      const columnsSet = new Set<string>();
      for (const it of items) {
        const fields = (it?.fields ?? {}) as Record<string, unknown>;
        for (const key of Object.keys(fields)) columnsSet.add(key);
      }

      // Filter to only include columns that exist in the data, in the requested order
      const finalColumns = orderedColumns.filter((col) => columnsSet.has(col));
      // Ensure even empty Mongo dataset still shows the ordered columns
      if (finalColumns.length === 0) finalColumns.push(...orderedColumns);

      // Add any remaining columns that weren't in the ordered list (at the end)
      const remainingColumns = Array.from(columnsSet).filter((col) => !orderedColumns.includes(col));
      finalColumns.push(...remainingColumns);

      setAllColumns(finalColumns);
      setContentItems(items);

      // best-effort read current user for header display
      try {
        const meRes = await fetch('/api/trainer/auth/me', { cache: 'no-store' });
        if (meRes.ok) {
          const meText = await meRes.text();
          const parsed = JSON.parse(meText) as TrainerMe;
          if (parsed && typeof parsed === 'object') setMe(parsed);
        }
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const submitLogin = async () => {
    try {
      setIsSaving(true);
      setLoginError(null);
      const res = await fetch('/api/trainer/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const text = await res.text();
      if (!res.ok) {
        setLoginError(text || `Login failed (${res.status})`);
        return;
      }

      setAuthRequired(false);
      setLoginPassword('');
      await fetchContentCalendarData();
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setIsSaving(false);
    }
  };

  const authModal = authRequired ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Sign in required</div>
            <div className="mt-1 text-sm text-black/60 dark:text-white/60">
              Please sign in to access the Content Calendar.
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20"
            onClick={() => {
              setAuthRequired(false);
              setError('NOT_AUTHENTICATED');
            }}
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <div>
            <label className="block text-xs font-medium text-black/60 dark:text-white/60">Email</label>
            <input
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:bg-black/20 dark:focus:ring-white/20"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-black/60 dark:text-white/60">Password</label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:bg-black/20 dark:focus:ring-white/20"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {loginError ? (
            <div className="rounded-lg border border-red-900/20 bg-red-100/70 px-3 py-2 text-sm text-red-900 dark:border-red-100/20 dark:bg-red-900/20 dark:text-red-100">
              {loginError}
            </div>
          ) : null}

          <button
            type="button"
            onClick={submitLogin}
            disabled={isSaving || !loginEmail || !loginPassword}
            className={
              isSaving || !loginEmail || !loginPassword
                ? 'mt-1 rounded-lg bg-black/10 px-3 py-2 text-sm opacity-60 cursor-not-allowed dark:bg-white/10'
                : 'mt-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700'
            }
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Published': return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100';
      case 'Scheduled': return 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100';
      case 'In Progress': return 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100';
      case 'Draft': return 'bg-gray-100 text-gray-900 dark:bg-gray-900/30 dark:text-gray-100';
      default: return 'bg-gray-100 text-gray-900 dark:bg-gray-900/30 dark:text-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100';
      case 'Medium': return 'bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-100';
      case 'Low': return 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100';
      default: return 'bg-gray-100 text-gray-900 dark:bg-gray-900/30 dark:text-gray-100';
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case 'linkedin': return '🔗';
      case 'twitter': return '🐦';
      case 'instagram': return '📷';
      case 'facebook': return '📘';
      case 'blog': return '📝';
      case 'youtube': return '📺';
      case 'tiktok': return '🎵';
      default: return '📱';
    }
  };

  const filteredItems = React.useMemo(() => {
    return contentItems.filter(item => {
      const status = typeof item.fields?.['Status'] === 'string' ? String(item.fields['Status']) : '';
      const title = typeof item.fields?.['Title'] === 'string' ? String(item.fields['Title']) : '';
      const captionIdea = typeof item.fields?.['Caption Idea'] === 'string' ? String(item.fields['Caption Idea']) : '';
      const targetAudience = typeof item.fields?.['Target Audience'] === 'string' ? String(item.fields['Target Audience']) : '';

      const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
      const q = deferredSearchTerm.trim().toLowerCase();
      const matchesSearch = q === '' ||
        title.toLowerCase().includes(q) ||
        captionIdea.toLowerCase().includes(q) ||
        targetAudience.toLowerCase().includes(q);
      
      return matchesStatus && matchesSearch;
    });
  }, [contentItems, selectedStatus, deferredSearchTerm]);

  const stats = React.useMemo(() => {
    const total = contentItems.length;
    const published = contentItems.filter(item => item.fields?.['Status'] === 'Published').length;
    const scheduled = contentItems.filter(item => item.fields?.['Status'] === 'Scheduled').length;
    const inProgress = contentItems.filter(item => item.fields?.['Status'] === 'In Progress').length;
    const draft = contentItems.filter(item => item.fields?.['Status'] === 'Draft').length;
    // Remove reach calculations as these fields don't exist in the actual Airtable
    const totalReach = 0;
    const actualReach = 0;

    return { total, published, scheduled, inProgress, draft, totalReach, actualReach };
  }, [contentItems]);

  const renderCell = (column: string, value: unknown) => {
    if (value === null || value === undefined) return <span className="text-black/40 dark:text-white/40">—</span>;

    const col = column.trim().toLowerCase();

    if (col === 'day of week') {
      if (typeof value === 'string' && value.trim()) return <span className="text-sm">{value}</span>;
      return <span className="text-black/40 dark:text-white/40">—</span>;
    }
    
    // Special handling for Product Image
    if (col === 'product image') {
      // Handle both string URLs and object with url property
      let imageUrl = '';
      if (typeof value === 'string') {
        imageUrl = value;
      } else if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        imageUrl = obj.url ? String(obj.url) : '';
      }
      
      if (imageUrl && imageUrl.startsWith('http')) {
        return (
          <img
            src={imageUrl}
            alt="Product"
            className="h-12 w-12 object-cover rounded border border-black/10 dark:border-white/10"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        );
      }
      return <span className="text-black/40 dark:text-white/40">—</span>;
    }
    
    // Handle objects - show empty instead of [object Object]
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return <span className="text-black/40 dark:text-white/40">—</span>;
    }
    
    if (col === 'status') {
      return (
        <span className={`inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] dark:border-white/10 dark:bg-white/5 ${getStatusColor(String(value))}`}>
          <span className="max-w-[120px] truncate">{String(value)}</span>
        </span>
      );
    }
    
    if (col === 'priority') {
      return (
        <span className={`inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] dark:border-white/10 dark:bg-white/5 ${getPriorityColor(String(value))}`}>
          <span className="max-w-[80px] truncate">{String(value)}</span>
        </span>
      );
    }
    
    if (col === 'platform') {
      return (
        <div className="flex items-center gap-1">
          <span className="text-sm">{getPlatformIcon(String(value))}</span>
          <span className="text-sm">{String(value)}</span>
        </div>
      );
    }
    
    if (col === 'tags') {
      const tags = Array.isArray(value) ? value : [value];
      return (
        <div className="flex flex-wrap gap-1">
          {(tags as string[]).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] dark:border-white/10 dark:bg-white/5"
              title={tag}
            >
              <span className="max-w-[120px] truncate">{tag}</span>
            </span>
          ))}
        </div>
      );
    }
    
    if (col === 'estimated reach' || col === 'actual reach') {
      // These fields don't exist in the actual Airtable data
      return <span className="text-black/40 dark:text-white/40">—</span>;
    }
    
    if (col === 'engagement rate') {
      // This field doesn't exist in the actual Airtable data
      return <span className="text-black/40 dark:text-white/40">—</span>;
    }
    
    if (col === 'publish date' || col === 'created at' || col === 'updated at') {
      const date = new Date(String(value));
      if (!isNaN(date.getTime())) {
        return <span className="text-sm">{date.toLocaleDateString()}</span>;
      }
      return <span className="text-black/40 dark:text-white/40">—</span>;
    }
    
    if (typeof value === 'string' && value.length > 100) {
      return (
        <span
          className={`block w-full text-sm ${alignClassForValue(value)}`}
          dir={dirForValue(value)}
          title={value}
        >
          {value.substring(0, 100)}...
        </span>
      );
    }

    if (typeof value === 'string') {
      return (
        <span className={`block w-full text-sm ${alignClassForValue(value)}`} dir={dirForValue(value)}>
          {value}
        </span>
      );
    }

    return <span className="text-sm">{String(value)}</span>;
  };

  const normalizeDateForInput = (raw: string) => {
    const s = raw.trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const weekdayFromIsoDate = (isoDate: string) => {
    if (!isoDate) return '';
    const d = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const getDisplayValueForCell = (item: ContentItem, column: string) => {
    const lower = column.trim().toLowerCase();
    if (lower === 'day of week') {
      const raw = item.fields?.['Day of Week'];
      if (typeof raw === 'string' && raw.trim()) return raw;
      const publishRaw = item.fields?.['Publish Date'];
      const publish = typeof publishRaw === 'string' ? publishRaw : publishRaw === null || publishRaw === undefined ? '' : String(publishRaw);
      const derived = weekdayFromIsoDate(normalizeDateForInput(publish));
      return derived;
    }
    const v = item.fields?.[column];
    return v;
  };

  const renderInlineEditor = (item: ContentItem, column: string) => {
    const lower = column.trim().toLowerCase();
    const common =
      'w-full bg-transparent text-sm outline-none border-0 ring-0 focus:ring-0 p-0 m-0 leading-5';
    const selectCommon =
      'w-full text-sm outline-none rounded-md border border-black/10 bg-white/70 px-2 py-1 focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:bg-black/20 dark:focus:ring-white/20';

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelCellEdit();
      }
      if (e.key === 'Enter' && !(e.shiftKey && (e.currentTarget as any).tagName === 'TEXTAREA')) {
        e.preventDefault();
        void commitCellEdit();
      }
    };

    if (lower === 'publish date') {
      return (
        <input
          autoFocus
          type="date"
          className={common}
          dir="ltr"
          value={normalizeDateForInput(cellDraftValue)}
          onChange={(e) => setCellDraftValue(e.target.value)}
          onClick={(e) => {
            const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
            el.showPicker?.();
          }}
          onFocus={(e) => {
            const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
            el.showPicker?.();
          }}
          onBlur={() => void commitCellEdit()}
          onKeyDown={onKeyDown}
        />
      );
    }

    if (lower === 'day of week') {
      const publish = typeof item.fields?.['Publish Date'] === 'string' ? String(item.fields['Publish Date']) : '';
      const derived = weekdayFromIsoDate(normalizeDateForInput(publish));
      return <span className="text-sm text-black/60 dark:text-white/60">{derived || '—'}</span>;
    }

    if (lower === 'status') {
      const statusDir = dirForValue(cellDraftValue);
      return (
        <CreatableSelect
          autoFocus
          className={selectCommon}
          value={cellDraftValue}
          options={statusOptions}
          placeholder="—"
          dir={statusDir}
          onCreateOption={(v) => ensureStatusOption(v)}
          onChange={(v) => setCellDraftValue(v)}
          onCommit={(v) => {
            ensureStatusOption(v);
            void commitCellEdit({ value: v });
          }}
          onEscape={() => cancelCellEdit()}
        />
      );
    }

    // Google-Sheets-like wrapping + auto-grow height while editing
    return (
      <textarea
        autoFocus
        ref={(el) => {
          inlineTextareaRef.current = el;
          autosizeInlineTextarea(el);
        }}
        rows={1}
        className={
          common +
          ' resize-none overflow-hidden whitespace-pre-wrap break-words'
        }
        dir={dirForValue(cellDraftValue)}
        style={{ textAlign: dirForValue(cellDraftValue) === 'rtl' ? 'right' : 'left' }}
        value={cellDraftValue}
        onChange={(e) => {
          setCellDraftValue(e.target.value);
          autosizeInlineTextarea(e.currentTarget);
        }}
        onBlur={() => void commitCellEdit()}
        onKeyDown={onKeyDown}
      />
    );
  };

  if (loading) {
    return (
      <div className="relative">
        {authModal}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <img
            src={`${basePath}/Brand_symbol_1.svg`}
            alt=""
            aria-hidden="true"
            className="absolute left-0 top-0 h-[122vh] w-auto -translate-x-[10vw] -translate-y-[10vh] select-none object-contain opacity-[0.07]"
          />
        </div>
        <div className="flex min-h-dvh flex-col">
          <div className="flex h-16 items-center justify-between border-b border-black/10 px-6 dark:border-white/10">
            <div className="flex h-10 min-w-0 flex-col justify-center">
              <div className="text-lg font-semibold leading-5">AI Marketing</div>
              <div className="text-xs text-black/60 dark:text-white/60">content calendar</div>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading content calendar...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative">
        {authModal}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <img
            src={`${basePath}/Brand_symbol_1.svg`}
            alt=""
            aria-hidden="true"
            className="absolute left-0 top-0 h-[122vh] w-auto -translate-x-[10vw] -translate-y-[10vh] select-none object-contain opacity-[0.07]"
          />
        </div>
        <div className="flex min-h-dvh flex-col">
          <div className="flex h-16 items-center justify-between border-b border-black/10 px-6 dark:border-white/10">
            <div className="flex h-10 min-w-0 flex-col justify-center">
              <div className="text-lg font-semibold leading-5">AI Marketing</div>
              <div className="text-xs text-black/60 dark:text-white/60">content calendar</div>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="text-red-600 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="space-x-4">
                <button 
                  onClick={fetchContentCalendarData}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Try Again
                </button>
                <a 
                  href="/products"
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Back to Products
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {authModal}
      {contextMenu ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0" onPointerDown={() => setContextMenu(null)} />
          <div
            ref={contextMenuRef}
            className="absolute min-w-40 rounded-lg border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-950"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu(null);
                void createNew();
              }}
            >
              New
            </button>
            <button
              type="button"
              disabled={!contextMenu.item}
              className="w-full px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!contextMenu.item) return;
                const it = contextMenu.item;
                setContextMenu(null);
                openEditor(it);
              }}
            >
              Edit
            </button>
            <button
              type="button"
              disabled={!contextMenu.item}
              className="w-full px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!contextMenu.item) return;
                void duplicateItem(contextMenu.item);
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              disabled={!contextMenu.item}
              className="w-full px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 text-red-600 dark:text-red-400 dark:hover:bg-white/5"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!contextMenu.item) return;
                const id = contextMenu.item.id;
                setContextMenu(null);
                void deleteItem(id);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}
      {isEditorOpen && selectedItem ? (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={closeEditor} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl border-l border-black/10 dark:bg-zinc-950 dark:border-white/10">
            <div className="flex h-16 items-center justify-between px-5 border-b border-black/10 dark:border-white/10">
              <div className="min-w-0">
                <div className="text-xs text-black/60 dark:text-white/60">Content Calendar</div>
                <div className="truncate text-base font-semibold">{editorFields['Title'] || 'Untitled'}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => deleteItem(selectedItem.id)}
                  className={
                    isSaving
                      ? 'rounded-lg bg-black/10 px-3 py-2 text-sm opacity-60 cursor-not-allowed dark:bg-white/10'
                      : 'rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700'
                  }
                >
                  Delete
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={closeEditor}
                  className={
                    isSaving
                      ? 'rounded-lg bg-black/10 px-3 py-2 text-sm opacity-60 cursor-not-allowed dark:bg-white/10'
                      : 'rounded-lg bg-black/10 px-3 py-2 text-sm hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20'
                  }
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={saveEditor}
                  className={
                    isSaving
                      ? 'rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white opacity-60 cursor-not-allowed'
                      : 'rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700'
                  }
                >
                  Save
                </button>
              </div>
            </div>

            <div className="cc-scroll h-[calc(100%-4rem)] overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-4">
                {orderedColumns.map((col) => {
                  const isLong = ['Caption Idea', 'CTA', '# Hashtag'].includes(col);
                  const value = editorFields[col] ?? '';
                  const lower = col.trim().toLowerCase();
                  const fieldDir = dirForValue(value);
                  const fieldAlign = fieldDir === 'rtl' ? 'text-right' : 'text-left';
                  return (
                    <div key={col}>
                      <label className="block text-xs font-medium text-black/60 dark:text-white/60">{col}</label>
                      {lower === 'publish date' ? (
                        <input
                          type="date"
                          className="mt-1 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:bg-black/20 dark:focus:ring-white/20"
                          dir="ltr"
                          value={normalizeDateForInput(value)}
                          onChange={(e) => {
                            const nextDate = e.target.value;
                            setEditorFields((p) => ({
                              ...p,
                              [col]: nextDate,
                              'Day of Week': weekdayFromIsoDate(nextDate),
                            }));
                          }}
                        />
                      ) : lower === 'status' ? (
                        <CreatableSelect
                          className="mt-1 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:bg-black/20 dark:focus:ring-white/20"
                          value={value}
                          options={statusOptions}
                          placeholder="—"
                          dir={fieldDir}
                          onCreateOption={(v) => ensureStatusOption(v)}
                          onChange={(v) => setEditorFields((p) => ({ ...p, [col]: v }))}
                        />
                      ) : lower === 'day of week' ? (
                        <input
                          readOnly
                          className="mt-1 w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                          value={value}
                        />
                      ) : isLong ? (
                        <textarea
                          rows={3}
                          className={`mt-1 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:bg-black/20 dark:focus:ring-white/20 resize-y ${fieldAlign}`}
                          dir={fieldDir}
                          value={value}
                          onChange={(e) => setEditorFields((p) => ({ ...p, [col]: e.target.value }))}
                        />
                      ) : (
                        <input
                          className={`mt-1 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:bg-black/20 dark:focus:ring-white/20 ${fieldAlign}`}
                          dir={fieldDir}
                          value={value}
                          onChange={(e) => setEditorFields((p) => ({ ...p, [col]: e.target.value }))}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <img
          src={`${basePath}/Brand_symbol_1.svg`}
          alt=""
          aria-hidden="true"
          className="absolute left-0 top-0 h-[122vh] w-auto -translate-x-[10vw] -translate-y-[10vh] select-none object-contain opacity-[0.07]"
        />
      </div>

      <div className="flex min-h-dvh flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-black/10 px-6 dark:border-white/10">
          <div className="flex h-10 min-w-0 flex-col justify-center">
            <div className="text-lg font-semibold leading-5">AI Marketing</div>
            <div className="text-xs text-black/60 dark:text-white/60">content calendar</div>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={createNew}
              disabled={isSaving}
              className={
                isSaving
                  ? 'px-3 py-1.5 text-sm bg-black/10 rounded-lg opacity-60 cursor-not-allowed dark:bg-white/10'
                  : 'px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors'
              }
            >
              New
            </button>
            <a 
              href="/products"
              className="px-3 py-1.5 text-sm bg-black/10 hover:bg-black/20 rounded-lg transition-colors dark:bg-white/10 dark:hover:bg-white/20"
            >
              Products
            </a>
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => void toggleAccount()}
                className="inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-sm bg-black/10 hover:bg-black/20 transition-colors dark:bg-white/10 dark:hover:bg-white/20"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                title={me ? me.username : 'Account'}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
              </button>

              {accountOpen ? (
                <div
                  className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-black/10 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-zinc-950"
                  role="menu"
                >
                  {accountLoading ? (
                    <div className="text-sm text-black/60 dark:text-white/60">Loading...</div>
                  ) : null}

                  {!accountLoading && me ? (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-black/10 bg-black/5 p-3 dark:border-white/10 dark:bg-white/5">
                        <div className="text-xs text-black/60 dark:text-white/60">Signed in as</div>
                        <div className="mt-1 text-sm font-medium text-black dark:text-white">{me.username}</div>
                        <div className="text-xs text-black/70 dark:text-white/70">{me.email}</div>
                      </div>

                      {accountError ? (
                        <div className="text-sm text-red-700 dark:text-red-300">{accountError}</div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => void logout()}
                        disabled={accountLoading}
                        className="w-full rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/90 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/90"
                        role="menuitem"
                      >
                        Logout
                      </button>
                    </div>
                  ) : null}

                  {!accountLoading && !me ? (
                    <div className="space-y-2">
                      {accountError ? (
                        <div className="text-sm text-red-700 dark:text-red-300">{accountError}</div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void loadMe()}
                        disabled={accountLoading}
                        className="w-full rounded-md border border-black/15 px-4 py-2 text-sm text-black hover:bg-black/5 disabled:opacity-60 dark:border-white/15 dark:text-white dark:hover:bg-white/5"
                        role="menuitem"
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountOpen(false);
                          setAuthRequired(true);
                        }}
                        className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
                        role="menuitem"
                      >
                        Sign in
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-4 px-6 py-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-white/70 border border-black/10 rounded-lg p-3 dark:bg-black/20 dark:border-white/10">
              <div className="text-xs text-black/60 dark:text-white/60">Total</div>
              <div className="text-lg font-semibold">{stats.total}</div>
            </div>
            <div className="bg-emerald-100/70 border border-emerald-900/20 rounded-lg p-3 dark:bg-emerald-900/20 dark:border-emerald-100/20">
              <div className="text-xs text-emerald-700 dark:text-emerald-300">Published</div>
              <div className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">{stats.published}</div>
            </div>
            <div className="bg-blue-100/70 border border-blue-900/20 rounded-lg p-3 dark:bg-blue-900/20 dark:border-blue-100/20">
              <div className="text-xs text-blue-700 dark:text-blue-300">Scheduled</div>
              <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">{stats.scheduled}</div>
            </div>
            <div className="bg-amber-100/70 border border-amber-900/20 rounded-lg p-3 dark:bg-amber-900/20 dark:border-amber-100/20">
              <div className="text-xs text-amber-700 dark:text-amber-300">In Progress</div>
              <div className="text-lg font-semibold text-amber-900 dark:text-amber-100">{stats.inProgress}</div>
            </div>
            <div className="bg-gray-100/70 border border-gray-900/20 rounded-lg p-3 dark:bg-gray-900/20 dark:border-gray-100/20">
              <div className="text-xs text-gray-700 dark:text-gray-300">Draft</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.draft}</div>
            </div>
            <div className="bg-purple-100/70 border border-purple-900/20 rounded-lg p-3 dark:bg-purple-900/20 dark:border-purple-100/20">
              <div className="text-xs text-purple-700 dark:text-purple-300">Est. Reach</div>
              <div className="text-lg font-semibold text-purple-900 dark:text-purple-100">{stats.totalReach.toLocaleString()}</div>
            </div>
            <div className="bg-pink-100/70 border border-pink-900/20 rounded-lg p-3 dark:bg-pink-900/20 dark:border-pink-100/20">
              <div className="text-xs text-pink-700 dark:text-pink-300">Actual Reach</div>
              <div className="text-lg font-semibold text-pink-900 dark:text-pink-100">{stats.actualReach.toLocaleString()}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title, caption, audience..."
              className="flex-1 min-w-[240px] px-3 py-1.5 text-sm bg-white/70 border border-black/10 rounded-lg dark:bg-black/20 dark:border-white/10"
            />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white/70 border border-black/10 rounded-lg dark:bg-black/20 dark:border-white/10"
            >
              <option value="all">All Status</option>
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <div className="text-sm text-black/60 dark:text-white/60">
              {filteredItems.length} of {contentItems.length} items
            </div>
          </div>

          {/* Content Table */}
          <div className="bg-white/70 border border-black/10 rounded-lg overflow-hidden dark:bg-black/20 dark:border-white/10">
            <div className="cc-scroll max-h-[calc(100dvh-330px)] overflow-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  {allColumns.map((column) => (
                    <col
                      key={column}
                      style={{ width: `${columnWidths[column] ?? defaultColWidth(column)}px` }}
                    />
                  ))}
                  <col style={{ width: '44px' }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-black/5 backdrop-blur supports-[backdrop-filter]:bg-black/5 dark:bg-white/5">
                  <tr>
                    {allColumns.map((column) => (
                      <th
                        key={column}
                        className="relative select-none px-3 py-2 text-left text-xs font-medium text-black/60 dark:text-white/60"
                      >
                        <div className="pr-3">{column}</div>
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                          onPointerDown={(e) => startResizeColumn(e, column)}
                        />
                      </th>
                    ))}
                    <th className="px-2 py-2 text-right text-xs font-medium text-black/40 dark:text-white/40"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-black/5 dark:hover:bg-white/5"
                      onDoubleClick={() => openEditor(item)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, item });
                      }}
                    >
                      {allColumns.map((column) => (
                        <td
                          key={column}
                          className={
                            (editingCell && editingCell.id === item.id && editingCell.column === column
                              ? 'align-top'
                              : 'align-top')
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            const lower = column.trim().toLowerCase();
                            if (lower === 'day of week') return;
                            beginCellEdit(item, column);
                          }}
                        >
                          <div className="px-3 py-2">
                            {editingCell && editingCell.id === item.id && editingCell.column === column
                              ? renderInlineEditor(item, column)
                              : renderCell(column, getDisplayValueForCell(item, column))}
                          </div>
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right align-top" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title="Details"
                          className="inline-flex items-center justify-center rounded-md p-1 hover:bg-black/10 dark:hover:bg-white/10"
                          onClick={() => openEditor(item)}
                        >
                          <svg className="h-4 w-4 text-black/60 dark:text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .cc-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.25) transparent;
        }
        .dark .cc-scroll {
          scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
        }
        .cc-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .cc-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.22);
          border-radius: 9999px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .dark .cc-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.18);
        }
        .cc-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}
