'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';

import { apiFetch } from '@/lib/api';
import { useProductsCache } from '../products-cache-provider';
import type { ProductsRecord } from '@/types/trainer';
import { SocialFeed } from './components/social-feed';
import { useProductFilters } from './hooks/use-product-filters';
import { useProductSelection } from './hooks/use-product-selection';
import { useProductSync } from './hooks/use-product-sync';
import { useProductMutations } from './hooks/use-product-mutations';
import { useProductDragDrop } from './hooks/use-product-drag-drop';
import { logFrontendEvent } from './lib/product-service';

import { 
  isVideoUrl, 
  formatScalar, 
  extractUrls, 
  getDriveDirectLink, 
} from './lib/product-utils';

import { 
  getTagColorStyles,
  getTagMaterialStyles
} from './lib/constants';

import { HeaderToolbar } from './components/header-toolbar';
import { LightboxViewer } from './components/lightbox-viewer';
import { FieldEditPortal } from './components/field-edit-portal';
import { LinkHoverPreview } from './components/link-hover-preview';
import { useTheme } from './hooks/use-theme';
import { useLightbox } from './hooks/use-lightbox';

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
import type { AuthMe } from './types';



import type { EditingUrlState, LinkHoverState, SwipeRefState, UserSession } from './types/shared-types';

type SelectableField = 'Category' | 'Space' | 'Color' | 'Material';
type ProductFieldOptionsResponse = {
  options?: Partial<Record<SelectableField, string[]>>;
};

const productFieldOptionsFetcher = async (url: string): Promise<ProductFieldOptionsResponse> => {
  const res = await apiFetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Request failed (${res.status})`);
  return JSON.parse(text) as ProductFieldOptionsResponse;
};

export function ProductsView({
  title = 'Products',
  titleNode,
  mobileTitleNode,
}: {
  title?: string;
  titleNode?: React.ReactNode;
  mobileTitleNode?: React.ReactNode;
}) {
  const LIST_INITIAL_RENDER_COUNT = 120;
  const GALLERY_INITIAL_RENDER_COUNT = 180;
  const LOAD_MORE_STEP = 120;

  const [showActivityLogs, setShowActivityLogs] = React.useState(false);
  React.useEffect(() => {
    (window as any)._toggleActivityLogs = () => setShowActivityLogs(v => !v);
  }, []);

  const { data, loading, error, setData, mutate } = useProductsCache();
  const { data: fieldOptionsData } = useSWR('/public/products/field-options', productFieldOptionsFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });
  const columns: string[] = data?.columns ?? [];
  const records: ProductsRecord[] = data?.records ?? [];

  const [showCommandPalette, setShowCommandPalette] = React.useState(false);
  const [familyMode, setFamilyMode] = React.useState<'collection' | 'main'>('main');
  const [maxMode, setMaxMode] = React.useState<'classic' | 'social'>('social');
  const [lightboxDetailsCollapsed, setLightboxDetailsCollapsed] = React.useState<boolean>(true);
  const [user, setUser] = React.useState<UserSession | null>(null);
  const [editingUrl, setEditingUrl] = React.useState<EditingUrlState | null>(null);
  const [linkHoverState, setLinkHoverState] = React.useState<LinkHoverState | null>(null);
  const linkHoverTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const swipeRef = React.useRef<SwipeRefState>({ pointerId: null, startX: 0, startY: 0, moved: false, swiped: false });

  // --- Specialized Hooks ---
  const { theme, toggleTheme } = useTheme();
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
    categoryFieldName, colorFieldName, spaceFieldName, materialFieldName,
    galleryItems
  } = filters;

  const {
    previewIndex, setPreviewIndex, previewId, setPreviewId,
    openPreviewByUrl, closePreview, goPrev, goNext
  } = useLightbox(galleryItems);

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
  const editableCategories = fieldOptionsData?.options?.Category ?? uniqueCategories;
  const editableColors = fieldOptionsData?.options?.Color ?? uniqueColors;
  const editableSpaces = fieldOptionsData?.options?.Space ?? uniqueSpaces;
  const editableMaterials = fieldOptionsData?.options?.Material ?? uniqueMaterials;
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

  const [renderLimit, setRenderLimit] = React.useState<number>(GALLERY_INITIAL_RENDER_COUNT);

  React.useEffect(() => {
    setRenderLimit(viewMode === 'list' ? LIST_INITIAL_RENDER_COUNT : GALLERY_INITIAL_RENDER_COUNT);
  }, [
    viewMode,
    debouncedSearch,
    selectedCategories,
    selectedColors,
    selectedSpaces,
    selectedMaterials,
    familyCollectionName,
    showSelectedOnly,
    familyMode,
  ]);

  const renderedRecords = React.useMemo(
    () => visibleRecords.slice(0, Math.max(1, renderLimit)),
    [visibleRecords, renderLimit]
  );
  const remainingRecordsCount = Math.max(0, visibleRecords.length - renderedRecords.length);

  const loadMoreRecords = React.useCallback(() => {
    setRenderLimit(prev => Math.min(prev + LOAD_MORE_STEP, visibleRecords.length));
  }, [visibleRecords.length]);







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
    const v = window.localStorage.getItem('products_view_mode');
    if (v === 'list' || v === 'gallery') setViewMode(v);
  }, []);

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
      onClick={toggleTheme}
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

  return (
    <main
      className="flex min-h-0 w-full flex-1 flex-col gap-2 text-black dark:text-white/85 sm:gap-4"
    >

      <TopProgressBar loading={loading} />
      <HeaderToolbar
        title={title}
        titleNode={titleNode}
        mobileTitleNode={mobileTitleNode}
        searchGroupNode={searchGroupNode}
        familyToggleNode={familyToggleNode}
        viewToggleNode={viewToggleNode}
        maxModeToggleNode={maxModeToggleNode}
        themeToggleNode={themeToggleNode}
        fetchUserSession={fetchUserSession}
        isAdmin={user?.is_admin}
      />

      <ProductFilters
        data={data}
        visibleCount={visibleRecords.length}
        uniqueCategories={editableCategories}
        selectedCategories={selectedCategories}
        setSelectedCategories={setSelectedCategories}
        uniqueColors={editableColors}
        selectedColors={selectedColors}
        setSelectedColors={setSelectedColors}
        uniqueSpaces={editableSpaces}
        selectedSpaces={selectedSpaces}
        setSelectedSpaces={setSelectedSpaces}
        uniqueMaterials={editableMaterials}
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
        <>
          <ListView
            loading={loading}
            records={records}
            visibleRecords={renderedRecords}
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
          {!loading && remainingRecordsCount > 0 && (
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={loadMoreRecords}
                className="rounded-full border border-black/10 bg-white px-5 py-2 text-xs font-semibold text-black/70 shadow-sm transition hover:bg-black/5 dark:border-white/15 dark:bg-black/30 dark:text-white/80 dark:hover:bg-white/10"
              >
                Load more ({remainingRecordsCount})
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-minimal w-full rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/25 animate-fade-in">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {loading && records.length === 0 ? (
              <ProductsSkeleton viewMode="gallery" />
            ) : (
              renderedRecords.map((r) => (
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

          {!loading && remainingRecordsCount > 0 && (
            <div className="mt-4 flex items-center justify-center">
              <button
                type="button"
                onClick={loadMoreRecords}
                className="rounded-full border border-black/10 bg-white px-5 py-2 text-xs font-semibold text-black/70 shadow-sm transition hover:bg-black/5 dark:border-white/15 dark:bg-black/30 dark:text-white/80 dark:hover:bg-white/10"
              >
                Load more ({remainingRecordsCount})
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
        <LightboxViewer
          currentItem={currentItem}
          galleryItems={galleryItems as any}
          currentIndex={currentIndex as number}
          selectedIds={selectedIds}
          toggleSelected={toggleSelected}
          closePreview={closePreview}
          goPrev={goPrev}
          goNext={goNext}
          swipeRef={swipeRef}
          setFamilyCollectionName={setFamilyCollectionName}
          setPreviewId={setPreviewId}
          setPreviewIndex={setPreviewIndex}
          lightboxDetailsCollapsed={lightboxDetailsCollapsed}
          setLightboxDetailsCollapsed={setLightboxDetailsCollapsed}
          currentCollectionVariants={currentCollectionVariants as any}
        />
      )}
      <LinkHoverPreview state={linkHoverState} />
      
      <FieldEditPortal
        editingUrl={editingUrl}
        setEditingUrl={setEditingUrl}
        onSave={doSaveTag}
        onCancel={doCancelTag}
        uniqueSpaces={editableSpaces}
        uniqueColors={editableColors}
        uniqueMaterials={editableMaterials}
        uniqueCategories={editableCategories}
      />
      
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

    </main>
  );
}
