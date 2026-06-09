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
  collectNumOnlyStubIds,
  findUrlFieldName,
  resolveMediaFieldNames,
  collectMergedProductMediaUrls,
  applyMediaListChange,
  buildFieldsAfterReplacingMediaUrl,
  buildFieldsAfterHidingGalleryMedia,
  buildFieldsAfterUnhidingGalleryMedia,
  sameProductMediaUrl,
  getCollectionKey,
  resolveCollectionName,
  resolveCollectionCode,
  findMainGalleryItemForCollection,
  scrollElementIntoContainer,
  scrollRowToViewportOffset,
  getFirstVisibleListRecordId,
} from './lib/product-utils';
import { isScrollContainerNearEnd } from './lib/load-more-scroll';
import { invalidateMediaPreviewForUrl } from './lib/media-preview-cache';

import { 
  getTagColorStyles,
  getTagMaterialStyles,
  canEditProductField,
} from './lib/constants';

import { HeaderToolbar } from './components/header-toolbar';
import { ProductsHeaderSearch } from './components/products-header-search';
import { LightboxViewer } from './components/lightbox-viewer';
import { FieldEditPortal } from './components/field-edit-portal';
import { LinkHoverPreview } from './components/link-hover-preview';
import { useTheme } from './hooks/use-theme';
import { useLightbox } from './hooks/use-lightbox';
import { markLightboxTrace } from './lib/lightbox-perf';

import { ActivityLogModal } from './components/activity-log-modal';
import { TopProgressBar } from './components/top-progress-bar';
import { AccountMenu } from './components/account-menu';
import { ProductFilters } from './components/product-filters';
import { ProductsExcelExport } from './components/products-excel-export';
import { ProductDetailsPanel } from './components/product-details-panel';
import { SelectionBar } from './components/selection-bar';
import { GalleryCard } from './components/gallery-card';
import { ListView } from './components/list-view';
import { PwaInstallFab } from './components/pwa-install-fab';
import {
  LoadMoreFloatingIndicator,
  LoadMoreScrollSentinel,
} from './components/load-more-floating-indicator';
import { useFieldChangeAudit, type ChangeSourceFilter } from './hooks/use-field-change-audit';
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
  /** Smaller batches + infinite scroll reduce main-thread spikes when many rows exist. */
  const LIST_INITIAL_RENDER_COUNT = 72;
  const GALLERY_INITIAL_RENDER_COUNT = 120;
  const LOAD_MORE_STEP = 96;

  const [showActivityLogs, setShowActivityLogs] = React.useState(false);
  const toggleActivityLogs = React.useCallback(() => {
    setShowActivityLogs((v) => !v);
  }, []);

  const {
    data,
    loading,
    error,
    isStaleOfflineSnapshot,
    setData,
    mutate,
    notePendingDelete,
    clearPendingDelete,
    clearPendingDeletes,
    applyCacheUpdate,
    commitOptimisticSnapshot,
  } = useProductsCache();
  const { data: fieldOptionsData } = useSWR('/public/products/field-options', productFieldOptionsFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });
  const columns: string[] = data?.columns ?? [];
  const records: ProductsRecord[] = data?.records ?? [];

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
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

  useProductSync({
    debouncedSearch: filters.debouncedSearch,
    setSearch: filters.setSearch,
    searchInputRef,
  });

  const canEditFieldForUser = React.useCallback(
    (fieldName: string) => canEditProductField(user, fieldName),
    [user],
  );

  const mutations = useProductMutations({
    applyCacheUpdate,
    commitOptimisticSnapshot,
    mutate,
    notePendingDelete,
    clearPendingDelete,
    clearPendingDeletes,
    columns,
    canEditField: canEditFieldForUser,
  });
  const dnd = useProductDragDrop({
    applyCacheUpdate,
    handleSaveField: mutations.handleSaveField,
    handleSaveFields: mutations.handleSaveFields,
    records,
    columns,
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

  const listScrollRef = React.useRef<HTMLDivElement>(null);
  const galleryScrollRef = React.useRef<HTMLDivElement>(null);
  /** Last product id shown in feed/lightbox — survives close for list scroll restore. */
  const feedViewedRecordIdRef = React.useRef<string | null>(null);
  const [scrollTargetRecordId, setScrollTargetRecordId] = React.useState<string | null>(null);
  /** Wait for debouncedSearch to clear before scrolling (filter × / Reset All). */
  const pendingFilterClearScrollRef = React.useRef(false);
  /** Viewport offset of anchor row before filters clear — keeps the row in the same spot. */
  const scrollAnchorViewportTopRef = React.useRef<number | null>(null);
  /** After scroll restore completes, skip the next list reset (prevents jump to top). */
  const suppressListLayoutResetRef = React.useRef(false);

  const {
    previewIndex, setPreviewIndex, previewId, setPreviewId,
    openPreviewByUrl, closePreview, goPrev, goNext
  } = useLightbox(galleryItems);

  React.useEffect(() => {
    if (previewId) feedViewedRecordIdRef.current = previewId;
  }, [previewId]);

  const { selectedIds, setSelectedIds, showSelectedOnly, setShowSelectedOnly, familyCollectionName, setFamilyCollectionName } = selection;

  const { uniqueCategories, uniqueColors, uniqueSpaces, uniqueMaterials } = React.useMemo(() => {
    const addCommaParts = (v: unknown, target: Set<string>) => {
      if (typeof v === 'string' && v.trim()) {
        for (const part of v.split(',')) {
          const p = part.trim();
          if (p) target.add(p);
        }
      } else if (Array.isArray(v)) {
        for (const x of v) addCommaParts(x, target);
      }
    };
    const cats = new Set<string>();
    const colors = new Set<string>();
    const spaces = new Set<string>();
    const materials = new Set<string>();
    for (const r of records) {
      addCommaParts(r.fields?.[categoryFieldName], cats);
      addCommaParts(r.fields?.[colorFieldName], colors);
      addCommaParts(r.fields?.[spaceFieldName], spaces);
      addCommaParts(r.fields?.[materialFieldName], materials);
    }
    const sortVals = (s: Set<string>) => Array.from(s).sort((a, b) => a.localeCompare(b));
    return {
      uniqueCategories: sortVals(cats),
      uniqueColors: sortVals(colors),
      uniqueSpaces: sortVals(spaces),
      uniqueMaterials: sortVals(materials),
    };
  }, [records, categoryFieldName, colorFieldName, materialFieldName, spaceFieldName]);
  const editableCategories = fieldOptionsData?.options?.Category ?? uniqueCategories;
  const editableColors = fieldOptionsData?.options?.Color ?? uniqueColors;
  const editableSpaces = fieldOptionsData?.options?.Space ?? uniqueSpaces;
  const editableMaterials = fieldOptionsData?.options?.Material ?? uniqueMaterials;
  const { isSaving } = mutations;
  const { draggedUrlInfo, setDraggedUrlInfo, activeDropTargetRef } = dnd;



  const handleLinkMouseEnter = React.useCallback((url: string, recordId: string, e: React.MouseEvent) => {
    const { clientX: x, clientY: y } = e;
    if (linkHoverTimerRef.current) clearTimeout(linkHoverTimerRef.current);
    linkHoverTimerRef.current = setTimeout(() => {
      const record = data?.records?.find(r => r.id === recordId);
      const fields = record?.fields || {};
      const title = resolveCollectionName(fields) || '—';
      const code = resolveCollectionCode(fields) || '—';
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

  const preserveRowAfterEdit = React.useCallback((recordId: string) => {
    suppressListLayoutResetRef.current = true;
    setScrollTargetRecordId(recordId);
  }, []);

  const handleMoveUrl = React.useCallback(
    async (url: string, fromId: string, toId: string, targetCol?: string) => {
      preserveRowAfterEdit(fromId);
      try {
        await dnd.handleMoveUrl(url, fromId, toId, targetCol);
      } catch {
        window.alert('Could not move link. Please try again.');
      }
    },
    [dnd.handleMoveUrl, preserveRowAfterEdit],
  );

  const handleReorderUrls = React.useCallback(
    async (recordId: string, fromIndex: number, toIndex: number) => {
      preserveRowAfterEdit(recordId);
      try {
        await dnd.handleReorderUrls(recordId, fromIndex, toIndex);
      } catch (err) {
        window.alert('Could not reorder links. Please try again.');
        throw err;
      }
    },
    [dnd.handleReorderUrls, preserveRowAfterEdit],
  );
  const handleSaveField = (id: string, field: string, val: any) => mutations.handleSaveField(id, field, val, records);
  const handleAddMediaToVariant = (id: string, url: string) => mutations.handleAddMediaToVariant(id, url, records);
  const handleToggleMain = (id: string) => mutations.handleToggleMain(id, records);
  const handleUpdateVariant = (id: string, fields: any) => mutations.handleUpdateVariant(id, fields, records);
  /**
   * List clicks must open by record id first (not URL-only) to avoid jumping to
   * a different product when multiple rows share/rewrite similar media links.
   */
  const openPreviewByRecordOrUrl = React.useCallback(
    (url: string, recordId?: string) => {
      if (recordId) {
        const idx = galleryItems.findIndex((item) => item.id === recordId);
        if (idx >= 0) {
          markLightboxTrace('click:record-open');
          setPreviewIndex(idx);
          setPreviewId(recordId);
          return;
        }
      }
      openPreviewByUrl(url);
    },
    [galleryItems, openPreviewByUrl, setPreviewId, setPreviewIndex],
  );
  const handleDeleteProduct = (id: string) => {
    const record = records.find(r => r.id === id);
    const titleText = resolveCollectionName(record?.fields) || id;
    const ok = window.confirm(`Delete this product row?\n\n${titleText}`);
    if (!ok) return;
    void mutations.handleDeleteProduct(id, records);
  };

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
      if (changed) {
        void applyCacheUpdate((prev) => ({
          ...prev,
          records: nextRecords,
          columns,
          count: nextRecords.length,
        }));
      }
      hasInitializedMain.current = true;
    }
  }, [data, loading, records, applyCacheUpdate, columns]);

  const canEdit = user?.is_admin || user?.role === 'admin' || user?.role === 'sales';
  /** Row delete and bulk purge: admin role only (not sales or other roles). */
  const canDelete = user?.role === 'admin';
  /** Moderation audit UI: platform admin only (not sales or role-based admin without is_admin). */
  const isAdminModerator = user?.is_admin === true;
  const [moderationMode, setModerationMode] = React.useState(false);
  const [moderationEditorFilter, setModerationEditorFilter] = React.useState('');
  const [moderationSourceFilter, setModerationSourceFilter] = React.useState<ChangeSourceFilter>('all');
  const changeAudit = useFieldChangeAudit(
    isAdminModerator && moderationMode,
    moderationEditorFilter || null,
    moderationSourceFilter,
  );

  React.useEffect(() => {
    if (!isAdminModerator) {
      setModerationMode(false);
      setModerationEditorFilter('');
      setModerationSourceFilter('all');
    }
  }, [isAdminModerator]);

  React.useEffect(() => {
    if (!moderationMode) {
      setModerationEditorFilter('');
      setModerationSourceFilter('all');
    }
  }, [moderationMode]);

  const handleBulkDeleteNumOnlyStubs = React.useCallback(() => {
    if (!canDelete || mutations.isSaving) return;
    const ids = collectNumOnlyStubIds(records, columns);
    if (ids.length === 0) {
      window.alert('No rows with only the Num field filled (all other fields empty) were found in the loaded list.');
      return;
    }
    const ok = window.confirm(
      `Delete ${ids.length} row(s) where only Num is filled from the server?\n\n` +
        '(Rows with any other field filled—including a single character or image—will not be deleted.)'
    );
    if (!ok) return;
    void mutations.handleBulkDeleteProducts(ids).catch(() => {
      window.alert('Bulk delete failed. Refresh the page to sync the list if needed.');
    });
  }, [canDelete, columns, mutations, records]);

  const mediaFieldNames = React.useMemo(() => resolveMediaFieldNames(columns), [columns]);

  /** Hide from Image / Feed only; URL column keeps the link for recovery. */
  const handleHideMediaFromGallery = React.useCallback(
    async (recordId: string, urlToHide: string) => {
      if (!urlToHide.trim() || mutations.isSaving) return;
      const record = records.find(r => r.id === recordId);
      if (!record) return;
      const patch = buildFieldsAfterHidingGalleryMedia(record.fields, urlToHide, columns);
      if (Object.keys(patch).length === 0) return;
      try {
        await mutations.handleSaveFields(recordId, patch, records);
      } catch {
        window.alert('Could not hide image from gallery. Please try again.');
      }
    },
    [records, columns, mutations],
  );

  const handleUnhideMediaFromGallery = React.useCallback(
    async (recordId: string, urlToShow: string) => {
      if (!urlToShow.trim() || mutations.isSaving) return;
      const record = records.find(r => r.id === recordId);
      if (!record) return;
      const patch = buildFieldsAfterUnhidingGalleryMedia(record.fields, urlToShow, columns);
      if (Object.keys(patch).length === 0) return;
      try {
        await mutations.handleSaveFields(recordId, patch, records);
      } catch {
        window.alert('Could not restore image in gallery. Please try again.');
      }
    },
    [records, columns, mutations],
  );

  /** URL column ✕: hide from Image/Feed only — never remove links from the URL field. */
  const handleRemoveUrl = React.useCallback(
    async (recordId: string, urlToRemove: string) => {
      await handleHideMediaFromGallery(recordId, urlToRemove);
    },
    [handleHideMediaFromGallery],
  );

  /** Force fresh previews after URL field edits (pairs with fingerprinted cache keys). */
  const bumpMediaPreviewCache = React.useCallback((...urls: Array<string | undefined>) => {
    for (const u of urls) {
      if (u?.trim()) invalidateMediaPreviewForUrl(u);
    }
  }, []);

  const handleSaveUrl = async () => {
    if (!editingUrl || mutations.isSaving) return;
    const savedRecordId = editingUrl.id;
    const urlFieldName = findUrlFieldName(columns);
    let finalValueToSave = editingUrl.value;
    if (editingUrl.column?.trim().toLowerCase() === 'video' && finalValueToSave && !isVideoUrl(finalValueToSave)) {
      finalValueToSave = finalValueToSave.trim() + '#video';
    }
    const record = records.find(r => r.id === editingUrl.id);
    if (!record) return;

    if (typeof editingUrl.index === 'number') {
      const merged = collectMergedProductMediaUrls(record.fields, columns);
      const targetUrl =
        editingUrl.originalValue ??
        (editingUrl.index >= 0 && editingUrl.index < merged.length ? merged[editingUrl.index] : '');
      if (!targetUrl) {
        setEditingUrl(null);
        return;
      }
      try {
        if (!editingUrl.value.trim()) {
          const patch = buildFieldsAfterHidingGalleryMedia(record.fields, targetUrl, columns);
          await mutations.handleSaveFields(editingUrl.id, patch, records);
          bumpMediaPreviewCache(targetUrl);
        } else {
          const patch = buildFieldsAfterReplacingMediaUrl(
            record.fields,
            targetUrl,
            finalValueToSave,
            columns,
          );
          if (Object.keys(patch).length === 0) {
            await mutations.handleSaveField(editingUrl.id, urlFieldName, finalValueToSave, records);
          } else {
            await mutations.handleSaveFields(editingUrl.id, patch, records);
          }
          bumpMediaPreviewCache(targetUrl, finalValueToSave);
        }
      } catch {
        window.alert('Could not save link. Please try again.');
        return;
      }
      suppressListLayoutResetRef.current = true;
      setScrollTargetRecordId(savedRecordId);
      setEditingUrl(null);
      return;
    }

    if (!finalValueToSave.trim() && !editingUrl.mode) {
      try {
        await mutations.handleSaveField(editingUrl.id, urlFieldName, '', records);
      } catch {
        window.alert('Could not save link. Please try again.');
        return;
      }
      suppressListLayoutResetRef.current = true;
      setScrollTargetRecordId(savedRecordId);
      setEditingUrl(null);
      return;
    }

    const merged = collectMergedProductMediaUrls(record.fields, columns);
    const trimmed = finalValueToSave.trim();
    const next =
      editingUrl.mode === 'prepend'
        ? [trimmed, ...merged.filter((u) => !sameProductMediaUrl(u, trimmed))]
        : [...merged.filter((u) => !sameProductMediaUrl(u, trimmed)), trimmed];

    try {
      const patch = applyMediaListChange(record.fields, columns, next);
      if (Object.keys(patch).length === 0) {
        await mutations.handleSaveField(editingUrl.id, urlFieldName, trimmed, records);
      } else {
        await mutations.handleSaveFields(editingUrl.id, patch, records);
      }
      bumpMediaPreviewCache(trimmed);
    } catch {
      window.alert('Could not save link. Please try again.');
      return;
    }
    suppressListLayoutResetRef.current = true;
    setScrollTargetRecordId(savedRecordId);
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

  const moderationFilterActive =
    Boolean(moderationEditorFilter) || moderationSourceFilter !== 'all';

  const moderationListRecords = React.useMemo(() => {
    if (!isAdminModerator || !moderationMode || !moderationFilterActive) {
      return visibleRecords;
    }
    const ids = changeAudit.recordIdsMatchingFilter;
    if (!ids) return visibleRecords;
    return visibleRecords.filter((record) => ids.has(record.id));
  }, [
    visibleRecords,
    isAdminModerator,
    moderationMode,
    moderationFilterActive,
    changeAudit.recordIdsMatchingFilter,
  ]);

  const listVisibleRecords =
    isAdminModerator && moderationMode && moderationFilterActive
      ? moderationListRecords
      : visibleRecords;

  const hasExportRowFilters = Boolean(
    debouncedSearch.trim() ||
    selectedCategories.size > 0 ||
    selectedColors.size > 0 ||
    selectedSpaces.size > 0 ||
    selectedMaterials.size > 0 ||
    showSelectedOnly ||
    familyCollectionName ||
    moderationFilterActive,
  );

  const exportRecords = React.useMemo(() => {
    if (!hasExportRowFilters) return records;
    let base = sortedRecords;
    if (moderationFilterActive && changeAudit.recordIdsMatchingFilter) {
      base = base.filter((record) => changeAudit.recordIdsMatchingFilter!.has(record.id));
    }
    return base;
  }, [
    hasExportRowFilters,
    records,
    sortedRecords,
    moderationFilterActive,
    changeAudit.recordIdsMatchingFilter,
  ]);

  const baseGalleryItems = filters.baseGalleryItems;
  const allGalleryItems = filters.allGalleryItems;
  const variantCounts = filters.variantCounts;

  const [renderLimit, setRenderLimit] = React.useState<number>(GALLERY_INITIAL_RENDER_COUNT);
  const [isLoadMorePending, startLoadMoreTransition] = React.useTransition();
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const loadMoreThrottleRef = React.useRef(0);

  React.useEffect(() => {
    if (scrollTargetRecordId) return;

    if (suppressListLayoutResetRef.current) {
      suppressListLayoutResetRef.current = false;
      return;
    }

    setRenderLimit(viewMode === 'list' ? LIST_INITIAL_RENDER_COUNT : GALLERY_INITIAL_RENDER_COUNT);
    const scrollEl = viewMode === 'list' ? listScrollRef.current : galleryScrollRef.current;
    if (scrollEl) scrollEl.scrollTop = 0;
  }, [
    viewMode,
    debouncedSearch,
    selectedCategories,
    selectedColors,
    selectedSpaces,
    selectedMaterials,
    showSelectedOnly,
    moderationEditorFilter,
    moderationSourceFilter,
    sortKey,
    sortDir,
    scrollTargetRecordId,
  ]);

  const renderedRecords = React.useMemo(
    () => listVisibleRecords.slice(0, Math.max(1, renderLimit)),
    [listVisibleRecords, renderLimit]
  );
  const remainingRecordsCount = Math.max(0, listVisibleRecords.length - renderedRecords.length);

  const loadMoreRecords = React.useCallback(() => {
    startLoadMoreTransition(() => {
      setRenderLimit(prev => Math.min(prev + LOAD_MORE_STEP, listVisibleRecords.length));
    });
  }, [listVisibleRecords.length, startLoadMoreTransition]);

  const [scrollNearEnd, setScrollNearEnd] = React.useState(false);

  const jumpToTop = React.useCallback(() => {
    const scrollRoot = viewMode === 'list' ? listScrollRef.current : galleryScrollRef.current;
    scrollRoot?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [viewMode]);

  /** Track scroll end + load more (vertical position; ignores horizontal scroll). */
  React.useEffect(() => {
    if (loading) return;

    const scrollRoot = viewMode === 'list' ? listScrollRef.current : galleryScrollRef.current;
    if (!scrollRoot) return;

    const onScroll = () => {
      const near = isScrollContainerNearEnd(scrollRoot);
      setScrollNearEnd(near);
      if (!near || remainingRecordsCount <= 0) return;
      const now = Date.now();
      if (now - loadMoreThrottleRef.current < 160) return;
      loadMoreThrottleRef.current = now;
      loadMoreRecords();
    };

    scrollRoot.addEventListener('scroll', onScroll, { passive: true });
    const resizeObserver = new ResizeObserver(onScroll);
    resizeObserver.observe(scrollRoot);
    const contentEl = scrollRoot.firstElementChild;
    if (contentEl instanceof HTMLElement) {
      resizeObserver.observe(contentEl);
    }
    onScroll();

    return () => {
      scrollRoot.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
    };
  }, [
    loading,
    remainingRecordsCount,
    loadMoreRecords,
    renderLimit,
    viewMode,
    listVisibleRecords.length,
    sortKey,
    sortDir,
  ]);







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
      return allGalleryItems.find((x: any) => x.id === previewId) ?? null;
    }
    if (previewIndex === null) return null;
    return galleryItems[previewIndex] ?? null;
  }, [galleryItems, allGalleryItems, previewId, previewIndex]);

  /** Keep preview index aligned with stable product id when feed filters change. */
  React.useEffect(() => {
    if (!previewId) return;
    const idx = galleryItems.findIndex((x: any) => x.id === previewId);
    if (idx >= 0) {
      setPreviewIndex((prev) => (prev === idx ? prev : idx));
    }
  }, [galleryItems, previewId, setPreviewIndex]);

  /** Ensure infinite-scroll window includes the product currently open in feed. */
  React.useEffect(() => {
    if (!previewId) return;
    let idx = listVisibleRecords.findIndex((r) => r.id === previewId);
    if (idx < 0) {
      idx = sortedRecords.findIndex((r) => r.id === previewId);
    }
    if (idx < 0) return;
    const floor = viewMode === 'list' ? LIST_INITIAL_RENDER_COUNT : GALLERY_INITIAL_RENDER_COUNT;
    setRenderLimit((prev) => Math.max(prev, floor, idx + 1));
  }, [previewId, listVisibleRecords, sortedRecords, viewMode]);

  const resolveListIndexForRecord = React.useCallback(
    (recordId: string, rows: ProductsRecord[]) => rows.findIndex((r) => r.id === recordId),
    [],
  );

  const finishScrollRestore = React.useCallback(() => {
    suppressListLayoutResetRef.current = true;
    pendingFilterClearScrollRef.current = false;
    scrollAnchorViewportTopRef.current = null;
    setScrollTargetRecordId(null);
  }, []);

  const prepareScrollToRecord = React.useCallback(
    (recordId: string) => {
      const record = records.find((r) => r.id === recordId);
      if (record && familyMode === 'main' && record.fields?.Main !== true) {
        setFamilyMode('collection');
      }
      setScrollTargetRecordId(recordId);
    },
    [records, familyMode],
  );

  const handleClosePreview = React.useCallback(() => {
    const restoreId = previewId ?? feedViewedRecordIdRef.current;
    if (!restoreId) {
      closePreview();
      return;
    }

    feedViewedRecordIdRef.current = restoreId;

    if (familyCollectionName) {
      setFamilyCollectionName(null);
    }

    prepareScrollToRecord(restoreId);
    closePreview();
  }, [
    previewId,
    familyCollectionName,
    closePreview,
    setFamilyCollectionName,
    prepareScrollToRecord,
  ]);

  const prepareFilterClearScrollAnchor = React.useCallback(() => {
    const container = viewMode === 'list' ? listScrollRef.current : galleryScrollRef.current;
    const hadSearch = debouncedSearch.trim().length > 0 || search.trim().length > 0;

    const anchorId =
      listVisibleRecords.length === 1 ? listVisibleRecords[0].id
      : hadSearch && listVisibleRecords[0] ? listVisibleRecords[0].id
      : getFirstVisibleListRecordId(container) ??
        renderedRecords[0]?.id ??
        listVisibleRecords[0]?.id ??
        null;

    if (!anchorId) return;

    if (container) {
      const row = container.querySelector(
        `[data-product-row-id="${CSS.escape(anchorId)}"]`,
      ) as HTMLElement | null;
      if (row) {
        scrollAnchorViewportTopRef.current =
          row.getBoundingClientRect().top - container.getBoundingClientRect().top;
      } else {
        scrollAnchorViewportTopRef.current = null;
      }
    }
    pendingFilterClearScrollRef.current = true;
    prepareScrollToRecord(anchorId);
  }, [
    viewMode,
    renderedRecords,
    listVisibleRecords,
    prepareScrollToRecord,
    debouncedSearch,
    search,
  ]);

  const handleClearSearch = React.useCallback(() => {
    if (!search.trim()) return;
    prepareFilterClearScrollAnchor();
    setSearch('');
    searchInputRef.current?.focus();
  }, [search, prepareFilterClearScrollAnchor, setSearch, searchInputRef]);

  const handleClearAllFilters = React.useCallback(() => {
    prepareFilterClearScrollAnchor();

    setSearch('');
    setSelectedCategories(new Set());
    setSelectedColors(new Set());
    setSelectedSpaces(new Set());
    setSelectedMaterials(new Set());
    setFamilyCollectionName(null);
    searchInputRef.current?.focus();
  }, [
    prepareFilterClearScrollAnchor,
    setSearch,
    setSelectedCategories,
    setSelectedColors,
    setSelectedSpaces,
    setSelectedMaterials,
    setFamilyCollectionName,
    searchInputRef,
  ]);

  /** After feed closes or filters clear: expand rows then scroll to the target product. */
  React.useEffect(() => {
    if (previewId !== null || !scrollTargetRecordId) return;

    if (pendingFilterClearScrollRef.current && debouncedSearch.trim() !== '') {
      return;
    }

    const targetId = scrollTargetRecordId;
    const preserveViewportTop = scrollAnchorViewportTopRef.current;
    let cancelled = false;

    const run = (attempt = 0) => {
      if (cancelled) return;

      const idx = resolveListIndexForRecord(targetId, listVisibleRecords);
      if (idx >= 0) {
        const floor = viewMode === 'list' ? LIST_INITIAL_RENDER_COUNT : GALLERY_INITIAL_RENDER_COUNT;
        setRenderLimit((prev) => Math.max(prev, floor, idx + 1));
      }

      const container = viewMode === 'list' ? listScrollRef.current : galleryScrollRef.current;
      if (!container) {
        if (attempt < 30) window.setTimeout(() => run(attempt + 1), 32);
        return;
      }

      const row = container.querySelector(
        `[data-product-row-id="${CSS.escape(targetId)}"]`,
      ) as HTMLElement | null;

      if (row) {
        if (preserveViewportTop !== null) {
          scrollRowToViewportOffset(container, row, preserveViewportTop);
        } else {
          scrollElementIntoContainer(container, row);
        }
        finishScrollRestore();
        return;
      }

      if (attempt < 40) {
        window.setTimeout(() => run(attempt + 1), 32);
      } else {
        finishScrollRestore();
      }
    };

    requestAnimationFrame(() => run());

    return () => {
      cancelled = true;
    };
  }, [
    previewId,
    scrollTargetRecordId,
    debouncedSearch,
    listVisibleRecords,
    renderedRecords.length,
    viewMode,
    familyMode,
    familyCollectionName,
    resolveListIndexForRecord,
    finishScrollRestore,
  ]);

  const handleActiveVariantChange = React.useCallback(
    (variantId: string) => {
      setPreviewId((prev) => (prev === variantId ? prev : variantId));
      feedViewedRecordIdRef.current = variantId;
      const idx = galleryItems.findIndex((x: any) => x.id === variantId);
      if (idx >= 0) {
        setPreviewIndex((prev) => (prev === idx ? prev : idx));
      }
    },
    [galleryItems, setPreviewId, setPreviewIndex],
  );

  const handleFilterCollection = React.useCallback(
    (name: string | null) => {
      if (name === null && familyCollectionName) {
        const current =
          allGalleryItems.find((x) => x.id === previewId) ??
          allGalleryItems.find(
            (x) =>
              (x.collectionNameNormalized || '').trim().toLowerCase() ===
              familyCollectionName.trim().toLowerCase(),
          );
        const collectionKey =
          current?.collectionNameNormalized?.trim() || familyCollectionName.trim();
        const mainItem = findMainGalleryItemForCollection(allGalleryItems, collectionKey);
        if (mainItem?.id) {
          setPreviewId(mainItem.id);
          feedViewedRecordIdRef.current = mainItem.id;
        }
      }
      setFamilyCollectionName(name);
      logFrontendEvent(
        'COLLECTION_VIEW_SOCIAL',
        name ? `Switched to collection: ${name}` : 'Cleared collection filter',
      );
    },
    [familyCollectionName, previewId, allGalleryItems, setPreviewId, setFamilyCollectionName],
  );

  const currentCollectionVariants = React.useMemo(() => {
    const groupKey = getCollectionKey(currentItem?.fields);
    if (!groupKey) return [] as (typeof allGalleryItems)[number][];

    const variants = allGalleryItems.filter(
      (x: { fields?: Record<string, unknown> }) => getCollectionKey(x.fields) === groupKey,
    );

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
    markLightboxTrace('lightbox:state-committed');

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
  const showInitialListSkeleton = loading && records.length === 0;

  const searchGroupNode = (
    <ProductsHeaderSearch
      search={search}
      onSearchChange={setSearch}
      searchInputRef={searchInputRef}
      hasActiveFilters={hasActiveFilters}
      onClearSearch={handleClearSearch}
      onClearAllFilters={handleClearAllFilters}
    />
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

  const moderationToggleNode = isAdminModerator ? (
    <button
      type="button"
      onClick={() => setModerationMode((v) => !v)}
      aria-pressed={moderationMode}
      title={moderationMode ? 'Exit change control mode' : 'Change control mode (admin only)'}
      className={
        headerToggleBase +
        (moderationMode
          ? ' border-amber-400/40 bg-amber-400/20 text-amber-800 ring-2 ring-amber-400/30 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200'
          : ' border-black/10 bg-white/50 text-black/60 hover:bg-white/80 hover:text-black dark:border-white/10 dark:bg-black/40 dark:text-white/60 dark:hover:bg-black/60 dark:hover:text-white')
      }
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    </button>
  ) : null;

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
        maxModeToggleNode={
          <>
            {moderationToggleNode}
            <span className="hidden sm:contents">{maxModeToggleNode}</span>
          </>
        }
        themeToggleNode={themeToggleNode}
        fetchUserSession={fetchUserSession}
        onActivityLogs={toggleActivityLogs}
        backendDisconnected={isStaleOfflineSnapshot}
      />

      <ProductFilters
        data={data}
        isStaleOfflineSnapshot={isStaleOfflineSnapshot}
        visibleCount={listVisibleRecords.length}
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
        onPurgeNumOnlyStubs={canDelete ? handleBulkDeleteNumOnlyStubs : undefined}
        purgeNumOnlyDisabled={mutations.isSaving || loading}
        moderationEditorFilter={
          isAdminModerator && moderationMode
            ? {
                usernames: changeAudit.editorUsernames,
                value: moderationEditorFilter,
                onChange: setModerationEditorFilter,
                disabled: changeAudit.loading,
                matchingRowCount: moderationListRecords.length,
                sourceFilter: moderationSourceFilter,
                onSourceFilterChange: setModerationSourceFilter,
              }
            : undefined
        }
      />

      {error ? (
        <div
          role="alert"
          className={`rounded-lg border p-3 text-sm ${
            isStaleOfflineSnapshot ?
              'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-50'
            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
          }`}
        >
          {isStaleOfflineSnapshot ?
            <>
              <p className="font-semibold">Live catalog unavailable — offline snapshot displayed</p>
              <p className="mt-1.5 text-[13px] leading-snug opacity-95">
                The list below reflects cached data (sessionStorage) or memory from an earlier successful load, not an
                up-to-date read from MongoDB. Totals labeled &quot;Cached snapshot&quot; are not guaranteed to match the
                current server inventory.
              </p>
              <p className="mt-3 text-[12px] font-semibold uppercase tracking-wide opacity-85">Underlying API failure</p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-snug opacity-95">
                {error}
              </pre>
            </>
          : <>
              <p className="font-semibold">Unable to load products</p>
              <p className="mt-1">{error}</p>
            </>
          }
        </div>
      ) : null}

      {isAdminModerator && moderationMode ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/50 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100"
          role="status"
        >
          <span className="font-semibold">
            Change control mode is on — amber ! = manual edits, violet ! = Excel import edits.
            {moderationEditorFilter ?
              ` Editor: ${moderationEditorFilter}.`
            : ''}
            {moderationSourceFilter === 'import' ?
              ' Showing import edits only.'
            : moderationSourceFilter === 'manual' ?
              ' Showing manual edits only.'
            : moderationEditorFilter ? '' : ' Use Editor or Source filters to narrow rows.'}
            {viewMode !== 'list' ? ' (Switch to list view to see indicators.)' : ''}
          </span>
          <span className="text-[11px] text-amber-900/70 dark:text-amber-100/70">
            {changeAudit.loading
              ? 'Loading change history…'
              : changeAudit.error
                ? changeAudit.error
                : moderationFilterActive
                  ? `${changeAudit.changedCellCount.toLocaleString('en-US')} cells · ${moderationListRecords.length.toLocaleString('en-US')} rows`
                  : `${changeAudit.changedCellCount.toLocaleString('en-US')} cells with edit history`}
          </span>
        </div>
      ) : null}

      {isAdminModerator && moderationMode ? (
        <ProductsExcelExport
          records={exportRecords}
          allColumns={columns}
          hasActiveRowFilters={hasExportRowFilters}
        />
      ) : null}

      {showInitialListSkeleton ? (
        <ListView
          loading
          records={records}
          visibleRecords={[]}
          displayedColumns={displayedColumns}
          selectedIds={selectedIds}
          toggleSelected={toggleSelected}
          toggleSort={toggleSort}
          sortKey={sortKey}
          sortDir={sortDir}
          openPreviewByUrl={openPreviewByRecordOrUrl}
          setEditingUrl={setEditingUrl}
          handleMoveUrl={handleMoveUrl}
          handleReorderUrls={handleReorderUrls}
          draggedUrlInfo={draggedUrlInfo}
          setDraggedUrlInfo={setDraggedUrlInfo}
          activeDropTargetRef={activeDropTargetRef}
          linkHoverTimerRef={linkHoverTimerRef}
          familyMode={familyMode}
          variantCounts={variantCounts}
          search={search}
          setLinkHoverState={setLinkHoverState}
          canEdit={canEdit}
          canDelete={canDelete}
          handleDeleteProduct={handleDeleteProduct}
          handleToggleMain={handleToggleMain}
          handleSaveField={handleSaveField}
          handleSaveUrl={handleSaveUrl}
          handleRemoveUrl={handleRemoveUrl}
          handleHideMediaFromGallery={handleHideMediaFromGallery}
          handleUnhideMediaFromGallery={handleUnhideMediaFromGallery}
          columns={columns}
          editingUrl={editingUrl}
          isSaving={mutations.isSaving}
          moderationMode={isAdminModerator && moderationMode}
          changeAudit={changeAudit}
          canEditField={canEditFieldForUser}
        />
      ) : viewMode === 'list' ? (
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
            openPreviewByUrl={openPreviewByRecordOrUrl}
            setEditingUrl={setEditingUrl}
            handleMoveUrl={handleMoveUrl}
          handleReorderUrls={handleReorderUrls}
            draggedUrlInfo={draggedUrlInfo}
            setDraggedUrlInfo={setDraggedUrlInfo}
            activeDropTargetRef={activeDropTargetRef}
            linkHoverTimerRef={linkHoverTimerRef}
            familyMode={familyMode}
            variantCounts={variantCounts}
            search={search}
            setLinkHoverState={setLinkHoverState}
            canEdit={canEdit}
            canDelete={canDelete}
            handleDeleteProduct={handleDeleteProduct}
            handleToggleMain={handleToggleMain}
            handleSaveField={handleSaveField}
            handleSaveUrl={handleSaveUrl}
            handleRemoveUrl={handleRemoveUrl}
            handleHideMediaFromGallery={handleHideMediaFromGallery}
            handleUnhideMediaFromGallery={handleUnhideMediaFromGallery}
            columns={columns}
            editingUrl={editingUrl}
            isSaving={mutations.isSaving}
            scrollContainerRef={listScrollRef}
            moderationMode={isAdminModerator && moderationMode}
            changeAudit={changeAudit}
            canEditField={canEditFieldForUser}
            loadMore={
              !loading && listVisibleRecords.length > 0
                ? {
                    sentinelRef: loadMoreSentinelRef,
                    pending: isLoadMorePending,
                    remainingCount: remainingRecordsCount,
                    scrollNearEnd,
                    onJumpToTop: jumpToTop,
                  }
                : undefined
            }
          />
        </>
      ) : (
        <div className="relative min-h-0 flex-1 w-full animate-fade-in rounded-xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-black/25">
        <div
          ref={galleryScrollRef}
          className="scrollbar-minimal h-full min-h-0 w-full overflow-y-auto p-3"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {renderedRecords.map((r) => (
              <div key={r.id} data-product-row-id={r.id}>
                <GalleryCard
                  record={r}
                  columns={columns}
                  search={search}
                  selectedIds={selectedIds}
                  toggleSelected={toggleSelected}
                  openPreviewByUrl={openPreviewByUrl}
                  familyMode={familyMode}
                  variantCounts={variantCounts}
                />
              </div>
            ))}
          </div>

          {!loading && listVisibleRecords.length === 0 && (
            <div className="col-span-full py-40 flex flex-col items-center justify-center animate-fade-in text-center px-6">
               <div className="h-24 w-24 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/5 flex mb-8 text-black/10 dark:text-white/10 ring-8 ring-zinc-50 dark:ring-white/5">
                  <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
               </div>
               <h3 className="text-2xl font-black text-black dark:text-white tracking-tight">Product Not Found</h3>
               <p className="mt-2 text-zinc-500 max-w-[280px]">We couldn't find any items matching your specific search or filters.</p>
               <button 
                 onClick={handleClearAllFilters}
                 className="mt-10 rounded-full bg-zinc-950 px-10 py-3.5 text-sm font-black text-white hover:bg-black shadow-2xl dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-all active:scale-95 uppercase tracking-widest"
               >
                 Reset All
               </button>
            </div>
          )}

          {!loading && remainingRecordsCount > 0 ? (
            <LoadMoreScrollSentinel sentinelRef={loadMoreSentinelRef} />
          ) : null}
        </div>
        {!loading && listVisibleRecords.length > 0 ? (
          <LoadMoreFloatingIndicator
            pending={isLoadMorePending}
            remainingCount={remainingRecordsCount}
            atEnd={scrollNearEnd && remainingRecordsCount === 0}
            onJumpToTop={jumpToTop}
          />
        ) : null}
        </div>
      )}

      {!currentItem ? <PwaInstallFab raised={selectedCount > 0} /> : null}

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
          initialVariantIndex={previewIndex === null ? undefined : previewIndex}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelected}
          onClose={handleClosePreview}
          onActiveVariantChange={handleActiveVariantChange}
          onFilterCollection={handleFilterCollection}
          activeCollectionName={familyCollectionName}
          selectedCount={selectedIds.size}
          canEdit={canEdit}
          canEditField={canEditFieldForUser}
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
          closePreview={handleClosePreview}
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

      <ActivityLogModal isOpen={showActivityLogs} onClose={() => setShowActivityLogs(false)} />

    </main>
  );
}
