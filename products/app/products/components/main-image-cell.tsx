'use client';

import * as React from 'react';

import {
  getDriveDirectLink,
  composedMainImageUrl,
  DRIVE_IMAGE_WIDTH_THUMB,
  DRIVE_IMAGE_WIDTH_FULL,
} from '../lib/product-utils';

/**
 * Table cell for the dedicated "Main Image" column.
 *
 * - Shows the current main image (if set) with a click-to-preview thumbnail.
 * - Is a drop target for URLs dragged from the `URL` media list (same row).
 * - Allows typing a URL, replacing, and removing — all via the standard
 *   field-save path (no special backend).
 */
export function MainImageCell({
  value,
  canEdit,
  onSet,
  onRemove,
  onPreview,
  getDroppedUrl,
}: {
  value: string;
  canEdit: boolean;
  onSet: (url: string) => void;
  onRemove: () => void;
  onPreview: (fullUrl: string) => void;
  /** Extract the dropped URL from a drag event (dataTransfer or dragged-url state). */
  getDroppedUrl: (e: React.DragEvent) => string;
}) {
  const [over, setOver] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [composedFailed, setComposedFailed] = React.useState(false);

  // Show the OFFICIAL composed image (cutout on the Lorenzo background); if the
  // compose service is unavailable, fall back to the raw cutout thumbnail.
  const rawThumb = value ? getDriveDirectLink(value, DRIVE_IMAGE_WIDTH_THUMB) : '';
  const composed = value ? composedMainImageUrl(value) : '';
  const thumb = composedFailed ? rawThumb : composed;

  React.useEffect(() => {
    setComposedFailed(false);
  }, [value]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!canEdit) return;
    const url = getDroppedUrl(e).trim();
    if (url) onSet(url);
  };

  const dropProps = canEdit
    ? {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          if (!over) setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: handleDrop,
      }
    : {};

  return (
    <div
      {...dropProps}
      className={`flex h-12 w-full items-center justify-center rounded-md transition-all ${
        over ? 'bg-emerald-500/10 ring-2 ring-emerald-500' : ''
      }`}
    >
      {value ? (
        <div className="group/main relative flex h-11 w-11 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt="main"
            className="h-11 w-11 cursor-zoom-in rounded-md object-contain ring-1 ring-black/10 dark:ring-white/10"
            referrerPolicy="no-referrer"
            draggable={false}
            onError={() => {
              if (!composedFailed) setComposedFailed(true);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onPreview(getDriveDirectLink(value, DRIVE_IMAGE_WIDTH_FULL));
            }}
          />
          {canEdit && (
            <button
              type="button"
              title="Remove main image"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover/main:opacity-100"
            >
              ✕
            </button>
          )}
        </div>
      ) : editing && canEdit ? (
        <input
          autoFocus
          value={draft}
          placeholder="Paste image URL…"
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            setDraft('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const url = draft.trim();
              if (url) onSet(url);
              setEditing(false);
              setDraft('');
            } else if (e.key === 'Escape') {
              setEditing(false);
              setDraft('');
            }
          }}
          className="h-9 w-full rounded-md border-2 border-emerald-500 bg-transparent px-2 text-[11px] outline-none dark:border-emerald-400"
        />
      ) : (
        <button
          type="button"
          disabled={!canEdit}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (canEdit) setEditing(true);
          }}
          className={`flex h-11 w-11 items-center justify-center rounded-md border border-dashed text-[9px] uppercase tracking-tight ${
            canEdit
              ? 'border-black/20 text-black/40 hover:border-emerald-500 hover:text-emerald-600 dark:border-white/20 dark:text-white/40'
              : 'border-black/10 text-black/25 dark:border-white/10 dark:text-white/25'
          }`}
          title={canEdit ? 'Drop a URL here or click to add' : 'No main image'}
        >
          {canEdit ? 'Drop' : '—'}
        </button>
      )}
    </div>
  );
}
