'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

import { apiFetch } from '@/lib/api';
import { useProductsCache } from '../products-cache-provider';
import type { ProductsRecord } from '@/types/trainer';
import { SocialFeed } from './components/social-feed';
import type { FeedVariant } from './components/social-feed/types';
import { useProductFilters } from './hooks/use-product-filters';
import { useProductSelection } from './hooks/use-product-selection';
import { useProductSync } from './hooks/use-product-sync';
import { useProductMutations } from './hooks/use-product-mutations';
import { useProductDragDrop } from './hooks/use-product-drag-drop';

async function logFrontendEvent(action: string, details: string = '', resourceId?: string) {
  try {
    await apiFetch('/admin/log-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, details, resource_id: resourceId }),
    });
  } catch (e) {
    console.error('[Logging] Failed:', e);
  }
}



import { 
  isVideoUrl, 
  isImageUrl, 
  formatScalar, 
  extractUrls, 
  getDriveDirectLink, 
  highlightMatches, 
  formatPrice 
} from './lib/product-utils';

import { 
  getTagColorStyles,
  getTagMaterialStyles
} from './lib/constants';

import { ActivityLogModal } from './components/activity-log-modal';
import { TopProgressBar } from './components/top-progress-bar';
import { AccountMenu } from './components/account-menu';
import { ProductsSkeleton } from './components/products-skeleton';
import { ProductFilters } from './components/product-filters';
import { ProductDetailsPanel } from './components/product-details-panel';
import { SelectionBar } from './components/selection-bar';
import { CommandPalette } from './components/command-palette';
import { GalleryCard } from './components/gallery-card';
import { ListView } from './components/list-view';
import { PhotoDeck } from './components/photo-deck';
import type { AuthMe } from './types';



export function ProductsView({
  title = 'Products',
  titleNode,
  mobileTitleNode,
}: {
  title?: string;
  titleNode?: React.ReactNode;
  mobileTitleNode?: React.ReactNode;
}) {
  const [showActivityLogs, setShowActivityLogs] = React.useState(false);
  React.useEffect(() => {
    (window as any)._toggleActivityLogs = () => setShowActivityLogs(v => !v);
  }, []);

  const { data, loading, error, setData, mutate } = useProductsCache();
  const columns: string[] = data?.columns ?? [];
  const records: ProductsRecord[] = data?.records ?? [];

  const [showCommandPalette, setShowCommandPalette] = React.useState(false);
  const [familyMode, setFamilyMode] = React.useState<'collection' | 'main'>('main');
  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');
  const [previewIndex, setPreviewIndex] = React.useState<number | null>(null);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [maxMode, setMaxMode] = React.useState<'classic' | 'social'>('social');
  const [lightboxDetailsCollapsed, setLightboxDetailsCollapsed] = React.useState<boolean>(true);
  const [user, setUser] = React.useState<{ role: string; is_admin: boolean } | null>(null);
  const [editingUrl, setEditingUrl] = React.useState<{ id: string; value: string; originalValue?: string; column?: string; index?: number | null; mode?: 'replace' | 'append' | 'prepend'; rect?: { top: number; left: number; width: number; height: number } } | null>(null);
  const [linkHoverState, setLinkHoverState] = React.useState<{ url: string; x: number; y: number; title: string; code: string; variant: string } | null>(null);
  const linkHoverTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // --- Specialized Hooks ---
  const selection = useProductSelection();
  
  const filters = useProductFilters({
    records,
    columns,
    loading,
    user,
    selectedIds: selection.selectedIds,
    showSelectedOnly: selection.showSelectedOnly,
    familyCollectionName: selection.familyCollectionName,
    familyMode
  });

  const sync = useProductSync({
    debouncedSearch: filters.debouncedSearch,
    setSearch: filters.setSearch,
    setShowCommandPalette
  });

  const mutations = useProductMutations({ setData, mutate, columns });
  const dnd = useProductDragDrop({ 
    handleSaveField: mutations.handleSaveField, 
    records, 
    columns 
  });

  // Mapping hook values to original names for JSX compatibility
  const { 
    search, setSearch, debouncedSearch, sortKey, setSortKey, sortDir, setSortDir, 
    viewMode, setViewMode, selectedCategories, setSelectedCategories, 
    selectedColors, setSelectedColors, selectedSpaces, setSelectedSpaces, 
    selectedMaterials, setSelectedMaterials, activeFilterDropdown, 
    setActiveFilterDropdown, filteredRecords, sortedRecords,
    categoryFieldName, colorFieldName, spaceFieldName, materialFieldName
  } = filters;
  const { selectedIds, setSelectedIds, showSelectedOnly, setShowSelectedOnly, familyCollectionName, setFamilyCollectionName } = selection;

  const getUniqueValues = React.useCallback((fieldName: string) => {
    const vals = new Set<string>();
    records.forEach(r => {
      const v = r.fields?.[fieldName];
      if (typeof v === 'string' && v.trim()) {
        v.split(',').forEach(part => {
          const p = part.trim();
          if (p) vals.add(p);
        });
      } else if (Array.isArray(v)) {
        v.forEach(x => {
          if (typeof x === 'string' && x.trim()) {
            x.split(',').forEach(part => {
              const p = part.trim();
              if (p) vals.add(p);
            });
          }
        });
      }
    });
    return Array.from(vals).sort((a, b) => a.localeCompare(b));
  }, [records]);

  const uniqueCategories = React.useMemo(() => getUniqueValues(categoryFieldName), [getUniqueValues, categoryFieldName]);
  const uniqueColors = React.useMemo(() => getUniqueValues(colorFieldName), [getUniqueValues, colorFieldName]);
  const uniqueSpaces = React.useMemo(() => getUniqueValues(spaceFieldName), [getUniqueValues, spaceFieldName]);
  const uniqueMaterials = React.useMemo(() => getUniqueValues(materialFieldName), [getUniqueValues, materialFieldName]);
  const { recentSearches, addToRecent } = sync;
  const { isSaving } = mutations;
  const { draggedUrlInfo, setDraggedUrlInfo, activeDropTargetRef } = dnd;



  // Command Palette Esc/Enter Logic
  React.useEffect(() => {
    if (!showCommandPalette) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        setFamilyMode('collection');
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [showCommandPalette]);

  const [paletteIndex, setPaletteIndex] = React.useState(0);
  React.useEffect(() => { setPaletteIndex(0); }, [search]);

  const handleLinkMouseEnter = React.useCallback((url: string, recordId: string, e: React.MouseEvent) => {
    const { clientX: x, clientY: y } = e;
    if (linkHoverTimerRef.current) clearTimeout(linkHoverTimerRef.current);
    linkHoverTimerRef.current = setTimeout(() => {
      const record = data?.records?.find(r => r.id === recordId);
      const fields = record?.fields || {};
      const title = formatScalar(fields['Colecction Name']) || formatScalar(fields['Name']) || formatScalar(fields['Collection Name']) || '—';
      const code = formatScalar(fields['Colecction Code']) || formatScalar(fields['Code']) || '—';
      const variant = formatScalar(fields['Variant Number']) || formatScalar(fields['Num']) || '—';
      
      setLinkHoverState({ url, x, y, title, code, variant });
    }, 1000);
  }, [data?.records]);

  const handleLinkMouseLeave = React.useCallback(() => {
    if (linkHoverTimerRef.current) {
      clearTimeout(linkHoverTimerRef.current);
      linkHoverTimerRef.current = null;
    }
    setLinkHoverState(null);
  }, []);

  const handleMoveUrl = dnd.handleMoveUrl;
  const handleSaveField = (id: string, field: string, val: any) => mutations.handleSaveField(id, field, val, records);
  const handleAddMediaToVariant = (id: string, url: string) => mutations.handleAddMediaToVariant(id, url, records);
  const handleToggleMain = (id: string) => mutations.handleToggleMain(id, records);
  const handleUpdateVariant = (id: string, fields: any) => mutations.handleUpdateVariant(id, fields, records);

  const fetchUserSession = React.useCallback(async () => {
    try {
      const res = await apiFetch('/auth/me');
      if (res.ok) {
        const json = await res.json();
        setUser({
          role: json.role || 'user',
          is_admin: Boolean(json.is_admin || json.role === 'admin')
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  React.useEffect(() => {
    void fetchUserSession();
  }, [fetchUserSession]);

  const hasInitializedMain = React.useRef(false);
  React.useEffect(() => {
    if (!loading && records.length > 0 && !hasInitializedMain.current) {
      const getCollectionKey = (fields: any) => {
        return (formatScalar(fields?.['Colecction Name']) || 
                formatScalar(fields?.Name) || 
                formatScalar(fields?.['Collection Name']) || 
                '').trim();
      };
      const groupHasMain = new Set<string>();
      const seenGroups = new Set<string>();
      for (const r of records) {
        const key = getCollectionKey(r.fields);
        if (key && r.fields?.Main === true) groupHasMain.add(key);
      }
      let changed = false;
      const nextRecords = records.map(r => {
        const key = getCollectionKey(r.fields);
        if (!key) return r;
        if (groupHasMain.has(key)) {
          if (r.fields?.Main === undefined) {
             changed = true;
             return { ...r, fields: { ...r.fields, Main: false } };
          }
          return r;
        }
        if (seenGroups.has(key)) {
          changed = true;
          return { ...r, fields: { ...r.fields, Main: false } };
        }
        seenGroups.add(key);
        changed = true;
        return { ...r, fields: { ...r.fields, Main: true } };
      });
      if (changed) setData({ records: nextRecords as any, columns, count: nextRecords.length });
      hasInitializedMain.current = true;
    }
  }, [data, loading, records, setData]);

  const canEdit = user?.is_admin || user?.role === 'admin' || user?.role === 'sales';

  const handleSaveUrl = async () => {
    if (!editingUrl || isSaving) return;
    const urlFieldName = columns.find(c => c.trim().toLowerCase() === 'url') || 'URL';
    let finalValueToSave = editingUrl.value;
    if (editingUrl.column?.trim().toLowerCase() === 'video' && finalValueToSave && !isVideoUrl(finalValueToSave)) {
      finalValueToSave = finalValueToSave.trim() + '#video';
    }
    const record = records.find(r => r.id === editingUrl.id);
    if (typeof editingUrl.index === 'number' && record) {
      const urls = extractUrls(record.fields[urlFieldName]);
      if (editingUrl.index >= 0 && editingUrl.index < urls.length) {
        urls[editingUrl.index] = editingUrl.value;
        finalValueToSave = urls.join('\n');
      }
    } else if (record) {
      const currentFieldValue = String(record.fields[urlFieldName] || '').trim();
      if (editingUrl.mode === 'prepend') finalValueToSave = currentFieldValue ? (finalValueToSave + '\n' + currentFieldValue) : finalValueToSave;
      else finalValueToSave = currentFieldValue ? (currentFieldValue + '\n' + finalValueToSave) : finalValueToSave;
    }
    await mutations.handleSaveField(editingUrl.id, urlFieldName, finalValueToSave, records);
    setEditingUrl(null);
  };

  const doSaveTag = React.useCallback(() => {
    if (!editingUrl) return;
    const colName = (editingUrl.column || '').trim();
    handleSaveField(editingUrl.id, colName, editingUrl.value);
    setEditingUrl(null);
  }, [editingUrl, handleSaveField]);

  const doCancelTag = React.useCallback(() => {
    setEditingUrl(null);
  }, []);

  const displayedColumns = filters.displayedColumns;
  const visibleRecords = filters.visibleRecords;
  const baseGalleryItems = filters.baseGalleryItems;
  const allGalleryItems = filters.allGalleryItems;
  const variantCounts = filters.variantCounts;





  const galleryItems = filters.galleryItems;

  const openPreviewByUrl = React.useCallback(
    (url: string) => {
      if (!url) return;
      // Try exact match first
      let idx = galleryItems.findIndex((x: any) => x.url === url || x.originalUrl === url);
      
      // If no match, try by matching Drive IDs if applicable
      if (idx === -1 && (url.includes('drive.google.com') || url.includes('lh3.googleusercontent.com'))) {
        const inputId = getDriveDirectLink(url).match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
        if (inputId) {
          idx = galleryItems.findIndex((x: any) => x.driveId === inputId);
        }
      }

      if (idx !== -1) {
        setPreviewId(galleryItems[idx].id);
        setPreviewIndex(idx);
      }
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

  const allGalleryIdsString = React.useMemo(() => allGalleryItems.map((x: any) => x.id).join('|'), [allGalleryItems]);
  const galleryIdsString = React.useMemo(() => galleryItems.map((x: any) => x.id).join('|'), [galleryItems]);

  React.useEffect(() => {
    if (previewIndex === null) return;
    if (!previewId) return;

    const idx = galleryItems.findIndex((x: any) => x.id === previewId);
    if (idx >= 0) {
      if (idx !== previewIndex) setPreviewIndex(idx);
      return;
    }

    const prev = allGalleryItems.find((x: any) => x.id === previewId) ?? null;
    const familyKey = (prev?.collectionNameNormalized || '').trim();
    if (familyKey) {
      const mappedIdx = galleryItems.findIndex((x: any) => x.collectionNameNormalized === familyKey);
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
  }, [previewId, previewIndex, allGalleryIdsString, galleryIdsString]);

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
      const byId = new Map(baseGalleryItems.map((x: any) => [x.id, x] as const));
      const picked = [...selectedIds].map((id) => byId.get(id)).filter((x: any): x is any => !!x);
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

    logFrontendEvent('PRODUCT_DOWNLOAD', `Downloaded ${items.length} items: ${items.map((x: any) => x.code || x.title).join(', ')}`);

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
      const idx = galleryItems.findIndex((x: any) => x.id === previewId);
      return idx >= 0 ? idx : null;
    }
    if (previewIndex === null) return null;
    return previewIndex;
  }, [galleryItems, previewId, previewIndex]);

  const currentItem = React.useMemo(() => {
    if (previewId) {
      const found = galleryItems.find((x: any) => x.id === previewId);
      if (found) return found;
    }
    if (previewIndex === null) return null;
    return galleryItems[previewIndex] ?? null;
  }, [galleryItems, previewId, previewIndex]);

  const currentCollectionVariants = React.useMemo(() => {
    const key = (currentItem?.collectionNameNormalized || '').trim();
    if (!key) return [] as (typeof allGalleryItems)[number][];

    const variants = allGalleryItems.filter((x: any) => x.collectionNameNormalized === key);

    const currentId = currentItem?.id ?? null;
    if (!currentId) return variants;

    const current = variants.find((x: any) => x.id === currentId) ?? null;
    const rest = variants.filter((x: any) => x.id !== currentId);

    rest.sort((a: any, b: any) => {
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
      logFrontendEvent('PRODUCT_SHARE', `Shared ${items.length} items: ${items.map(x => x.code || x.title).join(', ')}`);
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
      // Keys that should be blocked from affecting the background
      const blockedKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
      if (blockedKeys.includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'Escape') closePreview();
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
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

  // Lock body scroll when preview is open
  React.useEffect(() => {
    if (previewIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [previewIndex]);

  React.useEffect(() => {
    window.localStorage.setItem('products_view_mode', viewMode);
  }, [viewMode]);

  const headerToggleBase =
    'inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-all active:scale-95';

  const hasActiveFilters = search.trim().length > 0 || selectedCategories.size > 0 || selectedColors.size > 0 || selectedSpaces.size > 0 || selectedMaterials.size > 0 || !!familyCollectionName;

  const searchGroupNode = (
    <div 
      className={`group flex items-center rounded-full border border-black/10 bg-white/50 shadow-sm backdrop-blur-md transition-all duration-500 ease-in-out dark:border-white/10 dark:bg-black/40 cursor-pointer ${
        hasActiveFilters ? 'pr-1' : 'pr-0'
      } ${
        // On desktop, we want to align it with the 4 items below (approx 440px)
        'min-w-[40px] sm:min-w-[440px]'
      }`}
      onClick={() => setShowCommandPalette(true)}
    >
      <div 
        className={`overflow-hidden transition-all duration-500 ease-in-out flex items-center ${
          hasActiveFilters ? 'w-10 opacity-100' : 'w-0 opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSearch('');
            setSelectedCategories(new Set());
            setSelectedColors(new Set());
            setSelectedSpaces(new Set());
            setSelectedMaterials(new Set());
            setFamilyCollectionName(null);
          }}
          title="Clear all filters & search"
          className="flex h-10 w-10 items-center justify-center text-red-600 transition-all hover:scale-110 active:scale-95 dark:text-red-400"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="flex flex-1 items-center gap-3 px-3">
        <svg viewBox="0 0 24 24" className={`h-5 w-5 transition-all active:scale-95 ${
          showCommandPalette 
            ? 'text-emerald-600 dark:text-emerald-400' 
            : 'text-black/40 dark:text-white/40 group-hover:text-black dark:group-hover:text-white'
        }`} fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="hidden sm:block text-xs font-medium text-black/30 dark:text-white/30 group-hover:text-black/60 dark:group-hover:text-white/60 transition-colors">
          Search products, codes, collections...
        </span>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-black/5 dark:bg-white/5 px-2 py-1 text-[9px] font-black text-black/20 dark:text-white/20 uppercase mr-1 group-hover:text-black/40 dark:group-hover:text-white/40 ring-1 ring-black/5 dark:ring-white/5 transition-all">
        Cmd + K
      </div>
    </div>
  );

  const viewToggleNode = (
    <button
      type="button"
      onClick={() => setViewMode((v) => (v === 'list' ? 'gallery' : 'list'))}
      aria-pressed={viewMode === 'list'}
      title={viewMode === 'list' ? 'Switch to Gallery View' : 'Switch to List View'}
      className={
        headerToggleBase +
        (viewMode === 'list'
          ? ' border-emerald-500/20 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400'
          : ' border-black/10 bg-white/50 text-black/60 hover:bg-white/80 hover:text-black dark:border-white/10 dark:bg-black/40 dark:text-white/60 dark:hover:bg-black/60 dark:hover:text-white')
      }
    >
      {viewMode === 'gallery' ? (
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
      aria-pressed={familyMode === 'collection'}
      title={familyMode === 'collection' ? 'Collection View' : 'All Products'}
      className={
        headerToggleBase +
        (familyMode === 'collection'
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
        ' border-black/10 bg-white/50 text-black/60 hover:bg-white/80 hover:text-black dark:border-white/10 dark:bg-black/40 dark:text-white/60 dark:hover:bg-black/60 dark:hover:text-white'
      }
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" fill="white" stroke="white" />
          <line x1="12" y1="1" x2="12" y2="3" stroke="white" />
          <line x1="12" y1="21" x2="12" y2="23" stroke="white" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="white" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="white" />
          <line x1="1" y1="12" x2="3" y2="12" stroke="white" />
          <line x1="21" y1="12" x2="23" y2="12" stroke="white" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="white" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="white" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="black" />
        </svg>
      )}
    </button>
  );

  const maxModeToggleNode = (
    <button
      type="button"
      onClick={() => setMaxMode((m) => (m === 'classic' ? 'social' : 'classic'))}
      aria-pressed={maxMode === 'social'}
      title={maxMode === 'social' ? 'Switch to Classic Lightbox' : 'Switch to Social Feed'}
      className={
        headerToggleBase +
        (maxMode === 'social'
          ? ' border-emerald-500/20 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400'
          : ' border-black/10 bg-white/50 text-black/60 hover:bg-white/80 hover:text-black dark:border-white/10 dark:bg-black/40 dark:text-white/60 dark:hover:bg-black/60 dark:hover:text-white')
      }
    >
      {maxMode === 'social' ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      )}
    </button>
  );

  // Portal dropdown for Space/Color/Material/Category editing
  const fieldEditPortal = React.useMemo(() => {
    if (typeof document === 'undefined') return null;
    if (!editingUrl?.rect) return null;

    const colName = (editingUrl.column || '').trim().toLowerCase();
    const isSpace = colName === 'space';
    const isCategory = colName === 'category';
    const isColor = colName === 'color';
    const isMaterial = colName === 'material';
    if (!isSpace && !isCategory && !isColor && !isMaterial) return null;

    const { top, left, width, height } = editingUrl.rect;
    const isCheckbox = isSpace || isCategory || isColor || isMaterial;
    const POPUP_W = 260;
    const POPUP_H = isSpace || isCategory ? 430 : 260;
    const spaceBelow = window.innerHeight - (top + height);
    const spaceRight = window.innerWidth - left;
    const popupLeft = spaceRight >= POPUP_W ? left : Math.max(8, left + width - POPUP_W);
    const popupTop = spaceBelow >= POPUP_H ? top + height + 4 : Math.max(8, top - POPUP_H - 4);

    const currentSet = new Set((editingUrl.value || '').split(',').map(s => s.trim()).filter(Boolean));
    const col = colName;
    const column = editingUrl.column || '';
    const recordId = editingUrl.id;
    const originalValue = editingUrl.originalValue ?? '';

    const portal = (
      <>
        {/* Backdrop — click outside saves */}
        <div
          className="fixed inset-0 z-[998]"
          onClick={doSaveTag}
          onKeyDown={(e) => { 
            if (e.key === 'Escape') { e.preventDefault(); doCancelTag(); }
            else if (e.key === 'Enter') { e.preventDefault(); doSaveTag(); }
          }}
          tabIndex={-1}
        />
        {/* Dropdown */}
        <div
          ref={(el) => { if (el) el.focus(); }}
          className="fixed z-[999] flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900 outline-none"
          style={{ top: popupTop, left: popupLeft, width: POPUP_W }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          tabIndex={0}
          onKeyDown={(e) => { 
            if (e.key === 'Escape') { e.preventDefault(); doCancelTag(); }
            else if (e.key === 'Enter') { e.preventDefault(); doSaveTag(); }
          }}
        >
          {(isSpace || isCategory || isColor || isMaterial) ? (
            <>
              <div className="scrollbar-minimal overflow-y-auto p-2" style={{ maxHeight: 320 }}>
                <div className="grid grid-cols-1 gap-1.5">
                  {(isSpace ? uniqueSpaces : isColor ? uniqueColors : isMaterial ? uniqueMaterials : uniqueCategories).map(opt => {
                    const sel = currentSet.has(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const next = new Set(currentSet);
                          if (sel) next.delete(opt); else next.add(opt);
                          setEditingUrl({ ...editingUrl, value: Array.from(next).join(', ') });
                        }}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[12px] font-medium transition-all ${
                          sel
                            ? isColor 
                              ? `${getTagColorStyles(opt)} shadow-sm border` 
                              : isMaterial
                                ? `${getTagMaterialStyles(opt)} shadow-sm border`
                                : 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-black/[0.03] text-black/75 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-white/5 dark:text-white/75 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300'
                        }`}
                      >
                        <span className={`flex h-4 w-4 flex-none items-center justify-center transition-all rounded border-2 ${
                          sel ? 'border-white/60 bg-white/25' : 'border-black/20 dark:border-white/25'
                        }`}>
                          {sel && <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </>
    );

    return createPortal(portal, document.body);
  }, [editingUrl, isSaving, uniqueSpaces, uniqueColors, uniqueMaterials, uniqueCategories, doSaveTag, doCancelTag]);

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
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
      <TopProgressBar loading={loading} />
      <div className="sticky top-0 z-40 -mx-5 px-5 py-2 border-b border-black/10 bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-black/80">
        <div className="flex w-full items-center justify-between gap-2 sm:hidden">
          {mobileTitleNode ?? <h1 className="min-w-0 flex-none truncate text-lg font-semibold">{title}</h1>}
          <div className="flex flex-none items-center gap-2">
            {searchGroupNode}
            {familyToggleNode}
            {viewToggleNode}
            {maxModeToggleNode}
            {themeToggleNode}
            <AccountMenu onAuthChange={fetchUserSession} />
          </div>
        </div>

        <div className="hidden w-full sm:flex sm:items-center sm:justify-between">
          <div>
            {titleNode ?? <h1 className="text-2xl font-semibold">{title}</h1>}
            <p className="mt-1 text-sm text-black/60 dark:text-white/55"></p>
          </div>

          <div className="flex items-center gap-2">
            {searchGroupNode}
            <div className="flex items-center gap-2 ml-2">
              {familyToggleNode}
              {viewToggleNode}
              {maxModeToggleNode}
              {themeToggleNode}
              <AccountMenu onAuthChange={fetchUserSession} />
            </div>
          </div>
        </div>
      </div>

      <ProductFilters
        data={data}
        visibleCount={visibleRecords.length}
        uniqueCategories={uniqueCategories}
        selectedCategories={selectedCategories}
        setSelectedCategories={setSelectedCategories}
        uniqueColors={uniqueColors}
        selectedColors={selectedColors}
        setSelectedColors={setSelectedColors}
        uniqueSpaces={uniqueSpaces}
        selectedSpaces={selectedSpaces}
        setSelectedSpaces={setSelectedSpaces}
        uniqueMaterials={uniqueMaterials}
        selectedMaterials={selectedMaterials}
        setSelectedMaterials={setSelectedMaterials}
        activeFilterDropdown={activeFilterDropdown}
        setActiveFilterDropdown={setActiveFilterDropdown}
      />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {viewMode === 'list' ? (
        <ListView
          loading={loading}
          records={records}
          visibleRecords={visibleRecords}
          displayedColumns={displayedColumns}
          selectedIds={selectedIds}
          toggleSelected={toggleSelected}
          toggleSort={toggleSort}
          sortKey={sortKey}
          sortDir={sortDir}
          openPreviewByUrl={openPreviewByUrl}
          setEditingUrl={setEditingUrl}
          handleMoveUrl={handleMoveUrl}
          draggedUrlInfo={draggedUrlInfo}
          setDraggedUrlInfo={setDraggedUrlInfo}
          activeDropTargetRef={activeDropTargetRef}
          linkHoverTimerRef={linkHoverTimerRef}
          familyMode={familyMode}
          variantCounts={variantCounts}
          search={search}
          setLinkHoverState={setLinkHoverState}
          canEdit={canEdit}
          handleSaveUrl={handleSaveUrl}
          editingUrl={editingUrl}
          isSaving={isSaving}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-minimal w-full rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/25 animate-fade-in">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {loading && records.length === 0 ? (
              <ProductsSkeleton viewMode="gallery" />
            ) : (
              visibleRecords.map((r) => (
                <GalleryCard
                  key={r.id}
                  record={r}
                  search={search}
                  selectedIds={selectedIds}
                  toggleSelected={toggleSelected}
                  openPreviewByUrl={openPreviewByUrl}
                  familyMode={familyMode}
                  variantCounts={variantCounts}
                />
              ))
            )}
          </div>

          {!loading && visibleRecords.length === 0 && (
            <div className="col-span-full py-40 flex flex-col items-center justify-center animate-fade-in text-center px-6">
               <div className="h-24 w-24 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/5 flex mb-8 text-black/10 dark:text-white/10 ring-8 ring-zinc-50 dark:ring-white/5">
                  <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
               </div>
               <h3 className="text-2xl font-black text-black dark:text-white tracking-tight">Product Not Found</h3>
               <p className="mt-2 text-zinc-500 max-w-[280px]">We couldn't find any items matching your specific search or filters.</p>
               <button 
                 onClick={() => { setSearch(''); setSelectedCategories(new Set()); setSelectedColors(new Set()); setSelectedSpaces(new Set()); setSelectedMaterials(new Set()); }}
                 className="mt-10 rounded-full bg-zinc-950 px-10 py-3.5 text-sm font-black text-white hover:bg-black shadow-2xl dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-all active:scale-95 uppercase tracking-widest"
               >
                 Reset All
               </button>
            </div>
          )}
        </div>
      )}

      {selectedCount > 0 && !currentItem ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <div className="mx-auto max-w-xl">
            <SelectionBar
              selectedCount={selectedCount}
              onClear={() => setSelectedIds(new Set())}
              onDownload={() => void downloadSelected()}
              onShare={() => void shareSelected()}
              onToggleView={() => {
                if (familyCollectionName) {
                  setFamilyCollectionName(null);
                  return;
                }
                setShowSelectedOnly((v) => !v);
              }}
              viewLabel={familyCollectionName ? 'ALL' : showSelectedOnly ? 'ALL' : 'Selected'}
              isViewActive={Boolean(familyCollectionName || showSelectedOnly)}
            />
          </div>
        </div>
      ) : null}

      {currentItem?.url && maxMode === 'social' && (
        <SocialFeed
          variants={galleryItems as any}
          initialVariantId={previewId}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelected}
          onClose={closePreview}
          onFilterCollection={(name) => {
            setFamilyCollectionName(name);
            logFrontendEvent('COLLECTION_VIEW_SOCIAL', name ? `Switched to collection: ${name}` : 'Cleared collection filter');
          }}
          activeCollectionName={familyCollectionName}
          selectedCount={selectedIds.size}
          canEdit={canEdit}
          onAddMedia={handleAddMediaToVariant}
          onUpdateVariant={handleUpdateVariant}
        />
      )}

      {currentItem?.url && maxMode === 'classic' && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-white/85 backdrop-blur-[2px] p-4 text-black dark:bg-black/85 dark:text-white"
          role="dialog"
          aria-modal="true"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) closePreview();
          }}
        >
          {/* Top Controls */}
          <div className="fixed left-3 top-3 z-[1010] flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/70 text-black/80 shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/35 dark:text-white/85 transition-colors hover:bg-white dark:hover:bg-black/50"
              onClick={(e) => {
                e.stopPropagation();
                closePreview();
              }}
              title="Close"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>

            <div className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-semibold text-black/80 backdrop-blur-md dark:border-white/10 dark:bg-black/35 dark:text-white/85">
              {(typeof currentIndex === 'number' ? currentIndex + 1 : 1)} / {galleryItems.length}
            </div>
          </div>

          {/* Selection Status */}
          {selectedIds.has(currentItem.id) && (
            <div
              className="fixed right-3 top-3 z-[1010] inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300/70 bg-emerald-500/15 text-emerald-700 shadow-lg backdrop-blur dark:border-emerald-200/60 dark:bg-emerald-500/20 dark:text-emerald-50 animate-fade-in"
              onPointerDown={(e) => e.stopPropagation()}
              title="Selected"
              aria-label="Selected"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          {/* Media Container */}
          <div
            className="relative flex items-center justify-center overflow-hidden"
            style={{ transform: 'translateY(-15%)' }}
            onPointerDown={(e) => {
              const isIframe = (e.target as HTMLElement).tagName === 'IFRAME';
              if (isIframe) return; // Don't intercept pointer on iframe
              
              e.stopPropagation();
              if (galleryItems.length <= 1) return;
              swipeRef.current.pointerId = e.pointerId;
              swipeRef.current.startX = e.clientX;
              swipeRef.current.startY = e.clientY;
              swipeRef.current.moved = false;
              swipeRef.current.swiped = false;
              try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
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
              if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 40) {
                swipeRef.current.swiped = true;
                if (dx < 0) goNext(); else goPrev();
              }
            }}
            onPointerUp={(e) => { if (swipeRef.current.pointerId === e.pointerId) swipeRef.current.pointerId = null; }}
          >
            {isVideoUrl(currentItem.originalUrl) ? (
              currentItem.driveId ? (
                <div className="relative h-[80vh] w-[90vw] max-w-4xl overflow-hidden rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 shadow-2xl transition-all">
                  <iframe
                    src={`https://drive.google.com/file/d/${currentItem.driveId}/preview`}
                    className="absolute inset-0 h-full w-full border-0"
                    allow="autoplay"
                    allowFullScreen
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {/* Invisible swipe bumper to allow gallery nav even if iframe is focused */}
                  <div className="absolute inset-y-0 left-0 w-8 z-10 pointer-events-none" />
                  <div className="absolute inset-y-0 right-0 w-8 z-10 pointer-events-none" />
                </div>
              ) : (
                <video
                  src={currentItem.originalUrl}
                  controls
                  autoPlay
                  className="max-h-[85vh] w-auto max-w-[95vw] rounded-xl shadow-2xl"
                  onPointerDown={(e) => e.stopPropagation()}
                />
              )
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={getDriveDirectLink(currentItem.url)}
                alt={currentItem.title}
                className="max-h-[85vh] w-auto max-w-[95vw] select-none object-contain shadow-2xl transition-transform duration-300"
                draggable={false}
                style={{ touchAction: 'pan-y' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (swipeRef.current.swiped) return;
                  if (e.shiftKey || e.pointerType === 'mouse') {
                    toggleSelected(currentItem.id);
                  }
                }}
              />
            )}
          </div>

          {/* Navigation Arrows */}
          {galleryItems.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                onPointerDown={(e) => e.stopPropagation()}
                className="fixed left-0 top-0 flex h-full w-[60px] items-center justify-center bg-transparent group"
                aria-label="Previous"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white/55 text-lg font-semibold text-black shadow-sm backdrop-blur transition-all group-hover:bg-white dark:border-white/15 dark:bg-black/20 dark:text-white dark:group-hover:bg-black/40">
                  ‹
                </span>
              </button>
              <button
                type="button"
                onClick={goNext}
                onPointerDown={(e) => e.stopPropagation()}
                className="fixed right-0 top-0 flex h-full w-[60px] items-center justify-center bg-transparent group"
                aria-label="Next"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white/55 text-lg font-semibold text-black shadow-sm backdrop-blur transition-all group-hover:bg-white dark:border-white/15 dark:bg-black/20 dark:text-white dark:group-hover:bg-black/40">
                  ›
                </span>
              </button>
            </>
          )}

          <ProductDetailsPanel
            currentItem={currentItem}
            currentCollectionVariants={currentCollectionVariants}
            selectedIds={selectedIds}
            toggleSelected={toggleSelected}
            setFamilyCollectionName={setFamilyCollectionName}
            setPreviewId={setPreviewId}
            setPreviewIndex={setPreviewIndex}
            lightboxDetailsCollapsed={lightboxDetailsCollapsed}
            setLightboxDetailsCollapsed={setLightboxDetailsCollapsed}
          />

          {/* Lightbox Selection Bar */}
          <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5" onPointerDown={(e) => e.stopPropagation()}>
            <div className="mx-auto max-w-xl">
              <SelectionBar
                selectedCount={selectedCount}
                onClear={() => setSelectedIds(new Set())}
                onDownload={() => void downloadSelected()}
                onShare={() => void shareSelected()}
                onToggleView={() => {
                  const key = (currentItem?.collectionNameNormalized || '').trim();
                  if (familyCollectionName) setFamilyCollectionName(null);
                  else if (key) setFamilyCollectionName(key);
                }}
                viewLabel={familyCollectionName ? 'ALL' : 'Collection'}
                isViewActive={Boolean(familyCollectionName)}
                theme="dark"
              />
            </div>
          </div>
        </div>
      )}
      {linkHoverState && (
        <div 
          className="fixed z-[2000] pointer-events-none animate-fade-in"
          style={{ 
            left: Math.min(linkHoverState.x + 20, window.innerWidth - 225), 
            top: Math.min(linkHoverState.y + 20, window.innerHeight - 245) 
          }}
        >
          <div className="overflow-hidden rounded-xl border border-black/10 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/20 dark:bg-black/85">
            <div className="relative h-[200px] w-[200px] overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">
              {isVideoUrl(linkHoverState.url) ? (
                <div className="flex h-full w-full items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getDriveDirectLink(linkHoverState.url)} alt="Video Preview" className="h-full w-full object-cover opacity-50" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/30 backdrop-blur-md border border-white/50">
                      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img 
                  src={getDriveDirectLink(linkHoverState.url)} 
                  alt="Preview" 
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = linkHoverState.url;
                  }}
                />
              )}
            </div>
            <div className="mt-1.5 px-1.5 pb-1">
              <div className="truncate text-[11px] font-bold text-black/80 dark:text-white/90">
                {linkHoverState.title}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50 uppercase tracking-tighter">
                  Code: {linkHoverState.code}
                </span>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 uppercase tracking-tighter">
                  Var: {linkHoverState.variant}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      {fieldEditPortal}
      
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        search={search}
        setSearch={setSearch}
        paletteIndex={paletteIndex}
        setPaletteIndex={setPaletteIndex}
        recentSearches={recentSearches}
        addToRecent={addToRecent}
        filteredRecords={filteredRecords}
        sortedRecords={sortedRecords}
        setPreviewId={setPreviewId}
        setPreviewIndex={setPreviewIndex}
      />

      <ActivityLogModal isOpen={showActivityLogs} onClose={() => setShowActivityLogs(false)} />
      <style dangerouslySetInnerHTML={{ __html: `
        .dnd-active {
          background-color: rgb(16 185 129 / 0.2) !important;
          box-shadow: inset 0 0 15px rgba(16, 185, 129, 0.1) !important;
          outline: 2px solid rgb(16 185 129) !important;
          outline-offset: -2px;
          z-index: 50 !important;
        }
      `}} />
    </main>
  );
}
