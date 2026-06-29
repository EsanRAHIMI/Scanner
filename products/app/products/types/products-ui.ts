import type { ProductsRecord } from '@/types/trainer';
import type * as React from 'react';
import type { FieldChangeAuditApi } from '../hooks/use-field-change-audit';
import type { EditingUrlState, DraggedUrlInfo } from './shared-types';

export interface ListViewProps {
  loading: boolean;
  records: ProductsRecord[];
  visibleRecords: ProductsRecord[];
  displayedColumns: string[];
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  toggleSort: (key: string) => void;
  sortKey: string | null;
  sortDir: 'asc' | 'desc';
  openPreviewByUrl: (url: string, recordId?: string) => void;
  setEditingUrl: (data: EditingUrlState | null) => void;
  handleMoveUrl: (url: string, sourceId: string, targetId: string, column: string) => void;
  handleReorderUrls: (recordId: string, fromIndex: number, toIndex: number) => void | Promise<void>;
  draggedUrlInfo: DraggedUrlInfo | null;
  setDraggedUrlInfo: (info: DraggedUrlInfo | null) => void;
  activeDropTargetRef: React.RefObject<HTMLElement | null>;
  linkHoverTimerRef: React.RefObject<NodeJS.Timeout | null>;
  familyMode: 'collection' | 'main';
  variantCounts: Record<string, number>;
  search: string;
  setLinkHoverState: (state: { url: string; x: number; y: number; title: string; code: string; variant: string } | null) => void;
  canEdit: boolean | undefined;
  /** Per-field edit permission (e.g. sales cannot edit price/code fields). */
  canEditField?: (fieldName: string) => boolean;
  canDelete?: boolean;
  handleDeleteProduct?: (id: string) => void;
  handleToggleMain?: (id: string) => void;
  handleSaveField?: (id: string, field: string, value: unknown) => void;
  handleSaveUrl: () => void;
  handleRemoveUrl: (recordId: string, url: string) => void | Promise<void>;
  handleHideMediaFromGallery: (recordId: string, url: string) => void | Promise<void>;
  handleUnhideMediaFromGallery: (recordId: string, url: string) => void | Promise<void>;
  columns: string[];
  editingUrl: EditingUrlState | null;
  isSaving: boolean;
  /** Optional ref for the scrollable list container (used to restore scroll after closing feed). */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  /** Infinite scroll: sentinel ref + floating bottom-right indicator. */
  loadMore?: {
    sentinelRef: React.RefObject<HTMLDivElement | null>;
    pending: boolean;
    remainingCount: number;
    scrollNearEnd: boolean;
    hasMoreOnServer?: boolean;
    serverLoading?: boolean;
    loadedCount?: number;
    visibleCount?: number;
    onJumpToTop: () => void;
  };
  /** Admin moderation: highlight cells with edit history. */
  moderationMode?: boolean;
  changeAudit?: FieldChangeAuditApi;
}

export interface GalleryCardProps {
  record: ProductsRecord;
  columns: string[];
  search: string;
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  openPreviewByUrl: (url: string) => void;
  familyMode: string;
  variantCounts: Record<string, number>;
}

export interface PhotoDeckProps {
  urls: string[];
  maxItems?: number;
  onOpenPreview?: (url: string, recordId?: string) => void;
  onDragStart?: (url: string) => void;
  onDragEnd?: () => void;
  linkHoverTimerRef?: React.RefObject<NodeJS.Timeout | null>;
  recordId?: string;
  column?: string;
  onMouseEnter?: (url: string, e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}
