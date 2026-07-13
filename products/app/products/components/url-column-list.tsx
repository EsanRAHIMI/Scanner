'use client';

import * as React from 'react';
import {
  DRIVE_IMAGE_WIDTH_HOVER,
  DRIVE_IMAGE_WIDTH_THUMB,
  getDriveDirectLink,
  isGalleryMediaHidden,
  isVideoUrl,
} from '../lib/product-utils';
import { prefetchMediaPreview } from '../lib/media-preview-cache';
import { CachedMediaPreview } from './cached-media-preview';
import { useMediaLoadGate } from './media-load-provider';
import { useInView } from '../hooks/use-in-view';
import type { EditingUrlState, LinkHoverState } from '../types/shared-types';

const REORDER_MIME = 'application/x-url-reorder';

/** Mobile: `.url-cell-scroll` in globals.css caps height; table rows ignore td max-height. */
const URL_LIST_SCROLL_CLASS =
  'url-cell-scroll scrollbar-minimal flex min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-y-contain py-0.5 sm:max-h-[140px]';

type UrlSourceBadge = { kind: string; title: string } | null;

function reorderUrls(urls: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= urls.length || to >= urls.length) {
    return urls;
  }
  const next = [...urls];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function UrlThumb({ url, isHidden, mediaRowIndex }: { url: string; isHidden?: boolean; mediaRowIndex?: number }) {
  const [broken, setBroken] = React.useState(false);
  const isVideo = isVideoUrl(url);
  const { ref, inView } = useInView<HTMLDivElement>('40px 0px');
  const mediaGate = useMediaLoadGate(mediaRowIndex);
  const canLoad = inView && (mediaRowIndex === undefined || mediaGate);

  React.useEffect(() => {
    setBroken(false);
  }, [url]);

  return (
    <div ref={ref}>
    <div
      className={
        'relative h-7 w-7 shrink-0 overflow-hidden rounded border ' +
        (isHidden
          ? 'border-black/15 bg-black/[0.08] opacity-55 grayscale dark:border-white/15 dark:bg-white/[0.08]'
          : 'border-black/10 bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.06]')
      }
    >
      {!isVideo && !broken ? (
        <CachedMediaPreview
          url={url}
          width={DRIVE_IMAGE_WIDTH_THUMB}
          enabled={canLoad}
          onBroken={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className={
            'flex h-full w-full items-center justify-center ' +
            (isHidden ? 'bg-black/[0.10] dark:bg-white/[0.10]' : 'bg-black/[0.06] dark:bg-white/[0.08]')
          }
        >
          {isVideo ? (
            <svg viewBox="0 0 24 24" className="h-3 w-3 text-black/45 dark:text-white/45" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-3 w-3 text-black/30 dark:text-white/30" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="10.5" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          )}
        </div>
      )}
    </div>
    </div>
  );
}

function SourceIcon({ badge, isVideo }: { badge: UrlSourceBadge; isVideo: boolean }) {
  if (isVideo) {
    return (
      <svg viewBox="0 0 24 24" className="h-3 w-3 flex-none" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (badge?.kind === 'google') {
    return (
      <svg viewBox="0 0 24 24" className="h-3 w-3 flex-none" aria-label={badge.title}>
        <path d="M8.15 3.5h7.7l6.15 10.66h-7.68L8.15 3.5z" fill="#34A853" />
        <path d="M2 14.16 8.15 3.5l3.84 6.66-6.14 10.65L2 14.16z" fill="#FBBC04" />
        <path d="M5.85 20.81 9.68 14.16H22l-3.84 6.65H5.85z" fill="#4285F4" />
      </svg>
    );
  }
  if (badge?.kind === 'local') {
    return (
      <svg viewBox="0 0 24 24" className="h-3 w-3 flex-none text-emerald-600 dark:text-emerald-300" fill="none" stroke="currentColor" strokeWidth="2.4" aria-label={badge.title}>
        <path d="M5 4h14l2 6v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8l2-6z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 10h18" strokeLinecap="round" />
      </svg>
    );
  }
  if (badge?.kind === 'trainer') {
    return (
      <svg viewBox="0 0 24 24" className="h-3 w-3 flex-none text-amber-600 dark:text-amber-300" fill="none" stroke="currentColor" strokeWidth="2.3" aria-label={badge.title}>
        <rect x="4" y="4" width="16" height="5" rx="1.5" />
        <rect x="4" y="10" width="16" height="5" rx="1.5" />
        <rect x="4" y="16" width="16" height="4" rx="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 flex-none" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface UrlColumnListProps {
  recordId: string;
  column: string;
  urls: string[];
  canEdit: boolean;
  isSaving: boolean;
  recordFields: Record<string, unknown> | undefined;
  columns: string[];
  editingUrl: EditingUrlState | null;
  setEditingUrl: (state: EditingUrlState | null) => void;
  handleSaveUrl: () => void;
  handleHideMediaFromGallery: (recordId: string, url: string) => void | Promise<void>;
  handleUnhideMediaFromGallery: (recordId: string, url: string) => void | Promise<void>;
  handleReorderUrls: (recordId: string, fromIndex: number, toIndex: number) => void | Promise<void>;
  setDraggedUrlInfo: (info: { url: string; sourceId: string; sourceColumn: string } | null) => void;
  linkHoverTimerRef: React.RefObject<NodeJS.Timeout | null>;
  setLinkHoverState: (state: LinkHoverState | null) => void;
  getUrlSourceBadge: (url: string) => UrlSourceBadge;
  getCollectionMeta: (recordId: string) => { title: string; code: string; variant: string };
  mediaRowIndex?: number;
}

export const UrlColumnList = React.memo(function UrlColumnList({
  recordId,
  column,
  urls: urlsProp,
  canEdit,
  isSaving,
  recordFields,
  columns,
  editingUrl,
  setEditingUrl,
  handleSaveUrl,
  handleHideMediaFromGallery,
  handleUnhideMediaFromGallery,
  handleReorderUrls,
  setDraggedUrlInfo,
  linkHoverTimerRef,
  setLinkHoverState,
  getUrlSourceBadge,
  getCollectionMeta,
  mediaRowIndex,
}: UrlColumnListProps) {
  const mediaGate = useMediaLoadGate(mediaRowIndex);
  const [localUrls, setLocalUrls] = React.useState(urlsProp);
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);
  const [dropTarget, setDropTarget] = React.useState<number | null>(null);

  // Reconcile with server/cache when parent data changes (also corrects failed reorders after refresh).
  React.useEffect(() => {
    setLocalUrls((prev) => {
      if (prev.length === urlsProp.length && prev.every((u, i) => u === urlsProp[i])) return prev;
      return urlsProp;
    });
  }, [urlsProp]);

  const finishReorderDrag = React.useCallback(() => {
    setDragFrom(null);
    setDropTarget(null);
  }, []);

  const onGripDragStart = React.useCallback(
    (e: React.DragEvent, index: number, url: string) => {
      e.stopPropagation();
      if (linkHoverTimerRef.current) clearTimeout(linkHoverTimerRef.current);
      setLinkHoverState(null);
      setDragFrom(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(
        REORDER_MIME,
        JSON.stringify({ recordId, fromIndex: index }),
      );
      e.dataTransfer.setData('text/plain', url);
    },
    [recordId, linkHoverTimerRef, setLinkHoverState],
  );

  const onRowDragOver = React.useCallback(
    (e: React.DragEvent, index: number) => {
      if (!e.dataTransfer.types.includes(REORDER_MIME)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setDropTarget((prev) => (prev === index ? prev : index));
    },
    [],
  );

  const onListDragOver = React.useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(REORDER_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /** Cancel in-row reorder when the pointer releases over list padding (not on a row). */
  const onListDrop = React.useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(REORDER_MIME)) return;
      e.preventDefault();
      e.stopPropagation();
      finishReorderDrag();
    },
    [finishReorderDrag],
  );

  const onRowDrop = React.useCallback(
    (e: React.DragEvent, toIndex: number) => {
      if (!e.dataTransfer.types.includes(REORDER_MIME)) return;
      e.preventDefault();
      e.stopPropagation();

      try {
        let fromIndex = dragFrom;
        try {
          const payload = JSON.parse(e.dataTransfer.getData(REORDER_MIME)) as {
            recordId?: string;
            fromIndex?: number;
          };
          if (payload.recordId !== recordId) return;
          if (typeof payload.fromIndex === 'number') fromIndex = payload.fromIndex;
        } catch {
          return;
        }
        if (fromIndex === null || fromIndex === toIndex) return;

        const previousUrls = localUrls;
        const optimisticNext = reorderUrls(previousUrls, fromIndex, toIndex);
        setLocalUrls(optimisticNext);
        void (async () => {
          try {
            await handleReorderUrls(recordId, fromIndex, toIndex);
          } catch {
            // Roll back only if no newer local reorder (or server sync) changed the list.
            setLocalUrls((current) =>
              current === optimisticNext ? previousUrls : current,
            );
          }
        })();
      } finally {
        // Wrong row, bad payload, or no-op drop — still clear grip opacity and drop line.
        finishReorderDrag();
      }
    },
    [dragFrom, finishReorderDrag, handleReorderUrls, localUrls, recordId],
  );

  return (
    <div className={URL_LIST_SCROLL_CLASS} onDragOver={onListDragOver} onDrop={onListDrop}>
      {editingUrl?.id === recordId &&
      (editingUrl.column === column || !editingUrl.column) &&
      (editingUrl.mode === 'prepend' || (!editingUrl.mode && editingUrl.index === undefined)) ? (
        <div className="relative z-50 flex min-w-0 items-center gap-1 bg-white pl-1 pr-1 dark:bg-black">
          <input
            className="min-w-0 flex-1 rounded border-2 border-emerald-500 bg-transparent px-2 py-1 text-[11px] font-medium leading-relaxed outline-none dark:border-emerald-400"
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
              onClick={(e) => {
                e.stopPropagation();
                handleSaveUrl();
              }}
              className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditingUrl(null);
              }}
              className="flex h-6 w-6 items-center justify-center rounded bg-black/10 text-black/60 hover:bg-black/20 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {localUrls.map((u, i) => {
        const isHiddenFromGallery = isGalleryMediaHidden(u, recordFields, columns);
        const isBeingEdited =
          editingUrl?.id === recordId &&
          (editingUrl.column === column || !editingUrl.column) &&
          editingUrl.index === i;
        const sourceBadge = getUrlSourceBadge(u);
        const isDragging = dragFrom === i;
        const showDropLine = dropTarget === i && dragFrom !== null && dragFrom !== i;
        const meta = getCollectionMeta(recordId);

        if (isBeingEdited && editingUrl) {
          return (
            <div key={`${recordId}-edit-${i}`} className="relative z-50 flex min-w-0 items-center gap-1 bg-white pl-1 pr-1 dark:bg-black">
              <input
                className="min-w-0 flex-1 rounded border-2 border-emerald-500 bg-transparent px-2 py-1 text-[11px] font-medium leading-relaxed outline-none dark:border-emerald-400"
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveUrl();
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  title="Hide from Image and Feed (link stays in URL)"
                  onClick={(e) => {
                    e.stopPropagation();
                    const target = editingUrl.originalValue ?? u;
                    void handleHideMediaFromGallery(recordId, target);
                    setEditingUrl(null);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded bg-red-500/15 text-red-600 hover:bg-red-500/25 disabled:opacity-50 dark:text-red-400"
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
          <div
            key={`${recordId}-${i}-${u}`}
            className={
              'group/link relative ' +
              (isDragging ? 'opacity-35 ' : '') +
              (isHiddenFromGallery ? 'rounded-md bg-black/[0.03] dark:bg-white/[0.04] ' : '')
            }
            onDragOver={(e) => onRowDragOver(e, i)}
            onDrop={(e) => onRowDrop(e, i)}
          >
            {showDropLine ? (
              <div className="pointer-events-none absolute inset-x-1 top-0 z-10 h-0.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(123,31,68,0.55)]" />
            ) : null}
            <div className="flex min-w-0 items-center gap-0.5 pl-0.5 pr-0.5">
              {canEdit && localUrls.length > 1 ? (
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => onGripDragStart(e, i, u)}
                  onDragEnd={finishReorderDrag}
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center rounded text-black/20 opacity-0 transition-opacity hover:text-black/45 active:cursor-grabbing group-hover/link:opacity-100 dark:text-white/20 dark:hover:text-white/50"
                  title="Drag to reorder"
                  aria-label={`Reorder image ${i + 1}`}
                >
                  <svg viewBox="0 0 8 14" className="h-3.5 w-2" fill="currentColor" aria-hidden>
                    <circle cx="2" cy="2" r="1" />
                    <circle cx="6" cy="2" r="1" />
                    <circle cx="2" cy="7" r="1" />
                    <circle cx="6" cy="7" r="1" />
                    <circle cx="2" cy="12" r="1" />
                    <circle cx="6" cy="12" r="1" />
                  </svg>
                </button>
              ) : (
                <span
                  className={
                    'w-4 shrink-0 text-center text-[9px] font-bold tabular-nums ' +
                    (isHiddenFromGallery ? 'text-black/20 dark:text-white/20' : 'text-black/25 dark:text-white/25')
                  }
                >
                  {i + 1}
                </span>
              )}

              <UrlThumb url={u} isHidden={isHiddenFromGallery} mediaRowIndex={mediaRowIndex} />

              <a
                href={getDriveDirectLink(u)}
                target="_blank"
                rel="noreferrer"
                draggable
                className={
                  'min-w-0 flex-1 truncate py-1 text-[10px] font-semibold tracking-tight ' +
                  (isHiddenFromGallery
                    ? 'text-black/35 hover:text-black/45 dark:text-white/35 dark:hover:text-white/45'
                    : 'text-black/80 hover:text-emerald-600 dark:text-white/80 dark:hover:text-emerald-400')
                }
                onClick={(e) => e.stopPropagation()}
                onDragStart={(e) => {
                  e.stopPropagation();
                  setDraggedUrlInfo({ url: u, sourceId: recordId, sourceColumn: column });
                }}
                onDragEnd={(e) => {
                  e.stopPropagation();
                  setDraggedUrlInfo(null);
                }}
                onMouseEnter={(e) => {
                  if (mediaGate) void prefetchMediaPreview(u, DRIVE_IMAGE_WIDTH_HOVER);
                  if (linkHoverTimerRef.current) clearTimeout(linkHoverTimerRef.current);
                  linkHoverTimerRef.current = setTimeout(() => {
                    setLinkHoverState({
                      url: u,
                      x: e.clientX,
                      y: e.clientY,
                      ...meta,
                    });
                  }, 300);
                }}
                onMouseLeave={() => {
                  if (linkHoverTimerRef.current) clearTimeout(linkHoverTimerRef.current);
                  setLinkHoverState(null);
                }}
              >
                <span
                  className={
                    'inline-flex min-w-0 items-center gap-1 ' +
                    (isHiddenFromGallery ? 'opacity-80 grayscale' : '')
                  }
                >
                  <SourceIcon badge={sourceBadge} isVideo={isVideoUrl(u)} />
                  <span className="truncate">{u}</span>
                  {isHiddenFromGallery ? (
                    <span className="shrink-0 rounded bg-black/10 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-black/45 dark:bg-white/10 dark:text-white/45">
                      Hidden
                    </span>
                  ) : null}
                </span>
              </a>

              {canEdit ? (
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/link:opacity-100">
                  {isHiddenFromGallery ? (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleUnhideMediaFromGallery(recordId, u);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-30 dark:text-emerald-300"
                      title="Show again in Image and Feed"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleHideMediaFromGallery(recordId, u);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/20 disabled:opacity-30 dark:text-red-400"
                      title="Hide from Image and Feed (link stays in URL)"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingUrl({ id: recordId, value: u, originalValue: u, column, index: i });
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-black/5 text-black/40 hover:bg-black/10 dark:bg-white/5 dark:text-white/40 dark:hover:bg-white/10"
                    title="Edit this link"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
});

UrlColumnList.displayName = 'UrlColumnList';

/** Used by list cells to ignore in-row reorder drags for cross-row drop targets. */
export const URL_REORDER_MIME = REORDER_MIME;

export function isUrlReorderDragEvent(e: React.DragEvent): boolean {
  return e.dataTransfer.types.includes(REORDER_MIME);
}
