import type { ProductsRecord } from '@/types/trainer';
import type * as React from 'react';
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
  openPreviewByUrl: (url: string) => void;
  setEditingUrl: (data: EditingUrlState | null) => void;
  handleMoveUrl: (url: string, sourceId: string, targetId: string, column: string) => void;
  draggedUrlInfo: DraggedUrlInfo | null;
  setDraggedUrlInfo: (info: DraggedUrlInfo | null) => void;
  activeDropTargetRef: React.RefObject<HTMLElement | null>;
  linkHoverTimerRef: React.RefObject<NodeJS.Timeout | null>;
  familyMode: 'collection' | 'main';
  variantCounts: Record<string, number>;
  search: string;
  setLinkHoverState: (state: { url: string; x: number; y: number; title: string; code: string; variant: string } | null) => void;
  canEdit: boolean | undefined;
  handleSaveUrl: () => void;
  editingUrl: EditingUrlState | null;
  isSaving: boolean;
}

export interface GalleryCardProps {
  record: ProductsRecord;
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
  onOpenPreview?: (url: string) => void;
  onDragStart?: (url: string) => void;
  onDragEnd?: () => void;
  linkHoverTimerRef?: React.RefObject<NodeJS.Timeout | null>;
  recordId?: string;
  column?: string;
  onMouseEnter?: (url: string, e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}
