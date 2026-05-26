import type { ProductsAssetsResponse, ProductsRecord } from '@/types/trainer';
import type * as React from 'react';

/* ─── Editing URL State ──────────────────────────────────────────────── */

export interface EditingUrlState {
  id: string;
  value: string;
  originalValue?: string;
  column?: string;
  index?: number | null;
  mode?: 'replace' | 'append' | 'prepend';
  rect?: { top: number; left: number; width: number; height: number };
}

/* ─── Link Hover Preview State ───────────────────────────────────────── */

export interface LinkHoverState {
  url: string;
  x: number;
  y: number;
  title: string;
  code: string;
  variant: string;
}

/* ─── Drag and Drop State ────────────────────────────────────────────── */

export interface DraggedUrlInfo {
  url: string;
  sourceId: string;
  sourceColumn: string;
}

/* ─── Gallery Item (enriched from ProductsRecord) ────────────────────── */

export interface GalleryMediaItem {
  originalUrl: string;
  url: string;
  driveId: string | null;
  isVideo: boolean;
}

export interface GalleryItem {
  id: string;
  fields: Record<string, unknown>;
  allMedia: GalleryMediaItem[];
  originalUrl: string;
  url: string;
  driveId: string | null;
  collectionName: string;
  collectionNameNormalized: string;
  title: string;
  code: string;
  variant: string;
  price: string | null;
  dimension: string;
  siblingCount?: number;
}

/* ─── Swipe Navigation Ref ───────────────────────────────────────────── */

export interface SwipeRefState {
  pointerId: number | null;
  startX: number;
  startY: number;
  moved: boolean;
  swiped: boolean;
}

/* ─── User Session ───────────────────────────────────────────────────── */

export interface UserSession {
  role: string;
  is_admin: boolean;
}

/* ─── Products Cache Provider ────────────────────────────────────────── */

export interface ProductsCacheContextValue {
  data: ProductsAssetsResponse | null;
  loading: boolean;
  error: string | null;
  /** True when the UI still shows cached/previous snapshot but the latest GET `/api/products/assets` failed (e.g. trainer/Mongo inactive). */
  isStaleOfflineSnapshot: boolean;
  setData: React.Dispatch<React.SetStateAction<ProductsAssetsResponse | null>>;
  mutate: (optimisticData?: ProductsAssetsResponse) => Promise<void>;
  /** Call synchronously before optimistic delete so pending-delete survives stale refetches. */
  notePendingDelete: (recordId: string) => void;
  /** Undo a pending-delete marker (e.g. failed DELETE or false positive). */
  clearPendingDelete: (recordId: string) => void;
  clearPendingDeletes: (recordIds: Iterable<string>) => void;
  /** Full cache snapshot without display-only overlays. */
  getRawSnapshot: () => ProductsAssetsResponse | null;
  /** Single serialized path for optimistic field edits. */
  applyCacheUpdate: (
    updater: (prev: ProductsAssetsResponse) => ProductsAssetsResponse,
  ) => Promise<ProductsAssetsResponse | null>;
  commitOptimisticSnapshot: (optimisticData: ProductsAssetsResponse) => Promise<void>;
}
