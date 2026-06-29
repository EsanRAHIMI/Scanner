'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';

import { apiFetch } from '@/lib/api';
import { useProductsCache } from '../../products-cache-provider';
import { formatPrice, formatScalar, rewriteLegacyAppDomainInUrl } from '../lib/product-utils';
import type { ProductsRecord } from '@/types/trainer';

type ProductImportBatch = {
  id: string;
  filename: string;
  status: string;
  row_count: number;
  warnings_count: number;
  created_at: string;
  columns: string[];
  sheets?: Array<{ name: string; header_row: number; row_count: number }>;
};

type ProductImportRow = {
  id: string;
  fields: Record<string, unknown>;
  warnings: string[];
  status: string;
  source_sheet?: string;
  source_row_number?: number;
};

type ImportsResponse = {
  imports: ProductImportBatch[];
};

type ImportRowsResponse = {
  import: ProductImportBatch;
  columns: string[];
  records: ProductImportRow[];
  count: number;
};

type ApplyImportResponse = {
  ok: boolean;
  created_count: number;
  updated_count: number;
  unchanged_count: number;
  skipped_count?: number;
  changed_cells_count: number;
  apply_row_groups?: ImportRowMatchStatus[];
  rows_processed_by_group?: Partial<Record<ImportRowMatchStatus, number>>;
  rows_skipped_by_group?: Partial<Record<ImportRowMatchStatus, number>>;
};

type ImportRowMatchStatus = 'matched' | 'unmatched' | 'empty';

type ReprocessImportResponse = {
  ok: boolean;
  processed_count: number;
  changed_count: number;
};

type MatchPreviewSample = {
  row_id: string;
  product_id?: string;
  import_value?: string | null;
  product_value?: string;
  reason?: string;
  source_sheet?: string;
  source_row_number?: number;
};

type MatchPreviewResponse = {
  ok: boolean;
  match: { import_column: string; product_column: string };
  total_rows: number;
  matched_count: number;
  unmatched_count: number;
  empty_import_value_count: number;
  row_statuses?: Record<string, ImportRowMatchStatus>;
  matched_samples: MatchPreviewSample[];
  unmatched_samples: MatchPreviewSample[];
  empty_samples?: MatchPreviewSample[];
};

const ALL_ROW_GROUPS: ImportRowMatchStatus[] = ['matched', 'unmatched', 'empty'];

const DEFAULT_SELECTED_ROW_GROUPS: ImportRowMatchStatus[] = ALL_ROW_GROUPS;

const IMPORT_TABLE_COLUMN_ORDER = [
  'Image1',
  'Image',
  'DAM',
  'Video',
  'Price',
  'URL',
  'Collection Name',
  'Colecction Name',
  'Collection Code',
  'Colecction Code',
  'Variant Number',
  'Category',
  'Space',
  'Color',
  'Material',
  'DIMENSION (mm)',
  'Note',
  'Details',
  'CODE NUMBER',
  'L000',
  'Num',
  'Main',
  'Content Calendar',
  'Factory Code',
];

function collectImportColumnsFromRows(records: ProductImportRow[]): string[] {
  const present = new Set<string>();
  for (const row of records) {
    for (const key of Object.keys(row.fields ?? {})) {
      if (key !== 'Row') present.add(key);
    }
  }
  return [
    ...IMPORT_TABLE_COLUMN_ORDER.filter(column => present.has(column)),
    ...[...present]
      .filter(column => !IMPORT_TABLE_COLUMN_ORDER.includes(column))
      .sort((a, b) => a.localeCompare(b)),
  ];
}

const COMPACT_SELECT_CLASS =
  'h-8 min-w-0 flex-1 rounded-lg border border-black/10 bg-black/[0.02] px-2 text-xs font-semibold text-black outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white sm:max-w-[180px]';

const ROW_MATCH_STATUS_LABELS: Record<ImportRowMatchStatus, string> = {
  matched: 'Matched',
  unmatched: 'Unmatched',
  empty: 'Empty',
};

const ROW_MATCH_ROW_CLASS: Record<ImportRowMatchStatus, string> = {
  matched:
    'border-green-500/25 bg-green-500/10 text-green-800 dark:border-green-400/20 dark:bg-green-500/15 dark:text-green-200',
  unmatched:
    'border-amber-500/25 bg-amber-500/10 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/15 dark:text-amber-200',
  empty:
    'border-red-500/25 bg-red-500/10 text-red-800 dark:border-red-400/20 dark:bg-red-500/15 dark:text-red-200',
};

const ROW_MATCH_BADGE_CLASS: Record<ImportRowMatchStatus, string> = {
  matched: 'bg-green-600 text-white',
  unmatched: 'bg-amber-500 text-white',
  empty: 'bg-red-600 text-white',
};

const NEUTRAL_ROW_CLASS =
  'border-black/5 text-black/70 dark:border-white/5 dark:text-white/70';

type EditingCell = {
  rowId: string;
  column: string;
  value: string;
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const res = await apiFetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Request failed (${res.status})`);
  return JSON.parse(text) as T;
};

const IMPORT_ROWS_LIMIT = 5000;

function formatDate(value: string | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function renderCell(value: unknown, column?: string) {
  if (column?.trim().toLowerCase() === 'price') {
    return formatPrice(value) ?? (formatScalar(value) || '—');
  }
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (Array.isArray(value)) return value.map(formatScalar).filter(Boolean).join(', ');
  return formatScalar(value) || '—';
}

function isImageColumn(column: string) {
  const normalized = column.trim().toLowerCase();
  return normalized === 'image1' || normalized === 'image' || normalized.startsWith('image ');
}

function resolveImportAssetUrl(value: unknown) {
  const raw = formatScalar(value).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/api/trainer/')) {
    return rewriteLegacyAppDomainInUrl(raw);
  }
  if (raw.startsWith('/files/')) return `/api/trainer${raw}`;
  return raw;
}

function normalizeComparable(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const text = Array.isArray(value)
    ? value.map(formatScalar).filter(Boolean).join(', ')
    : formatScalar(value);
  const trimmed = text.trim();
  const numeric = trimmed.replace(/,/g, '');
  if (/^-?\d+(\.\d+)?$/.test(numeric)) {
    const number = Number(numeric);
    if (Number.isFinite(number)) return String(number);
  }
  return trimmed.replace(/\s+/g, ' ').toLowerCase();
}

function getFirstField(fields: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = fields[name];
    if (normalizeComparable(value)) return value;
  }
  return '';
}

function getEquivalentFieldValue(fields: Record<string, unknown>, column: string) {
  const lower = column.trim().toLowerCase();
  const aliases: Record<string, string[]> = {
    'colecction name': ['Collection Name', 'Colecction Name', 'Name'],
    'collection name': ['Collection Name', 'Colecction Name', 'Name'],
    name: ['Collection Name', 'Colecction Name', 'Name'],
    'colecction code': ['Collection Code', 'Colecction Code', 'Code'],
    'collection code': ['Collection Code', 'Colecction Code', 'Code'],
    code: ['Collection Code', 'Colecction Code', 'Code'],
    'variant number': ['Variant Number', 'Variant', 'Num'],
    variant: ['Variant Number', 'Variant', 'Num'],
    num: ['Num', 'Variant Number', 'Variant'],
    'code number': ['CODE NUMBER', 'Code Number', 'Code No'],
    'dimension (cm)': ['DIMENSION (cm)', 'Dimension (cm)', 'DIMENSION (mm)', 'Dimension (mm)', 'DIMENSION', 'Dimension', 'Dimensions', 'Size'],
    'dimension (mm)': ['DIMENSION (cm)', 'Dimension (cm)', 'DIMENSION (mm)', 'Dimension (mm)', 'DIMENSION', 'Dimension', 'Dimensions', 'Size'],
  };
  return getFirstField(fields, aliases[lower] ?? [column]);
}

function buildProductIndexByColumn(records: ProductsRecord[], productColumn: string) {
  const index = new Map<string, ProductsRecord>();
  for (const record of records) {
    const value = normalizeComparable(getEquivalentFieldValue(record.fields ?? {}, productColumn));
    if (value && !index.has(value)) index.set(value, record);
  }
  return index;
}

function findExistingProductByColumn(
  row: ProductImportRow,
  index: Map<string, ProductsRecord>,
  importColumn: string,
) {
  const value = normalizeComparable(getEquivalentFieldValue(row.fields ?? {}, importColumn));
  if (!value) return null;
  return index.get(value) ?? null;
}

function fieldMatchesExisting(rowValue: unknown, existingFields: Record<string, unknown>, column: string) {
  const left = normalizeComparable(rowValue);
  if (!left) return false;
  const right = normalizeComparable(getEquivalentFieldValue(existingFields, column));
  return Boolean(right) && left === right;
}

function classifyImportRowMatchStatus(
  row: ProductImportRow,
  productIndex: Map<string, ProductsRecord>,
  importColumn: string,
): ImportRowMatchStatus {
  const value = normalizeComparable(getEquivalentFieldValue(row.fields ?? {}, importColumn));
  if (!value) return 'empty';
  if (productIndex.has(value)) return 'matched';
  return 'unmatched';
}

function buildRowStatusMap(
  rows: ProductImportRow[],
  productIndex: Map<string, ProductsRecord>,
  importColumn: string,
  previewStatuses?: Record<string, ImportRowMatchStatus>,
) {
  const map = new Map<string, ImportRowMatchStatus>();
  for (const row of rows) {
    const fromPreview = previewStatuses?.[row.id];
    map.set(
      row.id,
      fromPreview ?? classifyImportRowMatchStatus(row, productIndex, importColumn),
    );
  }
  return map;
}

export default function ProductImportsPage() {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [selectedImportId, setSelectedImportId] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [editingCell, setEditingCell] = React.useState<EditingCell | null>(null);
  const [savingCellKey, setSavingCellKey] = React.useState<string | null>(null);
  const [isApplying, setIsApplying] = React.useState(false);
  const [isReprocessing, setIsReprocessing] = React.useState(false);
  const [selectedTransferColumns, setSelectedTransferColumns] = React.useState<Set<string>>(new Set());
  const [matchImportColumn, setMatchImportColumn] = React.useState('');
  const [matchProductColumn, setMatchProductColumn] = React.useState('');
  const [matchPreview, setMatchPreview] = React.useState<MatchPreviewResponse | null>(null);
  const [matchPreviewError, setMatchPreviewError] = React.useState<string | null>(null);
  const [isPreviewingMatch, setIsPreviewingMatch] = React.useState(false);
  const [selectedRowGroups, setSelectedRowGroups] = React.useState<Set<ImportRowMatchStatus>>(
    () => new Set(DEFAULT_SELECTED_ROW_GROUPS),
  );
  const initializedTransferColumnsForImportRef = React.useRef<string | null>(null);
  const initializedMatchColumnsForImportRef = React.useRef<string | null>(null);
  const saveInFlightRef = React.useRef(false);
  const { data: productsData, mutate: mutateProducts } = useProductsCache();

  const {
    data: importsData,
    error: importsError,
    isLoading: importsLoading,
    mutate: mutateImports,
  } = useSWR<ImportsResponse>('/admin/products/imports', fetchJson);

  const imports = importsData?.imports ?? [];
  const selectedImportExists = selectedImportId
    ? imports.some(item => item.id === selectedImportId)
    : false;
  const activeImportId = selectedImportExists ? selectedImportId : imports[0]?.id ?? null;

  const {
    data: rowsData,
    error: rowsError,
    isLoading: rowsLoading,
    mutate: mutateRows,
  } = useSWR<ImportRowsResponse>(
    activeImportId ? `/admin/products/imports/${activeImportId}/rows?limit=${IMPORT_ROWS_LIMIT}` : null,
    fetchJson
  );

  React.useEffect(() => {
    if (imports.length === 0) {
      if (selectedImportId) setSelectedImportId(null);
      return;
    }
    if (!selectedImportId || !imports.some(item => item.id === selectedImportId)) {
      setSelectedImportId(imports[0].id);
    }
  }, [imports, selectedImportId]);

  const uploadFile = async () => {
    if (!selectedFile || isUploading) return;
    setIsUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set('file', selectedFile);
      const res = await apiFetch('/admin/products/imports/upload', {
        method: 'POST',
        body: formData,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Upload failed');
      const json = JSON.parse(text) as { import?: ProductImportBatch };
      setSelectedImportId(json.import?.id ?? null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await mutateImports();
      await mutateRows();
      setMessage('File uploaded and converted to a new import list.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteImport = async () => {
    if (!activeImportId) return;
    const ok = window.confirm('Delete this import staging? The main products table will not be changed.');
    if (!ok) return;
    setMessage(null);
    try {
      const res = await apiFetch(`/admin/products/imports/${activeImportId}`, { method: 'DELETE' });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Delete failed');
      setSelectedImportId(null);
      await mutateImports();
      await mutateRows(undefined, { revalidate: false });
      setMessage('Import deleted.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const startEditingCell = React.useCallback((row: ProductImportRow, column: string) => {
    setEditingCell({
      rowId: row.id,
      column,
      value: renderCell(row.fields[column], column) === '—' ? '' : String(renderCell(row.fields[column], column)),
    });
  }, []);

  const cancelEditingCell = React.useCallback(() => {
    setEditingCell(null);
  }, []);

  const previewMatch = React.useCallback(async () => {
    if (!activeImportId || !matchImportColumn || !matchProductColumn) return;
    setIsPreviewingMatch(true);
    setMatchPreviewError(null);
    try {
      const res = await apiFetch(`/admin/products/imports/${activeImportId}/preview-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match: {
            import_column: matchImportColumn,
            product_column: matchProductColumn,
          },
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Match preview failed');
      setMatchPreview(JSON.parse(text) as MatchPreviewResponse);
    } catch (err) {
      setMatchPreview(null);
      setMatchPreviewError(err instanceof Error ? err.message : 'Match preview failed');
    } finally {
      setIsPreviewingMatch(false);
    }
  }, [activeImportId, matchImportColumn, matchProductColumn]);

  const saveEditingCell = React.useCallback(async () => {
    if (!editingCell || !activeImportId || saveInFlightRef.current) return;

    const { rowId, column, value } = editingCell;
    const cellKey = `${rowId}:${column}`;
    const previousData = rowsData;

    saveInFlightRef.current = true;
    setSavingCellKey(cellKey);
    setEditingCell(null);

    await mutateRows(current => {
      if (!current) return current;
      return {
        ...current,
        records: current.records.map(row =>
          row.id === rowId
            ? { ...row, fields: { ...row.fields, [column]: value } }
            : row
        ),
      };
    }, { revalidate: false });

    try {
      const res = await apiFetch(`/admin/products/imports/${activeImportId}/rows/${rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: column, value }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Cell update failed');
      const updatedRow = JSON.parse(text) as ProductImportRow;

      await mutateRows(current => {
        if (!current) return current;
        return {
          ...current,
          records: current.records.map(row => row.id === rowId ? updatedRow : row),
        };
      }, { revalidate: false });
      if (matchImportColumn && matchProductColumn) {
        void previewMatch();
      }
    } catch (err) {
      await mutateRows(previousData, { revalidate: false });
      setMessage(err instanceof Error ? err.message : 'Cell update failed');
    } finally {
      setSavingCellKey(null);
      saveInFlightRef.current = false;
    }
  }, [activeImportId, editingCell, matchImportColumn, matchProductColumn, mutateRows, previewMatch, rowsData]);

  const applyImportToProducts = React.useCallback(async () => {
    if (!activeImportId || isApplying) return;
    if (!matchImportColumn || !matchProductColumn) {
      setMessage('Choose import and product columns to match rows before applying.');
      return;
    }
    const selectedColumns = Array.from(selectedTransferColumns);
    if (selectedColumns.length === 0) {
      setMessage('Select at least one column to transfer to Products.');
      return;
    }
    if (selectedRowGroups.size === 0) {
      setMessage('Select at least one row group (Matched, Unmatched, or Empty).');
      return;
    }
    const groupLabels = Array.from(selectedRowGroups).map(group => ROW_MATCH_STATUS_LABELS[group]).join(', ');
    const rowsToApply = matchPreview
      ? Array.from(selectedRowGroups).reduce((sum, group) => {
          if (group === 'matched') return sum + matchPreview.matched_count;
          if (group === 'unmatched') return sum + matchPreview.unmatched_count;
          return sum + matchPreview.empty_import_value_count;
        }, 0)
      : null;
    const rowsSkipped = matchPreview
      ? (matchPreview.matched_count + matchPreview.unmatched_count + matchPreview.empty_import_value_count) -
        (rowsToApply ?? 0)
      : null;
    const ok = window.confirm(
      `Apply this import to the main Products table?\n\n` +
        `Match: "${matchImportColumn}" → "${matchProductColumn}"\n` +
        `Apply only: ${groupLabels}\n` +
        (rowsToApply !== null
          ? `Rows to process: ${rowsToApply.toLocaleString('en-US')}` +
            (rowsSkipped ? ` · ${rowsSkipped.toLocaleString('en-US')} skipped (not ticked)\n` : '\n')
          : '') +
        `Transfer columns (${selectedColumns.length}): ${selectedColumns.join(', ')}\n\n` +
        'Only ticked row groups and Transfer columns are written. Matched rows update existing products; unmatched/empty rows create new products when included. Continue?'
    );
    if (!ok) return;

    setIsApplying(true);
    setMessage(null);
    try {
      const res = await apiFetch(`/admin/products/imports/${activeImportId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns: selectedColumns,
          match: {
            import_column: matchImportColumn,
            product_column: matchProductColumn,
          },
          apply_row_groups: Array.from(selectedRowGroups),
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Apply import failed');
      const result = JSON.parse(text) as ApplyImportResponse;
      await mutateRows();
      await mutateImports();
      await mutateProducts();
      const processedSummary = result.rows_processed_by_group
        ? Object.entries(result.rows_processed_by_group)
            .filter(([, count]) => (count ?? 0) > 0)
            .map(([group, count]) => `${ROW_MATCH_STATUS_LABELS[group as ImportRowMatchStatus]} ${count}`)
            .join(', ')
        : '';
      setMessage(
        `Transfer complete: ${result.created_count} new, ${result.updated_count} updated, ` +
          `${result.changed_cells_count} cell(s) changed, ${result.unchanged_count} unchanged` +
          (result.skipped_count ? `, ${result.skipped_count} row(s) skipped (not in selected groups)` : '') +
          (processedSummary ? ` · processed: ${processedSummary}` : '') +
          '.'
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Apply import failed');
    } finally {
      setIsApplying(false);
    }
  }, [
    activeImportId,
    isApplying,
    matchImportColumn,
    selectedRowGroups,
    matchPreview,
    matchProductColumn,
    mutateImports,
    mutateProducts,
    mutateRows,
    selectedTransferColumns,
  ]);

  const reprocessImportRows = React.useCallback(async () => {
    if (!activeImportId || isReprocessing) return;
    setIsReprocessing(true);
    setMessage(null);
    try {
      const res = await apiFetch(`/admin/products/imports/${activeImportId}/reprocess`, {
        method: 'POST',
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Refresh formulas failed');
      const result = JSON.parse(text) as ReprocessImportResponse;
      await mutateRows();
      if (matchImportColumn && matchProductColumn) {
        void previewMatch();
      }
      setMessage(`Formulas rechecked: ${result.changed_count} of ${result.processed_count} row(s) updated.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Refresh formulas failed');
    } finally {
      setIsReprocessing(false);
    }
  }, [activeImportId, isReprocessing, matchImportColumn, matchProductColumn, mutateRows, previewMatch]);

  const importColumns = React.useMemo(
    () => (rowsData ? collectImportColumnsFromRows(rowsData.records) : []),
    [rowsData],
  );
  const matchImportColumnOptions = React.useMemo(() => {
    const extra =
      matchImportColumn && matchImportColumn !== 'Row' && !importColumns.includes(matchImportColumn)
        ? [matchImportColumn]
        : [];
    return ['Row', ...importColumns, ...extra];
  }, [importColumns, matchImportColumn]);
  const productColumns = React.useMemo(() => {
    const fromCache = productsData?.columns ?? [];
    if (fromCache.length > 0) return fromCache;
    return [
      'Image',
      'CODE NUMBER',
      'Collection Name',
      'Colecction Name',
      'Collection Code',
      'Colecction Code',
      'Variant Number',
      'Num',
      'Price',
      'Category',
      'Space',
      'Color',
      'Material',
      'DIMENSION (mm)',
      'Factory Code',
      'Note',
      'Details',
      'URL',
      'Main',
    ];
  }, [productsData?.columns]);
  const existingProductIndex = React.useMemo(() => {
    if (!matchProductColumn) return new Map<string, ProductsRecord>();
    return buildProductIndexByColumn(productsData?.records ?? [], matchProductColumn);
  }, [matchProductColumn, productsData?.records]);
  const rowStatusById = React.useMemo(() => {
    if (!rowsData || !matchImportColumn || !matchProductColumn) {
      return new Map<string, ImportRowMatchStatus>();
    }
    return buildRowStatusMap(
      rowsData.records,
      existingProductIndex,
      matchImportColumn,
      matchPreview?.row_statuses,
    );
  }, [existingProductIndex, matchImportColumn, matchPreview?.row_statuses, matchProductColumn, rowsData]);

  const rowStatusCounts = React.useMemo(() => {
    const counts = { matched: 0, unmatched: 0, empty: 0 };
    for (const status of rowStatusById.values()) {
      counts[status] += 1;
    }
    return counts;
  }, [rowStatusById]);

  const isMatchConfigured = Boolean(matchImportColumn && matchProductColumn);

  const filteredImportRows = React.useMemo(() => {
    if (!rowsData || selectedRowGroups.size === 0) return [];
    if (!isMatchConfigured) return rowsData.records;
    return rowsData.records.filter(row => {
      const status = rowStatusById.get(row.id);
      return status ? selectedRowGroups.has(status) : false;
    });
  }, [isMatchConfigured, rowStatusById, rowsData, selectedRowGroups]);
  const visibleColumns = importColumns;

  React.useEffect(() => {
    if (!activeImportId || importColumns.length === 0) return;
    if (initializedTransferColumnsForImportRef.current === activeImportId) return;
    initializedTransferColumnsForImportRef.current = activeImportId;
    setSelectedTransferColumns(new Set());
  }, [activeImportId, importColumns]);

  React.useEffect(() => {
    if (!activeImportId || importColumns.length === 0 || productColumns.length === 0) return;
    if (initializedMatchColumnsForImportRef.current === activeImportId) return;
    initializedMatchColumnsForImportRef.current = activeImportId;
    setMatchImportColumn('');
    setMatchProductColumn('');
    setMatchPreview(null);
    setMatchPreviewError(null);
    setSelectedRowGroups(new Set(ALL_ROW_GROUPS));
  }, [activeImportId, productColumns, importColumns]);

  const toggleRowGroup = React.useCallback((group: ImportRowMatchStatus) => {
    setSelectedRowGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!matchImportColumn || !matchProductColumn || !activeImportId) {
      setMatchPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      void previewMatch();
    }, 400);
    return () => clearTimeout(timer);
  }, [activeImportId, matchImportColumn, matchProductColumn, previewMatch, rowsData?.count]);

  const toggleTransferColumn = React.useCallback((column: string) => {
    setSelectedTransferColumns(prev => {
      const next = new Set(prev);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden animate-fade-in">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-brand-medium-gray/30 pb-2 dark:border-white/10">
        <Link href="/dashboard" className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
          Dashboard
        </Link>
        <span className="text-black/20 dark:text-white/20">/</span>
        <Link href="/products" className="text-[10px] font-black uppercase tracking-widest text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white">
          Products
        </Link>
        <span className="text-black/20 dark:text-white/20">/</span>
        <h1 className="text-sm font-black tracking-tight text-black dark:text-white">
          Excel Imports
        </h1>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col gap-3 rounded-2xl border border-brand-medium-gray/30 bg-brand-white p-3 shadow-brand-card dark:border-white/10 dark:bg-black/25">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-black/50 dark:text-white/50">
            Upload
          </h2>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm,.numbers,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,application/x-iwork-numbers-sffnumbers"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            className="block w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs font-medium text-black outline-none file:mr-3 file:rounded-full file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:text-white dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:file:bg-white dark:file:text-black"
          />

          <button
            type="button"
            onClick={() => void uploadFile()}
            disabled={!selectedFile || isUploading}
            className="rounded-full bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>

          {message ? (
            <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3 text-xs font-bold text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
              {message}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-minimal">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest text-black/60 dark:text-white/60">
                Imports
              </h2>
              <span className="text-[10px] font-black text-black/30 dark:text-white/30">
                {imports.length}
              </span>
            </div>

            {importsLoading ? (
              <div className="rounded-xl bg-black/[0.03] p-4 text-xs font-bold text-black/40 dark:bg-white/[0.04] dark:text-white/40">
                Loading imports...
              </div>
            ) : importsError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-bold text-red-500">
                Cannot access or connect to imports.
              </div>
            ) : imports.length === 0 ? (
              <div className="rounded-xl bg-black/[0.03] p-4 text-xs font-bold text-black/40 dark:bg-white/[0.04] dark:text-white/40">
                No files uploaded yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {imports.map(item => {
                  const active = item.id === activeImportId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedImportId(item.id)}
                      className={
                        'rounded-xl border p-3 text-left transition ' +
                        (active
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-black/5 bg-black/[0.02] hover:bg-black/[0.04] dark:border-white/5 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]')
                      }
                    >
                      <div className="truncate text-xs font-black text-black dark:text-white">{item.filename}</div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-bold text-black/40 dark:text-white/40">
                        <span>{item.row_count} rows</span>
                        <span>{item.warnings_count} warnings</span>
                      </div>
                      <div className="mt-1 text-[10px] font-medium text-black/35 dark:text-white/35">{formatDate(item.created_at)}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-brand-medium-gray/30 bg-brand-white shadow-brand-card dark:border-white/10 dark:bg-black/25">
          <div className="space-y-2 border-b border-black/10 px-3 py-2 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-black/40 dark:text-white/40">
                Match
              </span>
              <label className="inline-flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                  Excel
                </span>
                <select
                  value={matchImportColumn}
                  onChange={(event) => setMatchImportColumn(event.target.value)}
                  className={COMPACT_SELECT_CLASS}
                  aria-label="Excel import match column"
                >
                  <option value="">Column…</option>
                  {matchImportColumnOptions.map(column => (
                    <option key={column} value={column}>{column}</option>
                  ))}
                </select>
              </label>
              <span className="text-[10px] font-black text-black/30 dark:text-white/30">→</span>
              <label className="inline-flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-sky-700 dark:text-sky-300">
                  Products
                </span>
                <select
                  value={matchProductColumn}
                  onChange={(event) => setMatchProductColumn(event.target.value)}
                  className={COMPACT_SELECT_CLASS}
                  aria-label="Products match column"
                >
                  <option value="">Column…</option>
                  {productColumns.map(column => (
                    <option key={column} value={column}>{column}</option>
                  ))}
                </select>
              </label>
              {isPreviewingMatch ? (
                <span className="text-[10px] font-bold text-black/35 dark:text-white/35">Checking…</span>
              ) : null}

              <span className="hidden h-4 w-px bg-black/10 dark:bg-white/10 sm:block" />
              {ALL_ROW_GROUPS.map(status => (
                <label
                  key={status}
                  className={
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-black transition ' +
                    (selectedRowGroups.has(status)
                      ? isMatchConfigured
                        ? ROW_MATCH_ROW_CLASS[status]
                        : 'border-black/15 bg-black/[0.04] text-black/70 dark:border-white/15 dark:bg-white/[0.05] dark:text-white/70'
                      : 'border-black/10 bg-black/[0.02] text-black/40 opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/40')
                  }
                >
                  <input
                    type="checkbox"
                    checked={selectedRowGroups.has(status)}
                    onChange={() => toggleRowGroup(status)}
                    className="h-3 w-3 accent-emerald-600"
                  />
                  {ROW_MATCH_STATUS_LABELS[status]} {isMatchConfigured ? rowStatusCounts[status] : 0}
                </label>
              ))}

              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={!activeImportId || isReprocessing}
                  onClick={() => void reprocessImportRows()}
                  className="rounded-full border border-black/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-black/55 transition hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:text-white/55 dark:hover:bg-white/10"
                >
                  {isReprocessing ? '…' : 'Refresh'}
                </button>
                <button
                  type="button"
                  disabled={!activeImportId || isApplying || !matchImportColumn || !matchProductColumn || selectedRowGroups.size === 0}
                  onClick={() => void applyImportToProducts()}
                  className="rounded-full bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-emerald-700 disabled:opacity-40"
                >
                  {isApplying ? '…' : 'Apply'}
                </button>
                <button
                  type="button"
                  disabled={!activeImportId}
                  onClick={() => void deleteImport()}
                  className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-600 transition hover:bg-red-500 hover:text-white disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>

            {matchPreviewError ? (
              <p className="text-[10px] font-bold text-red-600 dark:text-red-300">{matchPreviewError}</p>
            ) : null}

            <p className="text-[10px] font-medium text-black/40 dark:text-white/40">
              {rowsData
                ? `${rowsData.import.filename} · ${filteredImportRows.length}/${rowsData.count} rows shown · ${selectedTransferColumns.size} columns to transfer` +
                  (selectedRowGroups.size === 0 ? ' · tick a group to view & apply' : '')
                : 'Select an import from the left.'}
            </p>
          </div>

          {rowsError ? (
            <div className="m-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-bold text-red-500">
              Could not load import rows.
            </div>
          ) : rowsLoading ? (
            <div className="m-4 rounded-xl bg-black/[0.03] p-4 text-xs font-bold text-black/40 dark:bg-white/[0.04] dark:text-white/40">
              Loading staged rows...
            </div>
          ) : !rowsData ? (
            <div className="m-4 rounded-xl bg-black/[0.03] p-4 text-xs font-bold text-black/40 dark:bg-white/[0.04] dark:text-white/40">
              After uploading a spreadsheet, the converted list will appear here.
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto scrollbar-minimal">
              <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
                <thead className="sticky top-0 z-10 bg-white dark:bg-zinc-950">
                  <tr>
                    <th className="whitespace-nowrap border-b border-black/10 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-black/40 dark:border-white/10 dark:text-white/40">
                      Match
                    </th>
                    <th className="whitespace-nowrap border-b border-black/10 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-black/40 dark:border-white/10 dark:text-white/40">
                      Sheet
                    </th>
                    <th className="whitespace-nowrap border-b border-black/10 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-black/40 dark:border-white/10 dark:text-white/40">
                      Row
                    </th>
                    {visibleColumns.map(column => (
                      <th
                        key={column}
                        className="max-w-[180px] whitespace-nowrap border-b border-black/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black/40 dark:border-white/10 dark:text-white/40"
                      >
                        <label className="flex cursor-pointer select-none flex-col gap-1">
                          <span>{column}</span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-black normal-case tracking-normal text-black/45 dark:text-white/45">
                            <input
                              type="checkbox"
                              checked={selectedTransferColumns.has(column)}
                              onChange={() => toggleTransferColumn(column)}
                              className="h-3 w-3 accent-emerald-600"
                            />
                            Transfer
                          </span>
                        </label>
                      </th>
                    ))}
                    <th className="whitespace-nowrap border-b border-black/10 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-black/40 dark:border-white/10 dark:text-white/40">
                      Warnings
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredImportRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleColumns.length + 4}
                        className="border-b border-black/5 px-3 py-10 text-center text-xs font-bold text-black/40 dark:border-white/5 dark:text-white/40"
                      >
                        {selectedRowGroups.size === 0
                          ? 'Tick at least one group (Matched, Unmatched, or Empty) to view rows.'
                          : 'No rows in the selected groups.'}
                      </td>
                    </tr>
                  ) : null}
                  {filteredImportRows.map(row => {
                    const rowStatus = rowStatusById.get(row.id);
                    const rowTone = rowStatus ? ROW_MATCH_ROW_CLASS[rowStatus] : NEUTRAL_ROW_CLASS;
                    const existingProduct = rowStatus === 'matched' && matchImportColumn
                      ? findExistingProductByColumn(row, existingProductIndex, matchImportColumn)
                      : null;

                    return (
                      <tr key={row.id}>
                        <td className={'whitespace-nowrap border-b px-3 py-2 font-bold ' + rowTone}>
                          {rowStatus ? (
                            <span className={'inline-block rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ' + ROW_MATCH_BADGE_CLASS[rowStatus]}>
                              {ROW_MATCH_STATUS_LABELS[rowStatus]}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-black/30 dark:text-white/30">—</span>
                          )}
                        </td>
                        <td className={'whitespace-nowrap border-b px-3 py-2 font-bold ' + rowTone}>
                          <div>{row.source_sheet || '—'}</div>
                        </td>
                        <td className={'whitespace-nowrap border-b px-3 py-2 font-bold ' + rowTone}>
                          {row.source_row_number ?? '—'}
                        </td>
                        {visibleColumns.map(column => {
                          const isMatchingCell = existingProduct
                            ? fieldMatchesExisting(row.fields[column], existingProduct.fields ?? {}, column)
                            : false;
                          const isPriceColumn = column.trim().toLowerCase() === 'price';
                          const isImageLikeColumn = isImageColumn(column);
                          const imageUrl = isImageLikeColumn ? resolveImportAssetUrl(row.fields[column]) : '';
                          const isEditingThisCell = editingCell?.rowId === row.id && editingCell.column === column;
                          const cellKey = `${row.id}:${column}`;
                          const isSavingThisCell = savingCellKey === cellKey;

                          return (
                            <td
                              key={`${row.id}-${column}`}
                              className={
                                'relative border-b p-0 align-top ' +
                                (isImageLikeColumn ? 'w-[96px] min-w-[96px] max-w-[96px] ' : 'max-w-[220px] ') +
                                rowTone +
                                (isMatchingCell ? ' ring-1 ring-inset ring-green-500/40' : '') +
                                (isPriceColumn ? ' font-bold' : '')
                              }
                              title={renderCell(row.fields[column], column)}
                            >
                              {isEditingThisCell ? (
                                <div className={(isImageLikeColumn ? 'min-h-[76px] ' : 'min-h-[38px] ') + 'relative w-full'}>
                                  <span className="invisible block min-h-[38px] px-3 py-2 text-xs font-semibold">
                                    {renderCell(row.fields[column], column)}
                                  </span>
                                  <input
                                    className="absolute inset-0 h-full w-full bg-white px-3 py-2 text-xs font-semibold text-black outline outline-2 -outline-offset-2 outline-emerald-500 dark:bg-zinc-950 dark:text-white"
                                    value={editingCell.value}
                                    autoFocus
                                    onFocus={(event) => event.currentTarget.select()}
                                    onChange={(event) => setEditingCell({ ...editingCell, value: event.target.value })}
                                    onBlur={() => void saveEditingCell()}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault();
                                        void saveEditingCell();
                                      } else if (event.key === 'Escape') {
                                        event.preventDefault();
                                        cancelEditingCell();
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isSavingThisCell}
                                  onPointerDown={(event) => {
                                    event.preventDefault();
                                    startEditingCell(row, column);
                                  }}
                                  className={
                                    'block w-full px-3 py-2 text-left text-xs transition hover:bg-emerald-500/10 disabled:cursor-wait disabled:opacity-60 ' +
                                    (isImageLikeColumn ? 'min-h-[76px] ' : 'min-h-[38px] ') +
                                    (isPriceColumn ? 'font-bold' : 'font-medium')
                                  }
                                >
                                  {isSavingThisCell ? (
                                    <span className="line-clamp-3 whitespace-pre-line">Saving...</span>
                                  ) : isImageLikeColumn && imageUrl ? (
                                    <span className="flex flex-col gap-1">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={imageUrl}
                                        alt=""
                                        loading="lazy"
                                        className="h-14 w-16 rounded-md border border-black/10 object-cover dark:border-white/10"
                                        onError={(event) => {
                                          event.currentTarget.style.display = 'none';
                                        }}
                                      />
                                      <span className="truncate text-[9px] font-bold text-black/35 dark:text-white/35">
                                        Edit URL
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="line-clamp-3 whitespace-pre-line">{renderCell(row.fields[column], column)}</span>
                                  )}
                                </button>
                              )}
                            </td>
                          );
                        })}
                        <td className={'max-w-[260px] border-b px-3 py-2 align-top ' + rowTone}>
                          {row.warnings.length > 0 ? (
                            <div className="rounded-lg bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                              {row.warnings.join(' / ')}
                            </div>
                          ) : (
                            <span className="text-black/20 dark:text-white/20">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
