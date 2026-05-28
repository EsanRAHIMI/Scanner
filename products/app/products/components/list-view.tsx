'use client';

import * as React from 'react';
import { ProductsRecord } from '@/types/trainer';
import { 
  formatScalar, 
  extractUrls, 
  getDriveDirectLink, 
  highlightMatches,
  isVideoUrl,
  formatPrice,
  filterUrlsForGalleryDisplay,
  getImageColumnDisplayUrls,
  isGalleryMediaHidden,
  DRIVE_IMAGE_WIDTH_HOVER,
  getCollectionKey,
  getCollectionDisplayKey,
  resolveCollectionName,
  resolveCollectionCode,
} from '../lib/product-utils';
import { beginLightboxTrace, markLightboxTrace } from '../lib/lightbox-perf';
import {
  CONTENT_STATUS_OPTIONS,
  resolveContentStatusValue,
  getTagColorStyles,
  getTagMaterialStyles,
  getContentStatusStyles,
} from '../lib/constants';
import { isContentStatusFieldName } from '../lib/product-utils';
import { PhotoDeck } from './photo-deck';
import { ListScrollRootContext } from './list-scroll-root';
import { UrlColumnList, isUrlReorderDragEvent } from './url-column-list';
import { ProductsSkeleton } from './products-skeleton';

import { CellChangeAudit } from './field-change-indicator';
import { ListViewProps } from '../types/products-ui';
import {
  LoadMoreFloatingIndicator,
  LoadMoreScrollSentinel,
} from './load-more-floating-indicator';

function isCodeNumberColumn(normalizedCol: string): boolean {
  return normalizedCol === 'code number' || normalizedCol === 'code no';
}

/** Mobile-only: fixed width + clip overflow so text cannot paint under the next column. */
function listColumnWidthClass(
  normalizedCol: string,
  isURL: boolean,
  isContentStatus: boolean,
): string {
  if (isURL) return 'w-[220px] min-w-[220px] max-w-[220px] ';
  if (normalizedCol === 'variant number') return 'w-[110px] min-w-[110px] max-w-[110px] ';
  if (isCodeNumberColumn(normalizedCol)) {
    return 'max-sm:w-[6.25rem] max-sm:min-w-[6.25rem] max-sm:max-w-[6.25rem] max-sm:box-border ';
  }
  if (normalizedCol === 'image') {
    return 'max-sm:w-[6.5rem] max-sm:min-w-[6.5rem] max-sm:max-w-[6.5rem] max-sm:overflow-hidden ';
  }
  if (isContentStatus) return 'w-[148px] min-w-[148px] max-w-[180px] ';
  return '';
}

function codeNumberCellShellClass(): string {
  return 'text-left max-sm:min-w-0 max-sm:max-w-full max-sm:break-words max-sm:[overflow-wrap:anywhere] max-sm:whitespace-pre-wrap max-sm:leading-snug ';
}

function listCellAlignClass(): string {
  return 'align-middle text-left ';
}

/** Desktop fixed-height cell content scroller (keeps row height stable). */
function desktopCellScrollClass(): string {
  return 'sm:max-h-[140px] sm:overflow-y-auto sm:overscroll-y-contain sm:pr-1';
}

function listRowCellBackgroundClass(selected: boolean, isInGroup: boolean): string {
  if (selected) return 'bg-emerald-50 dark:bg-emerald-900/30 ';
  if (isInGroup) return 'bg-emerald-50/40 dark:bg-emerald-900/10 ';
  return 'bg-white dark:bg-black/10 ';
}

/** Desktop: first column sticky z-30 (unchanged). Mobile: Code Number above image deck fan-out. */
function listColumnStackClass(
  normalizedCol: string,
  isFirstCol: boolean,
  selected: boolean,
  isInGroup: boolean,
): string {
  let cls = '';
  if (isFirstCol) {
    cls += 'sticky left-0 z-30 ' + listRowCellBackgroundClass(selected, isInGroup);
    if (normalizedCol === 'image') {
      cls += 'max-sm:static max-sm:left-auto max-sm:z-0 ';
    }
  }
  if (isCodeNumberColumn(normalizedCol)) {
    cls +=
      'max-sm:relative max-sm:z-30 ' +
      (selected
        ? 'max-sm:bg-emerald-50 max-sm:dark:bg-emerald-900/30 '
        : isInGroup
          ? 'max-sm:bg-emerald-50/40 max-sm:dark:bg-emerald-900/10 '
          : 'max-sm:bg-white max-sm:dark:bg-black/10 ');
  }
  return cls;
}

function ContentStatusSelect({
  recordId,
  column,
  value,
  canEdit,
  isSaving,
  handleSaveField,
}: {
  recordId: string;
  column: string;
  value: unknown;
  canEdit: boolean | undefined;
  isSaving: boolean;
  handleSaveField?: (id: string, field: string, val: unknown) => void;
}) {
  const matched = resolveContentStatusValue(formatScalar(value));

  return (
    <select
      value={matched}
      disabled={!canEdit || isSaving}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onChange={(event) => {
        event.stopPropagation();
        void handleSaveField?.(recordId, column, event.target.value);
      }}
      className={
        'w-full min-w-[9.5rem] cursor-pointer rounded-lg border px-2 py-1.5 text-[11px] font-semibold outline-none transition-colors focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50 ' +
        getContentStatusStyles(matched)
      }
      aria-label="Content Status"
    >
      {CONTENT_STATUS_OPTIONS.map(opt => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

export function ListView({
  loading,
  records,
  visibleRecords,
  displayedColumns,
  selectedIds,
  toggleSelected,
  toggleSort,
  sortKey,
  sortDir,
  openPreviewByUrl,
  setEditingUrl,
  handleMoveUrl,
  handleReorderUrls,
  draggedUrlInfo,
  setDraggedUrlInfo,
  activeDropTargetRef,
  linkHoverTimerRef,
  familyMode,
  variantCounts,
  search,
  setLinkHoverState,
  canEdit,
  canEditField,
  canDelete,
  handleDeleteProduct,
  handleToggleMain,
  handleSaveField,
  handleSaveUrl,
  handleRemoveUrl,
  handleHideMediaFromGallery,
  handleUnhideMediaFromGallery,
  columns,
  editingUrl,
  isSaving,
  scrollContainerRef,
  loadMore,
  moderationMode = false,
  changeAudit,
}: ListViewProps) {
  const [listScrollRoot, setListScrollRoot] = React.useState<HTMLElement | null>(null);
  const assignScrollContainerRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      setListScrollRoot(node);
      if (scrollContainerRef) scrollContainerRef.current = node;
    },
    [scrollContainerRef],
  );

  const recordById = React.useMemo(() => {
    const map = new Map<string, ProductsRecord>();
    for (const r of records) map.set(r.id, r);
    return map;
  }, [records]);

  const getUrlFieldValue = React.useCallback((fields: Record<string, unknown> | undefined) => {
    const urlEntry = Object.entries(fields || {}).find(([k]) => {
      const kl = k.trim().toLowerCase();
      return kl === 'url' || kl.endsWith(' url') || kl.endsWith('_url') || kl.endsWith('-url');
    });
    return urlEntry?.[1];
  }, []);

  const mergeUrlValues = React.useCallback((...values: unknown[]) => {
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const value of values) {
      for (const url of extractUrls(value)) {
        const key = url.trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        urls.push(key);
      }
    }
    return urls.join('\n');
  }, []);

  const getUrlSourceBadge = React.useCallback((url: string) => {
    const lower = url.trim().toLowerCase();
    if (lower.includes('drive.google.com') || lower.includes('googleusercontent.com')) {
      return {
        kind: 'google',
        title: 'Google Drive image',
      };
    }
    if (/\/api\/static\/product_images\//i.test(lower)) {
      return {
        kind: 'trainer',
        title: 'Trainer static image',
      };
    }
    if (
      lower.startsWith('/api/trainer/files/') ||
      lower.startsWith('/files/') ||
      lower.includes('/api/trainer/files/') ||
      lower.includes('/files/')
    ) {
      return {
        kind: 'local',
        title: 'Hosted product image',
      };
    }
    return null;
  }, []);

  const getColumnLabel = React.useCallback((column: string) => {
    const normalized = column.trim().toLowerCase();
    if (normalized === 'colecction name' || normalized === 'collection name') return 'Collection Name';
    if (normalized === 'colecction code' || normalized === 'collection code') return 'Collection Code';
    if (isCodeNumberColumn(normalized)) return 'Code Number';
    if (normalized === 'dimension (mm)' || normalized === 'dimension') return 'Dimension (mm)';
    if (normalized === 'content status') return 'Content Status';
    return column;
  }, []);

  const isInlineEditableColumn = React.useCallback((column: string) => {
    const normalized = getColumnLabel(column).trim().toLowerCase();
    const inlineEditable = [
      'code number',
      'code no',
      'collection name',
      'price',
      'collection code',
      'variant number',
      'dimension (mm)',
      'note',
      'factory code',
      'details',
      'h',
      'l',
      'w',
    ].includes(normalized);
    if (!inlineEditable) return false;
    return canEditField ? canEditField(column) : true;
  }, [getColumnLabel, canEditField]);

  const startInlineEdit = React.useCallback((recordId: string, column: string, value: unknown) => {
    if (canEditField && !canEditField(column)) return;
    const displayValue = formatScalar(value);
    setEditingUrl({ id: recordId, value: displayValue, originalValue: displayValue, column });
  }, [setEditingUrl, canEditField]);

  const rowGroupMeta = React.useMemo(() => {
    const keys = visibleRecords.map((rec) => getCollectionKey(rec.fields));
    return keys.map((currentKey, i) => {
      const prevKey = i > 0 ? keys[i - 1] : null;
      const nextKey = i < keys.length - 1 ? keys[i + 1] : null;
      const isGroupStart = currentKey !== '' && currentKey !== prevKey && currentKey === nextKey;
      const isGroupEnd = currentKey !== '' && currentKey !== nextKey && currentKey === prevKey;
      const isInGroup = currentKey !== '' && (currentKey === prevKey || currentKey === nextKey);
      return { isGroupStart, isGroupEnd, isInGroup };
    });
  }, [visibleRecords]);

  const getCollectionMeta = React.useCallback(
    (recordId: string) => {
      const r = recordById.get(recordId);
      return {
        title: resolveCollectionName(r?.fields) || 'Product',
        code: resolveCollectionCode(r?.fields) || '—',
        variant:
          formatScalar(r?.fields?.['Variant Number']) ||
          formatScalar(r?.fields?.Num) ||
          '—',
      };
    },
    [recordById],
  );

  const renderCell = React.useCallback(
    (column: string, value: unknown, recordId: string) => {
      const col = column.trim().toLowerCase();
      const isURL = col === 'url';
      const isDAM = col === 'dam';
      const isVideoCol = col === 'video';


      const isPhotoCol = col === 'image' || isDAM || isVideoCol;

      if (isPhotoCol) {
        const recordFields = recordById.get(recordId)?.fields;
        const urls =
          col === 'image'
            ? getImageColumnDisplayUrls(recordFields, columns)
            : filterUrlsForGalleryDisplay(
                isVideoCol
                  ? extractUrls(value).filter(isVideoUrl)
                  : extractUrls(value).filter(u => !isVideoUrl(u)),
                recordFields,
                columns,
              );

        if (urls.length === 0) {
          if ((col === 'image' || isDAM || isVideoCol) && canEdit) {
            if (editingUrl?.id === recordId && editingUrl.column === column) {
              return (
                <div className="absolute inset-0 z-10 bg-white dark:bg-black p-1">
                  <textarea
                    className="h-full w-full resize-none overflow-hidden border-2 border-emerald-500 bg-transparent p-2 text-[11px] font-medium leading-relaxed outline-none dark:border-emerald-400"
                    value={editingUrl.value}
                    onChange={(e) => setEditingUrl({ ...editingUrl, value: e.target.value })}
                    autoFocus
                    placeholder={`URL for ${isVideoCol ? 'Video' : 'Image'}...`}
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
              <div className="flex h-12 w-full items-center justify-center max-sm:justify-start">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingUrl({ id: recordId, value: '', column });
                  }}
                  className="group flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-red-500/60 transition-all hover:bg-red-500/10 hover:text-red-600 dark:text-red-400/60 dark:hover:bg-red-500/20 dark:hover:text-red-400 pointer-events-auto cursor-pointer"
                  title={`Add URL for ${isVideoCol ? 'Video' : 'Image'}`}
                >
                  <span className="relative">
                    {isVideoCol ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <div className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-transparent text-[10px] font-black text-red-600 dark:text-red-400">
                      +
                    </div>
                  </span>
                </button>
              </div>
            );
          }
          return (
            <div className="flex h-12 w-full items-center justify-center bg-black/5 dark:bg-white/5 rounded-md max-sm:justify-start max-sm:px-2">
              <span className="text-[10px] font-medium italic text-black/40 dark:text-white/40 uppercase tracking-tight">
                No {isVideoCol ? 'video' : 'image'}
              </span>
            </div>
          );
        }

        return (
          <div className="relative flex min-h-[48px] w-full items-center justify-center transition-all rounded-lg max-sm:min-h-0 max-sm:w-full max-sm:justify-stretch max-sm:overflow-hidden">
            <PhotoDeck 
              urls={urls} 
              maxItems={4} 
              onOpenPreview={openPreviewByUrl}
              recordId={recordId}
              column={column}
              onDragStart={(url) => setDraggedUrlInfo({ url, sourceId: recordId, sourceColumn: column })}
              onDragEnd={() => setDraggedUrlInfo(null)}
              linkHoverTimerRef={linkHoverTimerRef}
              onMouseEnter={(url, e) => {
                if (linkHoverTimerRef?.current) clearTimeout(linkHoverTimerRef.current);
                (linkHoverTimerRef as any).current = setTimeout(() => {
                  const r = recordById.get(recordId);
                  if (r) {
                    setLinkHoverState({
                      url,
                      x: e.clientX,
                      y: e.clientY,
                      title: resolveCollectionName(r.fields) || 'Product',
                      code: resolveCollectionCode(r.fields) || '—',
                      variant: formatScalar(r.fields?.['Variant Number']) || formatScalar(r.fields?.Num) || '—'
                    });
                  }
                }, 300);
              }}
              onMouseLeave={() => {
                if (linkHoverTimerRef?.current) clearTimeout(linkHoverTimerRef.current);
                setLinkHoverState(null);
              }}
            />
          </div>
        );
      }

      if (isURL) {
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
                className="pointer-events-auto absolute right-0 top-0 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-bl-lg bg-emerald-600 text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
                title="Add URL to top"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <div
              className={
                'group flex min-h-[1.5rem] flex-col gap-1 max-sm:min-h-0 max-sm:gap-0 max-sm:overflow-hidden ' +
                // Desktop mirrors mobile URL behavior: fixed row height, inner scroll per cell.
                desktopCellScrollClass() + ' ' +
                (urls.length === 0 ? 'items-center justify-center' : '')
              }
            >
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
                      className="pointer-events-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-transparent text-red-500/60 transition-all hover:bg-red-500/10 hover:text-red-600 dark:text-red-400/60 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                      title="Add URL"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : (
                    <span className="text-2xl font-light text-red-500/60 dark:text-red-400/60">+</span>
                  )}
                  {editingUrl?.id === recordId && (editingUrl.column === column || !editingUrl.column) && !editingUrl.mode && editingUrl.index === undefined && (
                    <div className="absolute inset-0 z-50 bg-white p-1 dark:bg-black">
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
                    </div>
                  )}
                </div>
              ) : (
                <UrlColumnList
                  recordId={recordId}
                  column={column}
                  urls={urls}
                  canEdit={Boolean(canEdit)}
                  isSaving={isSaving}
                  recordFields={recordById.get(recordId)?.fields}
                  columns={columns}
                  editingUrl={editingUrl}
                  setEditingUrl={setEditingUrl}
                  handleSaveUrl={handleSaveUrl}
                  handleHideMediaFromGallery={handleHideMediaFromGallery}
                  handleUnhideMediaFromGallery={handleUnhideMediaFromGallery}
                  handleReorderUrls={handleReorderUrls}
                  setDraggedUrlInfo={setDraggedUrlInfo}
                  linkHoverTimerRef={linkHoverTimerRef}
                  setLinkHoverState={setLinkHoverState}
                  getUrlSourceBadge={getUrlSourceBadge}
                  getCollectionMeta={getCollectionMeta}
                />
              )}
            </div>
          </>
        );
      }

      if (col === 'main') {
        const checked = value === true || String(value).trim().toLowerCase() === 'true';
        return (
          <div className="flex min-h-[36px] items-center justify-center">
            <input
              type="checkbox"
              checked={checked}
              disabled={!canEdit || isSaving}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                event.stopPropagation();
                if (!checked) handleToggleMain?.(recordId);
              }}
              className="h-4 w-4 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
              title={checked ? 'Main variant' : 'Set as main variant'}
            />
          </div>
        );
      }

      if (canEdit && isInlineEditableColumn(column)) {
        const displayValue = formatScalar(value);
        const isActiveEdit = editingUrl?.id === recordId && editingUrl?.column === column;
        const formattedPrice = col === 'price' ? formatPrice(value) : null;
        const isCodeNumber = isCodeNumberColumn(col);
        if (isActiveEdit) {
          return (
            <input
              className={
                (isCodeNumber
                  ? 'block w-full min-w-0 rounded border-2 border-emerald-500 bg-white px-2 py-1.5 text-xs font-semibold text-black outline-none dark:border-emerald-400 dark:bg-zinc-950 dark:text-white '
                  : 'absolute inset-0 h-full w-full bg-white px-3 py-2 text-xs font-semibold text-black outline outline-2 -outline-offset-2 outline-emerald-500 dark:bg-zinc-950 dark:text-white ')
              }
              value={editingUrl.value}
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setEditingUrl({ ...editingUrl, value: event.target.value })}
              onClick={(event) => event.stopPropagation()}
              onBlur={() => {
                handleSaveField?.(recordId, column, editingUrl.value);
                setEditingUrl(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSaveField?.(recordId, column, editingUrl.value);
                  setEditingUrl(null);
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  setEditingUrl(null);
                }
              }}
            />
          );
        }

        return (
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              startInlineEdit(recordId, column, value);
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              startInlineEdit(recordId, column, value);
            }}
            className={
              'block min-h-[34px] w-full min-w-0 max-w-full text-left hover:text-emerald-700 dark:hover:text-emerald-300 ' +
              (isCodeNumberColumn(col) ? 'break-words whitespace-pre-wrap leading-snug ' : '')
            }
            title={displayValue || 'Edit'}
          >
            {formattedPrice ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-black dark:text-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/fonts/Dirham%20Currency%20Symbol%20-%20Black.svg"
                  alt="AED"
                  className="h-3 w-auto opacity-70 dark:invert"
                />
                <span>{formattedPrice}</span>
              </span>
            ) : col === 'note' ? (
              // Note can be long; keep table density stable by scrolling inside the cell.
              <div className={desktopCellScrollClass()}>
                {displayValue ? (
                  <span className="block whitespace-pre-wrap break-words leading-snug">
                    {highlightMatches(displayValue, search)}
                  </span>
                ) : (
                  <span className="text-black/25 dark:text-white/25">-</span>
                )}
              </div>
            ) : displayValue ? (
              highlightMatches(displayValue, search)
            ) : (
              <span className="text-black/25 dark:text-white/25">-</span>
            )}
          </button>
        );
      }

      if (col === 'space') {
        const displayValue = formatScalar(value);
        const activeValues = (displayValue || '').split(',').map(s => s.trim()).filter(Boolean);
        const isActiveEdit = editingUrl?.id === recordId && editingUrl?.column === column;

        return (
          <div
            className={`group relative flex flex-col h-full min-h-[44px] w-full items-stretch overflow-hidden ${canEdit ? 'cursor-pointer' : ''} ${isActiveEdit ? 'ring-2 ring-inset ring-emerald-500/40' : ''}`}
            onClick={(e) => {
              if (!canEdit) return;
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setEditingUrl({ id: recordId, value: displayValue, originalValue: displayValue, column, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } });
            }}
          >
            {activeValues.length === 0 ? (
              <div className="flex flex-1 items-center justify-start px-2">
                <span className={`text-left text-[11px] italic ${canEdit ? 'text-black/25 dark:text-white/25 group-hover:text-emerald-600/60 dark:group-hover:text-emerald-400/60' : 'text-black/20 dark:text-white/20'}`}>
                  {canEdit ? '+ Add space' : '—'}
                </span>
              </div>
            ) : (
              activeValues.map((v, i) => (
                <div 
                  key={v} 
                  className={`flex flex-1 items-center justify-start px-3 py-1 text-left text-[10px] font-semibold transition-colors bg-white/5 text-black/80 dark:bg-white/5 dark:text-white/80 ${
                    i !== activeValues.length - 1 ? 'border-b border-black/5 dark:border-white/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 leading-tight">
                    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 flex-none opacity-20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span className="truncate">{v}</span>
                  </div>
                </div>
              ))
            )}
            {canEdit && (
              <div className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                <svg viewBox="0 0 24 24" className="h-3 w-3 text-emerald-600/40 dark:text-emerald-400/40" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            )}
          </div>
        );
      }

      if (col === 'content status') {
        return (
          <ContentStatusSelect
            recordId={recordId}
            column={column}
            value={value}
            canEdit={canEdit}
            isSaving={isSaving}
            handleSaveField={handleSaveField}
          />
        );
      }

      if (col === 'color' || col === 'material' || col === 'category') {
        const displayValue = formatScalar(value);
        const activeValues = (displayValue || '').split(',').map(s => s.trim()).filter(Boolean);
        const isActiveEdit = editingUrl?.id === recordId && editingUrl?.column === column;

        return (
          <div
            className={`group relative flex flex-col h-full min-h-[44px] w-full items-stretch overflow-hidden ${canEdit ? 'cursor-pointer' : ''} ${isActiveEdit ? 'ring-2 ring-inset ring-emerald-500/40' : ''}`}
            onClick={(e) => {
              if (!canEdit) return;
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setEditingUrl({ id: recordId, value: displayValue, originalValue: displayValue, column, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } });
            }}
          >
            {activeValues.length === 0 ? (
              <div className="flex flex-1 items-center justify-start px-2">
                <span className={`text-left text-[11px] italic ${canEdit ? 'text-black/25 dark:text-white/25 group-hover:text-emerald-600/60 dark:group-hover:text-emerald-400/60' : 'text-black/20 dark:text-white/20'}`}>
                  {canEdit ? `+ Add ${col}` : '—'}
                </span>
              </div>
            ) : (
              activeValues.map((v, i) => (
                <div 
                  key={v} 
                  className={`flex flex-1 items-center justify-start px-3 py-1 text-left text-[10px] font-semibold transition-colors border-b last:border-b-0 ${
                    col === 'category'
                      ? 'border-black/5 bg-white/5 text-black/80 dark:bg-white/5 dark:text-white/80'
                      : col === 'color'
                      ? `${getTagColorStyles(v)} border-black/5 dark:border-white/5`
                      : `${getTagMaterialStyles(v)} border-black/5 dark:border-white/5`
                  }`}
                >
                  <span className="truncate">{v}</span>
                </div>
              ))
            )}
            {canEdit && (
              <div className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                <svg viewBox="0 0 24 24" className="h-3 w-3 text-black/40 dark:text-white/40" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002-2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            )}
          </div>
        );
      }

      if (col === 'price') {
        const formatted = formatPrice(value);
        if (!formatted) return formatScalar(value);
        return (
          <div className="flex items-center gap-1.5 font-bold text-black dark:text-white">
            <span className="inline-flex items-baseline gap-1">
              <span className="text-[10px] opacity-40">AED</span>
              <span>{formatted}</span>
            </span>
          </div>
        );
      }

      const scalar = formatScalar(value);
      if (scalar) {
        if (col === 'note') {
          return (
            // Non-edit mode for Note uses the same desktop fixed-height scroll container.
            <div className={desktopCellScrollClass()}>
              <span className="block whitespace-pre-wrap break-words leading-snug">
                {highlightMatches(scalar, search)}
              </span>
            </div>
          );
        }
        const colLower = column.trim().toLowerCase();
        if (familyMode === 'main' && (colLower === 'num' || colLower === 'variant number')) {
          const rec = recordById.get(recordId);
          const key = getCollectionDisplayKey(rec?.fields);
          const count = variantCounts[key] || 0;
          const extra = count - 1;
          if (extra > 0) {
            return (
              <>
                <span className="truncate">{highlightMatches(scalar, search)}</span>
                <span className="absolute right-1 top-1 z-10 rounded bg-black/10 px-1 py-0.5 text-[8px] font-bold text-black/40 dark:bg-white/15 dark:text-white/40">
                  +{extra}
                </span>
              </>
            );
          }
        }
        return highlightMatches(scalar, search);
      }

      if (typeof value === 'object' && value !== null) {
        const maybe = value as Record<string, unknown>;
        if (typeof maybe.name === 'string') return maybe.name;
        if (typeof maybe.url === 'string') return maybe.url;
        return <span className="text-xs text-black/60 dark:text-white/60">Object</span>;
      }

      return String(value ?? '');
    },
    [recordById, search, familyMode, variantCounts, columns, setEditingUrl, handleSaveUrl, handleRemoveUrl, handleHideMediaFromGallery, handleUnhideMediaFromGallery, handleReorderUrls, editingUrl, isSaving, linkHoverTimerRef, setLinkHoverState, setDraggedUrlInfo, getUrlSourceBadge, getCollectionMeta, canEdit, handleToggleMain, isInlineEditableColumn, handleSaveField, startInlineEdit]
  );

  const showLoadMoreSentinel = Boolean(loadMore && loadMore.remainingCount > 0);
  const showScrollFooter = Boolean(
    loadMore && (loadMore.remainingCount > 0 || loadMore.scrollNearEnd),
  );

  return (
    <div className="relative flex-1 min-h-0 w-full animate-fade-in border border-x-0 border-black/10 bg-white shadow-none dark:border-white/10 dark:bg-black/25 max-sm:-ml-5 max-sm:w-[calc(100%+2.5rem)] max-sm:max-w-none max-sm:rounded-none sm:ml-0 sm:w-full sm:rounded-xl sm:border-x sm:shadow-sm">
      <ListScrollRootContext.Provider value={listScrollRoot}>
      <div
        ref={assignScrollContainerRef}
        className="scrollbar-minimal h-full min-h-0 w-full overflow-auto"
      >
      <table className="min-w-full table-auto text-left text-sm border-separate border-spacing-0">
        <thead className="bg-transparent text-[10px] uppercase tracking-wider text-black/40 dark:text-white/35 font-bold">
          <tr>
            {displayedColumns.map((c, idx) => {
              const normalizedCol = c.trim().toLowerCase();
              const isURL = normalizedCol === 'url';
              const isContentStatus = isContentStatusFieldName(c);
              const isImageCol = normalizedCol === 'image';
              const isCodeNumber = isCodeNumberColumn(normalizedCol);
              return (
                <th
                  key={c}
                  className={
                    'sticky top-0 bg-white/95 shadow-sm backdrop-blur-md dark:bg-black/85 ' +
                    (idx === 0 ? 'left-0 z-30 ' : 'z-20 ') +
                    (idx === 0 && isImageCol ? 'max-sm:static max-sm:left-auto max-sm:z-10 ' : '') +
                    (isCodeNumber ? 'max-sm:relative max-sm:z-40 ' : '') +
                    listColumnWidthClass(normalizedCol, isURL, isContentStatus) +
                    (isCodeNumberColumn(normalizedCol) ? 'max-sm:whitespace-normal ' : '') +
                    'px-2 py-2.5 text-left sm:px-4 sm:py-3'
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(c)}
                    className={
                      (isCodeNumberColumn(normalizedCol)
                        ? 'inline-flex max-sm:flex-col max-sm:items-start max-sm:gap-0.5 '
                        : 'inline-flex items-center gap-2 ') + 'hover:text-black dark:hover:text-white'
                    }
                    title="Sort"
                  >
                    {isCodeNumberColumn(normalizedCol) ? (
                      <>
                        <span className="sm:hidden" title="Code Number">
                          Code
                        </span>
                        <span className="hidden sm:inline">Code Number</span>
                      </>
                    ) : (
                      <span>{getColumnLabel(c)}</span>
                    )}
                    {sortKey === c ? (
                      <span className="text-[10px] text-black/40 dark:text-white/35">{sortDir === 'asc' ? '▲' : '▼'}</span>
                    ) : null}
                  </button>
                </th>
              );
            })}
            {canDelete ? (
              <th className="sticky top-0 z-20 w-[92px] min-w-[92px] bg-white/95 px-2 py-2.5 text-left shadow-sm backdrop-blur-md dark:bg-black/85 sm:px-3 sm:py-3">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {loading && records.length === 0 ? (
            <ProductsSkeleton
              viewMode="list"
              rowsOnly
              columnCount={displayedColumns.length + (canDelete ? 1 : 0)}
            />
          ) : (
            visibleRecords.map((r, i) => {
              const { isGroupStart, isGroupEnd, isInGroup } = rowGroupMeta[i] ?? {
                isGroupStart: false,
                isGroupEnd: false,
                isInGroup: false,
              };
              const groupBorderClass = 'border-emerald-500/30 dark:border-emerald-400/25';
              
              return (
                <tr
                  key={r.id}
                  data-product-row-id={r.id}
                  className={
                    'align-middle transition-colors max-sm:[contain-intrinsic-size:auto_7rem] max-sm:[content-visibility:auto] max-sm:transition-none ' +
                    (isGroupStart ? `border-t-2 ${groupBorderClass} ` : 
                     isInGroup ? 'border-t-0 ' : 
                     'border-t border-black/10 dark:border-white/10 ') +
                    (isGroupEnd ? `border-b-2 ${groupBorderClass} ` : '') +
                    (selectedIds.has(r.id) 
                      ? 'bg-emerald-50/80 dark:bg-emerald-900/30' 
                      : isInGroup 
                        ? 'bg-emerald-500/[0.02] dark:bg-emerald-400/[0.02]' 
                        : 'bg-white dark:bg-black/10')
                  }
                >
                  {displayedColumns.map((c, idx) => {
                    const normalizedCol = c.trim().toLowerCase();
                    const isDAM = normalizedCol === 'dam';
                    const isVideoCol = normalizedCol === 'video';
                    const isURL = normalizedCol === 'url';
                    const isContentStatus = isContentStatusFieldName(c);
                    const isEditableTag = normalizedCol === 'space' || normalizedCol === 'color' || normalizedCol === 'material' || normalizedCol === 'category';
                    const isCodeNumber = isCodeNumberColumn(normalizedCol);
                    const isBoldCol = normalizedCol === 'price' || normalizedCol === 'colecction name' || normalizedCol === 'collection name' || normalizedCol === 'name' || isCodeNumber;
                    let cellValue = r.fields?.[c];
                    const urlFieldValue = getUrlFieldValue(r.fields);
                    if (normalizedCol === 'image') {
                      cellValue = mergeUrlValues(urlFieldValue, r.fields?.[c], r.fields?.DAM);
                    } else if (isURL) {
                      cellValue = mergeUrlValues(urlFieldValue, r.fields?.Image, r.fields?.DAM);
                    } else if (isDAM || isVideoCol) {
                      cellValue = urlFieldValue;
                    }
                    
                    const isFirstCol = idx === 0;
                    const isLastCol = idx === displayedColumns.length - 1;
                    const isImageCol = normalizedCol === 'image';
                    const rowSelected = selectedIds.has(r.id);

                    return (
                      <td
                        key={c}
                        className={
                          listCellAlignClass() +
                          'relative transition-all max-sm:transition-none ' +
                          listColumnStackClass(normalizedCol, isFirstCol, rowSelected, isInGroup) +
                          (isFirstCol ? (isGroupStart ? `border-t-0 ` : '') : '') +
                          (isImageCol ? 'max-sm:overflow-hidden max-sm:!p-1 ' : '') +
                          (isInGroup && isFirstCol ? `border-l-2 ${groupBorderClass} ` : '') +
                          (isInGroup && isLastCol ? `border-r-2 ${groupBorderClass} ` : '') +
                          listColumnWidthClass(normalizedCol, isURL, isContentStatus) +
                          (isURL ? 'url-table-cell max-sm:!p-0 max-sm:overflow-hidden max-sm:align-top ' : '') +
                          (isURL || normalizedCol === 'variant number' ? 'overflow-hidden ' : '') +
                          (isCodeNumber ? 'max-sm:overflow-hidden ' : '') +
                          (isFirstCol
                            ? 'px-2 py-1 whitespace-pre-wrap text-xs sm:px-4 ' + (isBoldCol ? 'font-bold text-black dark:text-white' : 'text-black/80 dark:text-white/80')
                            : (isEditableTag
                                ? 'p-0'
                                : isContentStatus
                                  ? 'px-2 py-2 whitespace-nowrap text-xs'
                                : (isDAM
                                  ? 'px-1 py-1 whitespace-pre-wrap text-xs text-black/80 dark:text-white/80'
                                  : (isURL ? 'px-0 py-2.5 sm:py-3' : 'px-2 py-2.5 sm:px-4 sm:py-3') + ' whitespace-pre-wrap text-xs ' + (isBoldCol ? 'font-bold text-black dark:text-white' : 'text-black/80 dark:text-white/80'))))
                        }
                        onDragOver={(e) => {
                          if (isUrlReorderDragEvent(e)) return;
                          if (draggedUrlInfo && (isURL || isDAM || isVideoCol || normalizedCol === 'image')) {
                            e.preventDefault();
                            const target = e.currentTarget;
                            if (activeDropTargetRef.current !== target) {
                              activeDropTargetRef.current?.classList.remove('dnd-active');
                              target.classList.add('dnd-active');
                              activeDropTargetRef.current = target;
                            }
                          }
                        }}
                        onDragLeave={(e) => {
                          const target = e.currentTarget;
                          if (activeDropTargetRef.current === target) {
                            target.classList.remove('dnd-active');
                            activeDropTargetRef.current = null;
                          }
                        }}
                        onDrop={(e) => {
                          if (isUrlReorderDragEvent(e)) return;
                          if (draggedUrlInfo && (isURL || isDAM || isVideoCol || normalizedCol === 'image')) {
                            e.preventDefault();
                            e.currentTarget.classList.remove('dnd-active');
                            activeDropTargetRef.current = null;
                            handleMoveUrl(draggedUrlInfo.url, draggedUrlInfo.sourceId, r.id, c);
                            setDraggedUrlInfo(null);
                          }
                        }}
                        onClick={() => {
                          const colLower = c.trim().toLowerCase();
                          if (colLower === 'image' || isDAM) {
                            const u = extractUrls(cellValue)[0] ?? '';
                            const finalUrl = getDriveDirectLink(u) || u;
                            if (finalUrl) {
                              beginLightboxTrace('list-cell');
                              markLightboxTrace('click:handler');
                              openPreviewByUrl(finalUrl, r.id);
                            }
                            return;
                          }
                          toggleSelected(r.id);
                        }}
                      >
                        <CellChangeAudit
                          enabled={moderationMode}
                          recordId={r.id}
                          fieldName={c}
                          changeAudit={changeAudit}
                        >
                          {isCodeNumber ? (
                            <div className={codeNumberCellShellClass()}>{renderCell(c, cellValue, r.id)}</div>
                          ) : (
                            renderCell(c, cellValue, r.id)
                          )}
                        </CellChangeAudit>
                      </td>
                    );
                  })}
                  {canDelete ? (
                    <td className={
                      listCellAlignClass() +
                      'w-[92px] min-w-[92px] border-l border-black/5 px-2 py-2 dark:border-white/5 ' +
                      (selectedIds.has(r.id)
                        ? 'bg-emerald-50 dark:bg-emerald-900/30'
                        : isInGroup
                          ? 'bg-emerald-50/40 dark:bg-emerald-900/10'
                          : 'bg-white dark:bg-black/10')
                    }>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteProduct?.(r.id);
                        }}
                        className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-600 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300"
                        title="Delete product row"
                      >
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })
          )}
          {visibleRecords.length === 0 && !loading ? (
            <tr>
              <td className="px-2 py-32 text-center sm:px-4" colSpan={displayedColumns.length + (canDelete ? 1 : 0)}>
                <div className="flex flex-col items-center justify-center animate-fade-in">
                   <div className="h-16 w-16 items-center justify-center rounded-full bg-black/5 dark:bg-white/5 flex mb-4 text-black/20 dark:text-white/20">
                      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                   </div>
                   <h3 className="text-lg font-bold text-black dark:text-white">No products match your search</h3>
                   <p className="mt-1 text-sm text-black/40 dark:text-white/40">Try adjusting your filters or search terms.</p>
                </div>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {showLoadMoreSentinel && loadMore ? (
        <LoadMoreScrollSentinel sentinelRef={loadMore.sentinelRef} />
      ) : null}
      </div>
      </ListScrollRootContext.Provider>
      {showScrollFooter && loadMore ? (
        <LoadMoreFloatingIndicator
          pending={loadMore.pending}
          remainingCount={loadMore.remainingCount}
          atEnd={loadMore.scrollNearEnd && loadMore.remainingCount === 0}
          onJumpToTop={loadMore.onJumpToTop}
        />
      ) : null}
    </div>
  );
}
