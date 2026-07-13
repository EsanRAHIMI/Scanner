'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';

import { apiFetch } from '@/lib/api';
import { useProductsCache } from '../../products-cache-provider';
import { formatPrice, formatScalar, highlightMatches, rewriteLegacyAppDomainInUrl } from '../lib/product-utils';
import { ProductsHeaderSearch } from '../components/products-header-search';
import {
  DEFAULT_SHOW_LABELS,
  EMPTY_ROW_LABEL_TOKEN,
  SUGGESTED_SHOW_LABELS,
  detectCrystalCustomLabel,
  formatShowLabelChip,
  getImportRowDisplayLabel,
  isExcludedByShowLabels,
  isLabelAllowedByShowFilter,
  normalizeShowLabelToken,
} from './lib/import-row-visibility';
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
  /** Staging-only note; stays on this import row and is not applied to Products. */
  row_label?: string;
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

type ImportRowMatchStatus = 'matched' | 'near' | 'unmatched' | 'empty';

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
  match: { import_columns: string[]; product_column: string; product_columns?: string[] };
  total_rows: number;
  matched_count: number;
  near_count?: number;
  unmatched_count: number;
  empty_import_value_count: number;
  near_match_chars?: string;
  row_statuses?: Record<string, ImportRowMatchStatus>;
  matched_samples: MatchPreviewSample[];
  near_samples?: MatchPreviewSample[];
  unmatched_samples: MatchPreviewSample[];
  empty_samples?: MatchPreviewSample[];
};

const NEAR_MATCH_CHARS_LABEL = 'space - / \\ ـ ( )';

const ALL_ROW_GROUPS: ImportRowMatchStatus[] = ['matched', 'near', 'unmatched', 'empty'];

/** Near is opt-in so Apply does not loosely update products unless you tick it. */
const DEFAULT_SELECTED_ROW_GROUPS: ImportRowMatchStatus[] = ['matched', 'unmatched', 'empty'];

/**
 * Verified rows = Matched rows whose selected field already has a value on the
 * existing product (and, if the Excel row also has that field, the values agree).
 * The filter lets you isolate ("only"), exclude ("hide"), or ignore ("off") them.
 */
type VerifiedFilterMode = 'off' | 'only' | 'hide';

const VERIFIED_FILTER_MODES: VerifiedFilterMode[] = ['off', 'only', 'hide'];

const VERIFIED_FILTER_MODE_LABELS: Record<VerifiedFilterMode, string> = {
  off: 'All',
  only: 'Only verified',
  hide: 'Hide verified',
};

function isVerifiedFilterMode(value: unknown): value is VerifiedFilterMode {
  return typeof value === 'string' && VERIFIED_FILTER_MODES.includes(value as VerifiedFilterMode);
}

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
  near: `Near (${NEAR_MATCH_CHARS_LABEL})`,
  unmatched: 'Unmatched',
  empty: 'Empty',
};

const ROW_MATCH_ROW_CLASS: Record<ImportRowMatchStatus, string> = {
  matched:
    'border-green-500/25 bg-green-500/10 text-green-800 dark:border-green-400/20 dark:bg-green-500/15 dark:text-green-200',
  near:
    'border-sky-500/25 bg-sky-500/10 text-sky-800 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-200',
  unmatched:
    'border-amber-500/25 bg-amber-500/10 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/15 dark:text-amber-200',
  empty:
    'border-red-500/25 bg-red-500/10 text-red-800 dark:border-red-400/20 dark:bg-red-500/15 dark:text-red-200',
};

const ROW_MATCH_BADGE_CLASS: Record<ImportRowMatchStatus, string> = {
  matched: 'bg-green-600 text-white',
  near: 'bg-sky-600 text-white',
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
const SELECTED_IMPORT_SESSION_STORAGE_KEY = 'lorenzo:products:imports:selected';
const IMPORT_MATCH_SESSION_STORAGE_PREFIX = 'lorenzo:products:import-match:';
const SHOW_LABELS_STORAGE_KEY = 'lorenzo:products:imports:show-labels';

function readStoredShowLabels(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_SHOW_LABELS];
  try {
    const raw = window.localStorage.getItem(SHOW_LABELS_STORAGE_KEY);
    if (!raw) return [...DEFAULT_SHOW_LABELS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_SHOW_LABELS];
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const item of parsed) {
      if (typeof item !== 'string') continue;
      const value = normalizeShowLabelToken(item);
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push(value);
    }
    return labels;
  } catch {
    return [...DEFAULT_SHOW_LABELS];
  }
}

type CachedImportSessionState = {
  matchImportColumns?: unknown;
  matchProductColumn?: unknown;
  matchProductColumns?: unknown;
  matchPreview?: unknown;
  selectedRowGroups?: unknown;
  selectedTransferColumns?: unknown;
  columnMappings?: unknown;
  hideVerifiedMatchedRows?: unknown;
  verifiedFilterMode?: unknown;
  verifiedMatchedColumn?: unknown;
  verifiedProductValueRequired?: unknown;
};

function importSessionStorageKey(importId: string) {
  return `${IMPORT_MATCH_SESSION_STORAGE_PREFIX}${importId}`;
}

function isImportRowMatchStatus(value: unknown): value is ImportRowMatchStatus {
  return typeof value === 'string' && ALL_ROW_GROUPS.includes(value as ImportRowMatchStatus);
}

function readCachedImportSessionState(importId: string): CachedImportSessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(importSessionStorageKey(importId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as CachedImportSessionState) : null;
  } catch {
    return null;
  }
}

function clearCachedImportSessionState(importId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(importSessionStorageKey(importId));
  } catch {
    // Ignore storage failures; the page still works without the session cache.
  }
}

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

function buildImportRowSearchText(row: ProductImportRow) {
  const parts = [
    row.row_label,
    getImportRowDisplayLabel(row),
    row.source_sheet,
    row.source_row_number != null ? String(row.source_row_number) : '',
    ...(row.warnings ?? []),
    ...Object.values(row.fields ?? {}).map((value) => formatScalar(value)),
  ];
  return parts
    .map((part) => (part == null ? '' : String(part).trim()))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function importRowMatchesSearch(row: ProductImportRow, query: string, cache?: Map<string, string>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = cache?.get(row.id) ?? buildImportRowSearchText(row);
  if (text.includes(q)) return true;
  const words = q.split(/\s+/).filter(Boolean);
  return words.every((word) => text.includes(word));
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

/** Drop spaces / - / \ ـ ( ) so near-matches can align codes and names. */
function normalizeLooseComparable(value: unknown) {
  return normalizeComparable(value).replace(/[\s\-/\\ـ()]+/g, '');
}

function describeIgnoredMatchChars(...texts: string[]) {
  const found = new Set<string>();
  for (const text of texts) {
    for (const ch of text) {
      if (/\s/.test(ch)) found.add('space');
      else if (ch === '-') found.add('-');
      else if (ch === '/') found.add('/');
      else if (ch === '\\') found.add('\\');
      else if (ch === 'ـ') found.add('ـ');
      else if (ch === '(') found.add('(');
      else if (ch === ')') found.add(')');
    }
  }
  if (found.size === 0) return NEAR_MATCH_CHARS_LABEL;
  const order = ['space', '-', '/', '\\', 'ـ', '(', ')'];
  return order.filter((item) => found.has(item)).join(' ');
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
    // Match backend aliases so preview/apply and UI badges stay consistent.
    'colecction name': ['Collection Name', 'Colecction Name', 'Name', 'default_code', 'Default Code', 'CODE NUMBER', 'Code Number', 'Code No'],
    'collection name': ['Collection Name', 'Colecction Name', 'Name', 'default_code', 'Default Code', 'CODE NUMBER', 'Code Number', 'Code No'],
    name: ['Collection Name', 'Colecction Name', 'Name', 'default_code', 'Default Code', 'CODE NUMBER', 'Code Number', 'Code No'],
    'colecction code': ['Collection Code', 'Colecction Code', 'Code'],
    'collection code': ['Collection Code', 'Colecction Code', 'Code'],
    code: ['Collection Code', 'Colecction Code', 'Code'],
    'variant number': ['Variant Number', 'Variant', 'Num'],
    variant: ['Variant Number', 'Variant', 'Num'],
    num: ['Num', 'Variant Number', 'Variant'],
    'code number': ['CODE NUMBER', 'Code Number', 'Code No', 'default_code', 'Default Code', 'Collection Name', 'Colecction Name', 'Name'],
    'dimension (cm)': ['DIMENSION (cm)', 'Dimension (cm)', 'DIMENSION (mm)', 'Dimension (mm)', 'DIMENSION', 'Dimension', 'Dimensions', 'Size'],
    'dimension (mm)': ['DIMENSION (cm)', 'Dimension (cm)', 'DIMENSION (mm)', 'Dimension (mm)', 'DIMENSION', 'Dimension', 'Dimensions', 'Size'],
  };
  return getFirstField(fields, aliases[lower] ?? [column]);
}

function buildProductIndexByColumns(records: ProductsRecord[], productColumns: string[]) {
  const index = new Map<string, ProductsRecord>();
  for (const record of records) {
    for (const productColumn of productColumns) {
      const value = normalizeComparable(getEquivalentFieldValue(record.fields ?? {}, productColumn));
      if (value && !index.has(value)) index.set(value, record);
    }
  }
  return index;
}

function buildProductLooseIndexByColumns(records: ProductsRecord[], productColumns: string[]) {
  const index = new Map<string, ProductsRecord>();
  for (const record of records) {
    for (const productColumn of productColumns) {
      const value = normalizeLooseComparable(getEquivalentFieldValue(record.fields ?? {}, productColumn));
      if (value && !index.has(value)) index.set(value, record);
    }
  }
  return index;
}

function findExistingProductByColumn(
  row: ProductImportRow,
  index: Map<string, ProductsRecord>,
  importColumns: string[],
) {
  for (const importColumn of importColumns) {
    const value = normalizeComparable(getEquivalentFieldValue(row.fields ?? {}, importColumn));
    if (!value) continue;
    const hit = index.get(value);
    if (hit) return hit;
  }
  return null;
}

function findExistingProductByLooseColumn(
  row: ProductImportRow,
  looseIndex: Map<string, ProductsRecord>,
  importColumns: string[],
) {
  for (const importColumn of importColumns) {
    const value = normalizeLooseComparable(getEquivalentFieldValue(row.fields ?? {}, importColumn));
    if (!value) continue;
    const hit = looseIndex.get(value);
    if (hit) return hit;
  }
  return null;
}

function fieldMatchesExisting(rowValue: unknown, existingFields: Record<string, unknown>, column: string) {
  const left = normalizeComparable(rowValue);
  if (!left) return false;
  const right = normalizeComparable(getEquivalentFieldValue(existingFields, column));
  return Boolean(right) && left === right;
}

function fieldNearMatchesExisting(rowValue: unknown, existingFields: Record<string, unknown>, column: string) {
  const left = normalizeLooseComparable(rowValue);
  if (!left) return false;
  const right = normalizeLooseComparable(getEquivalentFieldValue(existingFields, column));
  if (!right || left !== right) return false;
  // Exact already matched — not a "near" highlight.
  return normalizeComparable(rowValue) !== normalizeComparable(getEquivalentFieldValue(existingFields, column));
}

function isRowLabelExcludedByShowFilter(label: string, showLabels: string[]) {
  return !isLabelAllowedByShowFilter(label, showLabels);
}

function isMatchedImportRowVerifiedForColumn(
  row: ProductImportRow,
  existingProduct: ProductsRecord | null,
  column: string,
  productValueRequired: boolean,
) {
  if (!existingProduct || !column) return false;
  const productValue = normalizeComparable(getEquivalentFieldValue(existingProduct.fields ?? {}, column));
  if (!productValue) return !productValueRequired;
  if (!productValueRequired) return false;
  const importValue = normalizeComparable(getEquivalentFieldValue(row.fields ?? {}, column));
  return !importValue || importValue === productValue;
}

function classifyImportRowMatchStatus(
  row: ProductImportRow,
  productIndex: Map<string, ProductsRecord>,
  looseIndex: Map<string, ProductsRecord>,
  importColumns: string[],
): ImportRowMatchStatus {
  let hasValue = false;
  for (const importColumn of importColumns) {
    const value = normalizeComparable(getEquivalentFieldValue(row.fields ?? {}, importColumn));
    if (!value) continue;
    hasValue = true;
    if (productIndex.has(value)) return 'matched';
  }
  if (!hasValue) return 'empty';
  for (const importColumn of importColumns) {
    const loose = normalizeLooseComparable(getEquivalentFieldValue(row.fields ?? {}, importColumn));
    if (!loose) continue;
    if (looseIndex.has(loose)) return 'near';
  }
  return 'unmatched';
}

function buildRowStatusMap(
  rows: ProductImportRow[],
  productIndex: Map<string, ProductsRecord>,
  looseIndex: Map<string, ProductsRecord>,
  importColumns: string[],
  previewStatuses?: Record<string, ImportRowMatchStatus>,
) {
  const map = new Map<string, ImportRowMatchStatus>();
  for (const row of rows) {
    const fromPreview = previewStatuses?.[row.id];
    map.set(
      row.id,
      fromPreview ?? classifyImportRowMatchStatus(row, productIndex, looseIndex, importColumns),
    );
  }
  return map;
}

const AGENT_IMPORT_ROW_LIMIT = 80;
const AGENT_IMPORT_FIELD_LIMIT = 12;

function trimAgentFieldValue(value: unknown, max = 80): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }
  const text = String(value).trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function summarizeImportRowFieldsForAgent(
  fields: Record<string, unknown>,
  priorityColumns: string[],
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  const seen = new Set<string>();
  const keys = [
    ...priorityColumns,
    ...Object.keys(fields).filter((key) => !priorityColumns.includes(key)),
  ];
  for (const key of keys) {
    if (key === 'Row' || seen.has(key)) continue;
    seen.add(key);
    const trimmed = trimAgentFieldValue(fields[key]);
    if (trimmed === null) continue;
    out[key] = trimmed;
    if (Object.keys(out).length >= AGENT_IMPORT_FIELD_LIMIT) break;
  }
  return out;
}

const IMPORT_MATCH_LOGIC =
  `OR across selected Excel and Products columns: Matched = exact (trim + lowercase). Near = same after ignoring ${NEAR_MATCH_CHARS_LABEL}. Unmatched = has Excel value but no product hit. Empty = all match Excel columns blank.`;

function buildImportMatchPayload(importColumns: string[], productColumns: string[]) {
  return {
    import_columns: importColumns,
    import_column: importColumns[0] ?? '',
    product_columns: productColumns,
    product_column: productColumns[0] ?? '',
  };
}

function collectUnmatchedSamplesForAgent(
  rows: ProductImportRow[],
  rowStatusById: Map<string, ImportRowMatchStatus>,
  importColumns: string[],
  limit = 8,
) {
  const out: Array<{
    row_id: string;
    row_label: string;
    import_value?: string | null;
    import_values?: Record<string, string>;
    reason: string;
    source_sheet?: string | null;
    source_row_number?: number | null;
  }> = [];
  for (const row of rows) {
    if (rowStatusById.get(row.id) !== 'unmatched') continue;
    const importValues: Record<string, string> = {};
    for (const col of importColumns) {
      const value = trimAgentFieldValue(getEquivalentFieldValue(row.fields ?? {}, col));
      if (value !== null) importValues[col] = String(value);
    }
    const primaryValue =
      importColumns.map((col) => importValues[col]).find((value) => Boolean(value)) ?? null;
    out.push({
      row_id: row.id,
      row_label: (row.row_label ?? '').trim() || getImportRowDisplayLabel(row),
      import_value: primaryValue,
      import_values: Object.keys(importValues).length > 0 ? importValues : undefined,
      reason: 'no_product_match',
      source_sheet: row.source_sheet ?? null,
      source_row_number: row.source_row_number ?? null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export default function ProductImportsPage() {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [selectedImportId, setSelectedImportId] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [editingCell, setEditingCell] = React.useState<EditingCell | null>(null);
  const [savingCellKey, setSavingCellKey] = React.useState<string | null>(null);
  const [savingLabelRowId, setSavingLabelRowId] = React.useState<string | null>(null);
  const [isApplying, setIsApplying] = React.useState(false);
  const [isReprocessing, setIsReprocessing] = React.useState(false);
  const [columnMappings, setColumnMappings] = React.useState<Record<string, string>>({});
  const [matchImportColumns, setMatchImportColumns] = React.useState<string[]>([]);
  const [matchImportColumnDraft, setMatchImportColumnDraft] = React.useState('');
  const [matchProductColumns, setMatchProductColumns] = React.useState<string[]>([]);
  const [matchProductColumnDraft, setMatchProductColumnDraft] = React.useState('');
  const matchProductColumn = matchProductColumns[0] ?? '';
  const [matchPreview, setMatchPreview] = React.useState<MatchPreviewResponse | null>(null);
  const [matchPreviewError, setMatchPreviewError] = React.useState<string | null>(null);
  const [isPreviewingMatch, setIsPreviewingMatch] = React.useState(false);
  const [selectedRowGroups, setSelectedRowGroups] = React.useState<Set<ImportRowMatchStatus>>(
    () => new Set(DEFAULT_SELECTED_ROW_GROUPS),
  );
  const [verifiedFilterMode, setVerifiedFilterMode] = React.useState<VerifiedFilterMode>('off');
  const [verifiedMatchedColumn, setVerifiedMatchedColumn] = React.useState('');
  const [verifiedProductValueRequired, setVerifiedProductValueRequired] = React.useState(true);
  const [temporarilyHiddenRowIds, setTemporarilyHiddenRowIds] = React.useState<Set<string>>(new Set());
  const [showLabels, setShowLabels] = React.useState<string[]>(DEFAULT_SHOW_LABELS);
  const [showLabelDraft, setShowLabelDraft] = React.useState('');
  const [showHiddenRows, setShowHiddenRows] = React.useState(false);
  const [isLgScreen, setIsLgScreen] = React.useState(false);
  const [uploadPanelOpen, setUploadPanelOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const visibleImportRowIdsRef = React.useRef<string[]>([]);
  const initializedTransferColumnsForImportRef = React.useRef<string | null>(null);
  const initializedMatchColumnsForImportRef = React.useRef<string | null>(null);
  const autoLabeledRowIdsRef = React.useRef<Set<string>>(new Set());
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
      let cachedSelectedImportId = '';
      try {
        cachedSelectedImportId = window.sessionStorage.getItem(SELECTED_IMPORT_SESSION_STORAGE_KEY) ?? '';
      } catch {
        cachedSelectedImportId = '';
      }
      const cachedImportExists = imports.some(item => item.id === cachedSelectedImportId);
      setSelectedImportId(cachedImportExists ? cachedSelectedImportId : imports[0].id);
    }
  }, [imports, selectedImportId]);

  React.useEffect(() => {
    if (!activeImportId) return;
    try {
      window.sessionStorage.setItem(SELECTED_IMPORT_SESSION_STORAGE_KEY, activeImportId);
    } catch {
      // Session storage is a convenience only.
    }
  }, [activeImportId]);

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
      clearCachedImportSessionState(activeImportId);
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
    if (!activeImportId || matchImportColumns.length === 0 || matchProductColumns.length === 0) return;
    setIsPreviewingMatch(true);
    setMatchPreviewError(null);
    try {
      const res = await apiFetch(`/admin/products/imports/${activeImportId}/preview-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match: buildImportMatchPayload(matchImportColumns, matchProductColumns),
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
  }, [activeImportId, matchImportColumns, matchProductColumns]);

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
      if (matchImportColumns.length > 0 && matchProductColumns.length > 0) {
        void previewMatch();
      }
    } catch (err) {
      await mutateRows(previousData, { revalidate: false });
      setMessage(err instanceof Error ? err.message : 'Cell update failed');
    } finally {
      setSavingCellKey(null);
      saveInFlightRef.current = false;
    }
  }, [activeImportId, editingCell, matchImportColumns, matchProductColumns, mutateRows, previewMatch, rowsData]);

  const saveRowLabel = React.useCallback(
    async (rowId: string, label: string, options?: { silent?: boolean }) => {
      if (!activeImportId || saveInFlightRef.current) return;

      const trimmed = label.trim();
      const previousData = rowsData;
      const previousLabel =
        previousData?.records.find((row) => row.id === rowId)?.row_label?.trim() ?? '';
      if (trimmed === previousLabel) return;

      setTemporarilyHiddenRowIds((prev) => {
        const next = new Set(prev);
        if (isRowLabelExcludedByShowFilter(trimmed, showLabels)) next.add(rowId);
        else next.delete(rowId);
        return next;
      });

      saveInFlightRef.current = true;
      setSavingLabelRowId(rowId);

      await mutateRows(
        (current) => {
          if (!current) return current;
          return {
            ...current,
            records: current.records.map((row) =>
              row.id === rowId ? { ...row, row_label: trimmed } : row,
            ),
          };
        },
        { revalidate: false },
      );

      try {
        const res = await apiFetch(`/admin/products/imports/${activeImportId}/rows/${rowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ row_label: trimmed }),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(text || 'Label update failed');
        const updatedRow = JSON.parse(text) as ProductImportRow;

        await mutateRows(
          (current) => {
            if (!current) return current;
            return {
              ...current,
              records: current.records.map((row) => (row.id === rowId ? updatedRow : row)),
            };
          },
          { revalidate: false },
        );
      } catch (err) {
        await mutateRows(previousData, { revalidate: false });
        setTemporarilyHiddenRowIds((prev) => {
          const next = new Set(prev);
          if (isRowLabelExcludedByShowFilter(previousLabel, showLabels)) next.add(rowId);
          else next.delete(rowId);
          return next;
        });
        if (!options?.silent) {
          setMessage(err instanceof Error ? err.message : 'Label update failed');
        }
      } finally {
        setSavingLabelRowId(null);
        saveInFlightRef.current = false;
      }
    },
    [activeImportId, showLabels, mutateRows, rowsData],
  );

  React.useEffect(() => {
    autoLabeledRowIdsRef.current = new Set();
    setTemporarilyHiddenRowIds(new Set());
    setShowHiddenRows(false);
  }, [activeImportId]);

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      const lg = mq.matches;
      setIsLgScreen(lg);
      if (!lg) setUploadPanelOpen(false);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const uploadPanelExpanded = isLgScreen || uploadPanelOpen;

  React.useEffect(() => {
    if (isLgScreen) return;
    if (debouncedSearch.trim() || rowsLoading) {
      setUploadPanelOpen(false);
    }
  }, [debouncedSearch, isLgScreen, rowsLoading]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    setSearch('');
  }, [activeImportId]);

  React.useEffect(() => {
    const focusSearchInput = () => {
      const el = searchInputRef.current;
      if (!el) return;
      el.focus();
      try {
        el.select();
      } catch {
        // ignore
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const isInput =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target as HTMLElement).isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        focusSearchInput();
        return;
      }
      if (event.key === '/' && !isInput) {
        event.preventDefault();
        focusSearchInput();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  React.useEffect(() => {
    if (!rowsData || !activeImportId) return;
    for (const row of rowsData.records) {
      if (autoLabeledRowIdsRef.current.has(row.id)) continue;
      if ((row.row_label ?? '').trim()) continue;
      const detected = detectCrystalCustomLabel(row.fields);
      if (!detected) continue;
      autoLabeledRowIdsRef.current.add(row.id);
      void saveRowLabel(row.id, detected, { silent: true });
    }
  }, [activeImportId, rowsData, saveRowLabel]);

  const isRowHiddenForView = React.useCallback(
    (row: ProductImportRow) => temporarilyHiddenRowIds.has(row.id) || isExcludedByShowLabels(row, showLabels),
    [showLabels, temporarilyHiddenRowIds],
  );

  const hiddenRowCount = React.useMemo(
    () => rowsData?.records.filter((row) => isRowHiddenForView(row)).length ?? 0,
    [isRowHiddenForView, rowsData],
  );

  const matchableRows = React.useMemo(
    () => rowsData?.records.filter((row) => !isRowHiddenForView(row)) ?? [],
    [isRowHiddenForView, rowsData],
  );

  const applyImportToProducts = React.useCallback(async () => {
    if (!activeImportId || isApplying) return;
    if (matchImportColumns.length === 0 || matchProductColumns.length === 0) {
      setMessage('Choose one or more Excel columns and one or more Products columns before applying.');
      return;
    }
    const mappedEntries = Object.entries(columnMappings).filter(
      ([importColumn, productColumn]) =>
        Boolean(importColumn.trim()) && Boolean(String(productColumn).trim()),
    );
    if (mappedEntries.length === 0) {
      setMessage('Map at least one import column to a Products column before applying.');
      return;
    }
    if (selectedRowGroups.size === 0) {
      setMessage('Select at least one row group (Matched, Near, Unmatched, or Empty).');
      return;
    }
    const visibleRowIds = visibleImportRowIdsRef.current;
    if (visibleRowIds.length === 0) {
      setMessage('No visible rows to apply. Clear filters or show rows first.');
      return;
    }
    const columnMap = Object.fromEntries(
      mappedEntries.map(([importColumn, productColumn]) => [importColumn, String(productColumn).trim()]),
    );
    const mappingSummary = mappedEntries
      .map(([importColumn, productColumn]) => `${importColumn} → ${productColumn}`)
      .join(', ');
    const groupLabels = Array.from(selectedRowGroups).map(group => ROW_MATCH_STATUS_LABELS[group]).join(', ');
    const ok = window.confirm(
      `Apply this import to the main Products table?\n\n` +
        `Match: "${matchImportColumns.join(' OR ')}" → "${matchProductColumns.join(' OR ')}"\n` +
        `Apply only: ${groupLabels}\n` +
        `Rows to process: ${visibleRowIds.length.toLocaleString('en-US')} currently visible row(s)\n` +
        `Column map (${mappedEntries.length}): ${mappingSummary}\n\n` +
        'Only the rows currently visible after search, show-labels filter, Verified filter, and row-group filters are written. Continue?'
    );
    if (!ok) return;

    setIsApplying(true);
    setMessage(null);
    try {
      const res = await apiFetch(`/admin/products/imports/${activeImportId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          column_map: columnMap,
          columns: Object.keys(columnMap),
          match: buildImportMatchPayload(matchImportColumns, matchProductColumns),
          apply_row_groups: Array.from(selectedRowGroups),
          row_ids: visibleRowIds,
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
    columnMappings,
    isApplying,
    matchImportColumns,
    selectedRowGroups,
    matchProductColumns,
    mutateImports,
    mutateProducts,
    mutateRows,
  ]);

  const reprocessImportRows = React.useCallback(async () => {
    if (!activeImportId || isReprocessing) return;
    setIsReprocessing(true);
    setMessage(null);
    clearCachedImportSessionState(activeImportId);
    setMatchPreview(null);
    try {
      const res = await apiFetch(`/admin/products/imports/${activeImportId}/reprocess`, {
        method: 'POST',
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Refresh formulas failed');
      const result = JSON.parse(text) as ReprocessImportResponse;
      await mutateRows();
      if (matchImportColumns.length > 0 && matchProductColumns.length > 0) {
        await previewMatch();
      }
      setMessage(`Formulas rechecked: ${result.changed_count} of ${result.processed_count} row(s) updated.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Refresh formulas failed');
    } finally {
      setIsReprocessing(false);
    }
  }, [activeImportId, isReprocessing, matchImportColumns, matchProductColumns, mutateRows, previewMatch]);

  const importColumns = React.useMemo(
    () => (rowsData ? collectImportColumnsFromRows(rowsData.records) : []),
    [rowsData],
  );
  const matchImportColumnOptions = React.useMemo(() => {
    const extras = matchImportColumns.filter((column) => column !== 'Row' && !importColumns.includes(column));
    return ['Row', ...importColumns, ...extras];
  }, [importColumns, matchImportColumns]);
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
  const verifiedMatchedColumnOptions = React.useMemo(() => {
    const options = new Set<string>();
    for (const column of importColumns) options.add(column);
    for (const column of productColumns) options.add(column);
    return [...options];
  }, [importColumns, productColumns]);
  const matchProductColumnOptions = React.useMemo(() => {
    const extras = matchProductColumns.filter((column) => !productColumns.includes(column));
    return [...productColumns, ...extras];
  }, [matchProductColumns, productColumns]);
  const existingProductIndex = React.useMemo(() => {
    if (matchProductColumns.length === 0) return new Map<string, ProductsRecord>();
    return buildProductIndexByColumns(productsData?.records ?? [], matchProductColumns);
  }, [matchProductColumns, productsData?.records]);
  const existingLooseProductIndex = React.useMemo(() => {
    if (matchProductColumns.length === 0) return new Map<string, ProductsRecord>();
    return buildProductLooseIndexByColumns(productsData?.records ?? [], matchProductColumns);
  }, [matchProductColumns, productsData?.records]);
  const rowStatusById = React.useMemo(() => {
    if (!rowsData || matchImportColumns.length === 0 || matchProductColumns.length === 0) {
      return new Map<string, ImportRowMatchStatus>();
    }
    const previewStatuses = matchPreview?.row_statuses;
    const filteredPreview = previewStatuses
      ? Object.fromEntries(
          Object.entries(previewStatuses).filter(([rowId]) => {
            const row = rowsData.records.find((item) => item.id === rowId);
            return row ? !isRowHiddenForView(row) : true;
          }),
        )
      : undefined;
    return buildRowStatusMap(
      matchableRows,
      existingProductIndex,
      existingLooseProductIndex,
      matchImportColumns,
      filteredPreview,
    );
  }, [
    existingLooseProductIndex,
    existingProductIndex,
    matchImportColumns,
    matchPreview?.row_statuses,
    matchProductColumns,
    matchableRows,
    isRowHiddenForView,
    rowsData,
  ]);

  const rowStatusCounts = React.useMemo(() => {
    const counts = { matched: 0, near: 0, unmatched: 0, empty: 0 };
    for (const status of rowStatusById.values()) {
      counts[status] += 1;
    }
    return counts;
  }, [rowStatusById]);

  const isMatchConfigured = matchImportColumns.length > 0 && matchProductColumns.length > 0;

  const nearMatchDetailById = React.useMemo(() => {
    const map = new Map<string, { productValue: string; importValue: string; ignored: string }>();
    if (!isMatchConfigured) return map;
    for (const row of matchableRows) {
      if (rowStatusById.get(row.id) !== 'near') continue;
      const product = findExistingProductByLooseColumn(row, existingLooseProductIndex, matchImportColumns);
      if (!product) continue;
      let importValue = '';
      let productValue = '';
      for (const importColumn of matchImportColumns) {
        const leftRaw = getEquivalentFieldValue(row.fields ?? {}, importColumn);
        const leftLoose = normalizeLooseComparable(leftRaw);
        if (!leftLoose) continue;
        for (const productColumn of matchProductColumns) {
          const rightRaw = getEquivalentFieldValue(product.fields ?? {}, productColumn);
          if (normalizeLooseComparable(rightRaw) !== leftLoose) continue;
          importValue = formatScalar(leftRaw) || normalizeComparable(leftRaw);
          productValue = formatScalar(rightRaw) || normalizeComparable(rightRaw);
          break;
        }
        if (importValue || productValue) break;
      }
      map.set(row.id, {
        importValue,
        productValue,
        ignored: describeIgnoredMatchChars(importValue, productValue),
      });
    }
    return map;
  }, [
    existingLooseProductIndex,
    isMatchConfigured,
    matchImportColumns,
    matchProductColumns,
    matchableRows,
    rowStatusById,
  ]);

  const isVerifiedMatchedRow = React.useCallback(
    (row: ProductImportRow) => {
      if (!isMatchConfigured || !verifiedMatchedColumn) return false;
      if (rowStatusById.get(row.id) !== 'matched') return false;
      const existingProduct = findExistingProductByColumn(row, existingProductIndex, matchImportColumns);
      return isMatchedImportRowVerifiedForColumn(
        row,
        existingProduct,
        verifiedMatchedColumn,
        verifiedProductValueRequired,
      );
    },
    [
      existingProductIndex,
      isMatchConfigured,
      matchImportColumns,
      rowStatusById,
      verifiedMatchedColumn,
      verifiedProductValueRequired,
    ],
  );

  const verifiedMatchedCount = React.useMemo(() => {
    if (!rowsData || !verifiedMatchedColumn) return 0;
    return rowsData.records.filter((row) => !isRowHiddenForView(row) && isVerifiedMatchedRow(row)).length;
  }, [isRowHiddenForView, isVerifiedMatchedRow, rowsData, verifiedMatchedColumn]);

  const isVerifiedFilterActive = verifiedFilterMode !== 'off' && Boolean(verifiedMatchedColumn);

  const filteredImportRows = React.useMemo(() => {
    if (!rowsData) return [];

    const hiddenRows = showHiddenRows
      ? rowsData.records.filter((row) => isRowHiddenForView(row))
      : [];
    const visibleRows = rowsData.records.filter((row) => !isRowHiddenForView(row));

    if (selectedRowGroups.size === 0) {
      return showHiddenRows ? hiddenRows : [];
    }

    const activeRows = visibleRows.filter((row) => {
      if (!isMatchConfigured) return true;
      const status = rowStatusById.get(row.id);
      if (!status || !selectedRowGroups.has(status)) return false;
      if (isVerifiedFilterActive) {
        const verified = isVerifiedMatchedRow(row);
        if (verifiedFilterMode === 'hide' && verified) return false;
        if (verifiedFilterMode === 'only' && !verified) return false;
      }
      return true;
    });

    return showHiddenRows ? [...activeRows, ...hiddenRows] : activeRows;
  }, [
    isVerifiedFilterActive,
    verifiedFilterMode,
    isMatchConfigured,
    isVerifiedMatchedRow,
    isRowHiddenForView,
    rowStatusById,
    rowsData,
    selectedRowGroups,
    showHiddenRows,
  ]);

  const importRowSearchTextById = React.useMemo(() => {
    const map = new Map<string, string>();
    if (!rowsData) return map;
    for (const row of rowsData.records) {
      map.set(row.id, buildImportRowSearchText(row));
    }
    return map;
  }, [rowsData]);

  const searchFilteredImportRows = React.useMemo(() => {
    const q = debouncedSearch.trim();
    if (!q) return filteredImportRows;
    return filteredImportRows.filter((row) =>
      importRowMatchesSearch(row, q, importRowSearchTextById),
    );
  }, [debouncedSearch, filteredImportRows, importRowSearchTextById]);
  visibleImportRowIdsRef.current = searchFilteredImportRows
    .filter((row) => !isRowHiddenForView(row))
    .map((row) => row.id);

  const visibleColumns = importColumns;

  React.useEffect(() => {
    if (!activeImportId || importColumns.length === 0) return;
    if (initializedTransferColumnsForImportRef.current === activeImportId) return;
    initializedTransferColumnsForImportRef.current = activeImportId;
    const cached = readCachedImportSessionState(activeImportId);
    const nextMappings: Record<string, string> = {};

    const rawMappings = cached?.columnMappings;
    if (rawMappings && typeof rawMappings === 'object' && !Array.isArray(rawMappings)) {
      for (const [importColumn, productColumn] of Object.entries(rawMappings as Record<string, unknown>)) {
        if (!importColumns.includes(importColumn)) continue;
        if (typeof productColumn !== 'string' || !productColumn.trim()) continue;
        nextMappings[importColumn] = productColumn.trim();
      }
    } else {
      const rawTransferColumns = cached?.selectedTransferColumns;
      if (Array.isArray(rawTransferColumns)) {
        for (const column of rawTransferColumns) {
          if (typeof column !== 'string' || !importColumns.includes(column)) continue;
          if (column === 'Image1' && productColumns.includes('Image')) {
            nextMappings[column] = 'Image';
          } else if (productColumns.includes(column)) {
            nextMappings[column] = column;
          }
        }
      }
    }

    setColumnMappings(nextMappings);
  }, [activeImportId, importColumns, productColumns]);

  React.useEffect(() => {
    if (!activeImportId || importColumns.length === 0 || productColumns.length === 0) return;
    if (initializedMatchColumnsForImportRef.current === activeImportId) return;
    initializedMatchColumnsForImportRef.current = activeImportId;
    const cached = readCachedImportSessionState(activeImportId);
    const rawMatchImportColumns = cached?.matchImportColumns;
    const cachedMatchImportColumns = Array.isArray(rawMatchImportColumns)
      ? rawMatchImportColumns.filter(
          (column): column is string =>
            typeof column === 'string' && (column === 'Row' || importColumns.includes(column)),
        )
      : [];
    const rawMatchProductColumn = cached?.matchProductColumn;
    const rawMatchProductColumns = cached?.matchProductColumns;
    const cachedMatchProductColumns = Array.isArray(rawMatchProductColumns)
      ? rawMatchProductColumns.filter(
          (column): column is string => typeof column === 'string' && productColumns.includes(column),
        )
      : typeof rawMatchProductColumn === 'string' && productColumns.includes(rawMatchProductColumn)
        ? [rawMatchProductColumn]
        : [];
    const cachedMatchProductColumn = cachedMatchProductColumns[0] ?? '';
    const rawRowGroups = cached?.selectedRowGroups;
    const cachedRowGroups = Array.isArray(rawRowGroups)
      ? rawRowGroups.filter(isImportRowMatchStatus)
      : [...DEFAULT_SELECTED_ROW_GROUPS];
    const rawVerifiedColumn = cached?.verifiedMatchedColumn;
    const cachedVerifiedColumn =
      typeof rawVerifiedColumn === 'string' &&
      (importColumns.includes(rawVerifiedColumn) || productColumns.includes(rawVerifiedColumn))
        ? rawVerifiedColumn
        : cachedMatchProductColumn;

    setMatchImportColumns(cachedMatchImportColumns);
    setMatchImportColumnDraft('');
    setMatchProductColumns(cachedMatchProductColumns);
    setMatchProductColumnDraft('');
    const rawMatchPreview = cached?.matchPreview;
    setMatchPreview(
      rawMatchPreview && typeof rawMatchPreview === 'object'
        ? (rawMatchPreview as MatchPreviewResponse)
        : null,
    );
    setMatchPreviewError(null);
    setSelectedRowGroups(new Set(cachedRowGroups));
    const rawVerifiedFilterMode = cached?.verifiedFilterMode;
    const cachedVerifiedFilterMode = isVerifiedFilterMode(rawVerifiedFilterMode)
      ? rawVerifiedFilterMode
      : cached?.hideVerifiedMatchedRows === true
        ? 'hide'
        : 'off';
    setVerifiedFilterMode(cachedVerifiedFilterMode);
    setVerifiedMatchedColumn(cachedVerifiedColumn);
    setVerifiedProductValueRequired(cached?.verifiedProductValueRequired !== false);
  }, [activeImportId, productColumns, importColumns]);

  React.useEffect(() => {
    if (!verifiedMatchedColumn) return;
    if (!verifiedMatchedColumnOptions.includes(verifiedMatchedColumn)) {
      setVerifiedMatchedColumn('');
    }
  }, [verifiedMatchedColumn, verifiedMatchedColumnOptions]);

  React.useEffect(() => {
    if (verifiedMatchedColumn || !matchProductColumn) return;
    if (verifiedMatchedColumnOptions.includes(matchProductColumn)) {
      setVerifiedMatchedColumn(matchProductColumn);
    }
  }, [matchProductColumn, verifiedMatchedColumn, verifiedMatchedColumnOptions]);

  React.useEffect(() => {
    if (!activeImportId) return;
    if (initializedMatchColumnsForImportRef.current !== activeImportId) return;
    if (initializedTransferColumnsForImportRef.current !== activeImportId) return;
    try {
      window.sessionStorage.setItem(
        importSessionStorageKey(activeImportId),
        JSON.stringify({
          matchImportColumns,
          matchProductColumns,
          matchPreview,
          selectedRowGroups: Array.from(selectedRowGroups),
          selectedTransferColumns: Object.keys(columnMappings),
          columnMappings,
          verifiedFilterMode,
          verifiedMatchedColumn,
          verifiedProductValueRequired,
        }),
      );
    } catch {
      // Ignore storage failures; the in-memory state remains the source of truth.
    }
  }, [
    activeImportId,
    verifiedFilterMode,
    matchImportColumns,
    matchPreview,
    matchProductColumns,
    selectedRowGroups,
    columnMappings,
    verifiedMatchedColumn,
    verifiedProductValueRequired,
  ]);

  // Load persisted show labels after mount only, so SSR and first client render match (no hydration mismatch).
  React.useEffect(() => {
    setShowLabels(readStoredShowLabels());
  }, []);

  const persistShowLabels = React.useCallback((next: string[]) => {
    try {
      window.localStorage.setItem(SHOW_LABELS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Preference persistence is best-effort.
    }
  }, []);

  const toggleShowLabel = React.useCallback((label: string) => {
    const token = normalizeShowLabelToken(label);
    setShowLabels((prev) => {
      const exists = prev.some((item) => normalizeShowLabelToken(item).toLowerCase() === token.toLowerCase());
      const next = exists
        ? prev.filter((item) => normalizeShowLabelToken(item).toLowerCase() !== token.toLowerCase())
        : [...prev, token];
      persistShowLabels(next);
      return next;
    });
  }, [persistShowLabels]);

  const addShowLabel = React.useCallback(() => {
    if (!showLabelDraft.trim()) return;
    const token = normalizeShowLabelToken(showLabelDraft);
    setShowLabels((prev) => {
      if (prev.some((item) => normalizeShowLabelToken(item).toLowerCase() === token.toLowerCase())) {
        return prev;
      }
      const next = [...prev, token];
      persistShowLabels(next);
      return next;
    });
    setShowLabelDraft('');
  }, [persistShowLabels, showLabelDraft]);

  const clearShowLabels = React.useCallback(() => {
    setShowLabels([]);
    persistShowLabels([]);
  }, [persistShowLabels]);

  const showLabelChipOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const label of [...SUGGESTED_SHOW_LABELS, ...showLabels]) {
      const token = normalizeShowLabelToken(label);
      const key = token.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(token);
    }
    return options;
  }, [showLabels]);

  const isShowLabelFilterActive = showLabels.length > 0;

  const toggleRowGroup = React.useCallback((group: ImportRowMatchStatus) => {
    setSelectedRowGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (matchImportColumns.length === 0 || matchProductColumns.length === 0 || !activeImportId) {
      setMatchPreview(null);
      return;
    }
    const previewImportColumns = matchPreview?.match.import_columns ?? [];
    const previewProductColumns = matchPreview?.match.product_columns ?? (
      matchPreview?.match.product_column ? [matchPreview.match.product_column] : []
    );
    const previewMatchesCurrentConfig =
      previewImportColumns.length === matchImportColumns.length &&
      previewImportColumns.every((column, index) => column === matchImportColumns[index]) &&
      previewProductColumns.length === matchProductColumns.length &&
      previewProductColumns.every((column, index) => column === matchProductColumns[index]);
    if (previewMatchesCurrentConfig) return;
    const timer = setTimeout(() => {
      void previewMatch();
    }, 400);
    return () => clearTimeout(timer);
  }, [activeImportId, matchImportColumns, matchPreview, matchProductColumns, previewMatch, rowsData?.count]);

  const setColumnMapping = React.useCallback((importColumn: string, productColumn: string) => {
    setColumnMappings((prev) => {
      const next = { ...prev };
      const trimmed = productColumn.trim();
      if (!trimmed) delete next[importColumn];
      else next[importColumn] = trimmed;
      return next;
    });
  }, []);

  const mappedColumnCount = React.useMemo(
    () => Object.values(columnMappings).filter((value) => Boolean(value.trim())).length,
    [columnMappings],
  );

  const transferProductColumnOptions = React.useMemo(() => {
    const extras = Object.values(columnMappings).filter(
      (column) => column.trim() && !productColumns.includes(column),
    );
    const seen = new Set<string>();
    const options: string[] = [];
    for (const column of [...productColumns, ...extras]) {
      if (seen.has(column)) continue;
      seen.add(column);
      options.push(column);
    }
    return options;
  }, [columnMappings, productColumns]);

  const addMatchImportColumn = React.useCallback(() => {
    const column = matchImportColumnDraft.trim();
    if (!column) return;
    setMatchImportColumns((prev) => (prev.includes(column) ? prev : [...prev, column]));
    setMatchImportColumnDraft('');
  }, [matchImportColumnDraft]);

  const removeMatchImportColumn = React.useCallback((column: string) => {
    setMatchImportColumns((prev) => prev.filter((item) => item !== column));
  }, []);

  const addMatchProductColumn = React.useCallback(() => {
    const column = matchProductColumnDraft.trim();
    if (!column) return;
    setMatchProductColumns((prev) => (prev.includes(column) ? prev : [...prev, column]));
    setMatchProductColumnDraft('');
  }, [matchProductColumnDraft]);

  const removeMatchProductColumn = React.useCallback((column: string) => {
    setMatchProductColumns((prev) => prev.filter((item) => item !== column));
  }, []);

  const agentContextRef = React.useRef<Record<string, unknown>>({});
  const agentFieldPriority = React.useMemo(
    () => [
      ...matchImportColumns,
      'CODE NUMBER',
      'Code Number',
      'default_code',
      'Default Code',
      'Colecction Name',
      'Collection Name',
      ...matchProductColumns,
    ].filter(Boolean) as string[],
    [matchImportColumns, matchProductColumns],
  );
  agentContextRef.current = {
    app: 'products',
    module: 'imports',
    page_summary: isMatchConfigured
      ? `Excel Imports staging: ${searchFilteredImportRows.length} visible row(s); match ${matchImportColumns.join(' OR ')} → ${matchProductColumns.join(' OR ')}; ` +
        `${rowStatusCounts.matched} matched, ${rowStatusCounts.near} near, ${rowStatusCounts.unmatched} unmatched, ${rowStatusCounts.empty} empty in loaded import` +
        (debouncedSearch.trim() ? `; search="${debouncedSearch.trim()}"` : '')
      : 'Excel Imports staging table (not the main Products catalog list)' +
        (debouncedSearch.trim() ? `; search="${debouncedSearch.trim()}"` : ''),
    selected_product_ids: [],
    visible_product_ids: [],
    import_staging: {
      active_import_id: activeImportId,
      filename: rowsData?.import.filename ?? null,
      total_rows: rowsData?.count ?? 0,
      visible_rows_count: searchFilteredImportRows.length,
      search_query: debouncedSearch.trim() || null,
      hidden_rows_count: hiddenRowCount,
      show_hidden_rows: showHiddenRows,
      show_labels: showLabels,
      show_labels_filter_active: isShowLabelFilterActive,
      imports_count: imports.length,
      transfer_columns_selected: Object.keys(columnMappings).filter((key) => columnMappings[key]?.trim()),
      column_mappings: columnMappings,
      match: isMatchConfigured
        ? {
            configured: true,
            excel_columns: matchImportColumns,
            products_columns: matchProductColumns,
            logic: IMPORT_MATCH_LOGIC,
            totals_in_import: matchPreview
              ? {
                  total_rows: matchPreview.total_rows,
                  matched: matchPreview.matched_count,
                  near: matchPreview.near_count ?? 0,
                  unmatched: matchPreview.unmatched_count,
                  empty: matchPreview.empty_import_value_count,
                  source: 'server_preview',
                }
              : {
                  total_rows: matchableRows.length,
                  matched: rowStatusCounts.matched,
                  near: rowStatusCounts.near,
                  unmatched: rowStatusCounts.unmatched,
                  empty: rowStatusCounts.empty,
                  source: 'client_index',
                },
            visible_filter: {
              active_groups: Array.from(selectedRowGroups),
              group_labels: Array.from(selectedRowGroups).map((g) => ROW_MATCH_STATUS_LABELS[g]),
            },
            status_meanings: {
              matched: `Excel value matches an existing product in any selected Products column: ${matchProductColumns.join(' OR ')}`,
              near: `Not exact, but matches after ignoring ${NEAR_MATCH_CHARS_LABEL}`,
              unmatched: `Excel has a value in match column(s) but no product has that value in any selected Products column`,
              empty: 'All selected Excel match columns are blank for this row',
            },
            samples: {
              unmatched: (
                matchPreview?.unmatched_samples?.length
                  ? matchPreview.unmatched_samples
                  : collectUnmatchedSamplesForAgent(matchableRows, rowStatusById, matchImportColumns)
              ).slice(0, 8),
              near: (matchPreview?.near_samples ?? []).slice(0, 5),
              empty: (matchPreview?.empty_samples ?? []).slice(0, 5),
              matched: (matchPreview?.matched_samples ?? []).slice(0, 3),
            },
            matched: rowStatusCounts.matched,
            near: rowStatusCounts.near,
            unmatched: rowStatusCounts.unmatched,
            empty: rowStatusCounts.empty,
          }
        : {
            configured: false,
            hint: 'Select Excel match column(s) and a Products column, then run match preview to classify rows.',
          },
      columns: importColumns.slice(0, 40),
      visible_rows: searchFilteredImportRows.slice(0, AGENT_IMPORT_ROW_LIMIT).map((row) => ({
        id: row.id,
        row_label: (row.row_label ?? '').trim() || getImportRowDisplayLabel(row),
        match_status: rowStatusById.get(row.id) ?? null,
        source_sheet: row.source_sheet ?? null,
        source_row_number: row.source_row_number ?? null,
        fields: summarizeImportRowFieldsForAgent(row.fields ?? {}, agentFieldPriority),
      })),
    },
  };

  React.useEffect(() => {
    const w = window as unknown as { __lorenzoAgentContext?: () => Record<string, unknown> };
    w.__lorenzoAgentContext = () => agentContextRef.current;
    return () => {
      try {
        delete w.__lorenzoAgentContext;
      } catch {
        w.__lorenzoAgentContext = undefined;
      }
    };
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

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-2 lg:grid-cols-[240px_minmax(0,1fr)] lg:grid-rows-none lg:gap-3">
        <aside
          className={
            'flex shrink-0 flex-col overflow-hidden rounded-2xl border border-brand-medium-gray/30 bg-brand-white shadow-brand-card ' +
            'dark:border-white/10 dark:bg-black/25 max-lg:min-h-0'
          }
        >
          <button
            type="button"
            onClick={() => {
              if (!isLgScreen) setUploadPanelOpen((open) => !open);
            }}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left lg:pointer-events-none lg:cursor-default"
            aria-expanded={uploadPanelExpanded}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-black/50 dark:text-white/50">
              Upload &amp; imports
            </span>
            {!isLgScreen ? (
              <span className="text-[10px] font-black text-black/35 dark:text-white/35">
                {uploadPanelOpen ? '−' : '+'}
              </span>
            ) : null}
          </button>

          <div
            className={
              (uploadPanelExpanded ? 'flex' : 'hidden') +
              ' min-h-0 flex-col gap-2 border-t border-black/5 px-3 pb-3 pt-2 dark:border-white/5 ' +
              'max-lg:max-h-[min(38vh,320px)] max-lg:overflow-hidden lg:flex-1'
            }
          >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm,.numbers,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,application/x-iwork-numbers-sffnumbers"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            className="block w-full rounded-lg border border-black/10 bg-black/[0.02] px-2 py-1.5 text-[11px] font-medium text-black outline-none file:mr-2 file:rounded-full file:border-0 file:bg-black file:px-2.5 file:py-1 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:text-white dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:file:bg-white dark:file:text-black"
          />

          <button
            type="button"
            onClick={() => void uploadFile()}
            disabled={!selectedFile || isUploading}
            className="rounded-full bg-emerald-600 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>

          {message ? (
            <div className="rounded-lg border border-black/10 bg-black/[0.02] p-2 text-[11px] font-bold text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
              {message}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="mb-1.5 flex shrink-0 items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">
                Imports
              </h2>
              <span className="text-[9px] font-black text-black/30 dark:text-white/30">
                {imports.length}
              </span>
            </div>

            {importsLoading ? (
              <div className="rounded-lg bg-black/[0.03] p-3 text-[11px] font-bold text-black/40 dark:bg-white/[0.04] dark:text-white/40">
                Loading imports...
              </div>
            ) : importsError ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-[11px] font-bold text-red-500">
                Cannot access or connect to imports.
              </div>
            ) : imports.length === 0 ? (
              <div className="rounded-lg bg-black/[0.03] p-3 text-[11px] font-bold text-black/40 dark:bg-white/[0.04] dark:text-white/40">
                No files uploaded yet.
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto scrollbar-minimal">
                {imports.map(item => {
                  const active = item.id === activeImportId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedImportId(item.id)}
                      className={
                        'rounded-lg border p-2 text-left transition ' +
                        (active
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-black/5 bg-black/[0.02] hover:bg-black/[0.04] dark:border-white/5 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]')
                      }
                    >
                      <div className="truncate text-[11px] font-black text-black dark:text-white">{item.filename}</div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] font-bold text-black/40 dark:text-white/40">
                        <span>{item.row_count} rows</span>
                        <span>{item.warnings_count} warn</span>
                      </div>
                      <div className="mt-0.5 text-[9px] font-medium text-black/35 dark:text-white/35">{formatDate(item.created_at)}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-brand-medium-gray/30 bg-brand-white shadow-brand-card dark:border-white/10 dark:bg-black/25">
          <div className="space-y-1 border-b border-black/10 px-2 py-1.5 dark:border-white/10">
            <div className="pb-0.5">
              <ProductsHeaderSearch
                search={search}
                onSearchChange={setSearch}
                searchInputRef={searchInputRef}
                hasActiveFilters={search.trim().length > 0}
                onClearSearch={() => {
                  setSearch('');
                  searchInputRef.current?.focus();
                }}
                onClearAllFilters={() => {
                  setSearch('');
                  searchInputRef.current?.focus();
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 rounded-lg border border-black/10 bg-black/[0.02] px-1.5 py-1 dark:border-white/10 dark:bg-white/[0.03]">
                <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-black/35 dark:text-white/35">
                  Match
                </span>
                <div className="inline-flex min-w-0 flex-wrap items-center gap-1">
                  <span className="shrink-0 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">Excel</span>
                  <select
                    value={matchImportColumnDraft}
                    onChange={(event) => setMatchImportColumnDraft(event.target.value)}
                    className="h-7 min-w-0 max-w-[120px] rounded-md border border-black/10 bg-white px-1.5 text-[10px] font-semibold text-black outline-none dark:border-white/10 dark:bg-black/40 dark:text-white sm:max-w-[150px]"
                    aria-label="Excel import match columns"
                  >
                    <option value="">Column…</option>
                    {matchImportColumnOptions.map(column => (
                      <option key={column} value={column}>{column}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addMatchImportColumn}
                    disabled={!matchImportColumnDraft.trim()}
                    className="rounded-full border border-black/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-black/55 transition hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:text-white/55 dark:hover:bg-white/10"
                  >
                    Add
                  </button>
                  {matchImportColumns.map((column) => (
                    <button
                      key={column}
                      type="button"
                      onClick={() => removeMatchImportColumn(column)}
                      className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-200"
                      title="Remove column from Excel match"
                    >
                      {column} ×
                    </button>
                  ))}
                </div>
                <span className="text-[9px] text-black/25 dark:text-white/25">→</span>
                <div className="inline-flex min-w-0 flex-wrap items-center gap-1">
                  <span className="shrink-0 text-[9px] font-bold text-sky-700 dark:text-sky-300">Products</span>
                  <select
                    value={matchProductColumnDraft}
                    onChange={(event) => setMatchProductColumnDraft(event.target.value)}
                    className="h-7 min-w-0 max-w-[120px] rounded-md border border-black/10 bg-white px-1.5 text-[10px] font-semibold text-black outline-none dark:border-white/10 dark:bg-black/40 dark:text-white sm:max-w-[150px]"
                    aria-label="Products match columns"
                  >
                    <option value="">Column…</option>
                    {matchProductColumnOptions.map(column => (
                      <option key={column} value={column}>{column}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addMatchProductColumn}
                    disabled={!matchProductColumnDraft.trim()}
                    className="rounded-full border border-black/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-black/55 transition hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:text-white/55 dark:hover:bg-white/10"
                  >
                    Add
                  </button>
                  {matchProductColumns.map((column) => (
                    <button
                      key={column}
                      type="button"
                      onClick={() => removeMatchProductColumn(column)}
                      className="rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-200"
                      title="Remove column from Products match"
                    >
                      {column} ×
                    </button>
                  ))}
                </div>
                {isPreviewingMatch ? (
                  <span className="text-[9px] font-bold text-black/35 dark:text-white/35">…</span>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={!activeImportId || isReprocessing}
                  onClick={() => void reprocessImportRows()}
                  className="rounded-full border border-black/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-black/55 transition hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:text-white/55 dark:hover:bg-white/10"
                >
                  {isReprocessing ? '…' : 'Refresh'}
                </button>
                <button
                  type="button"
                  disabled={!activeImportId || isApplying || matchImportColumns.length === 0 || matchProductColumns.length === 0 || selectedRowGroups.size === 0}
                  onClick={() => void applyImportToProducts()}
                  className="rounded-full bg-emerald-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white transition hover:bg-emerald-700 disabled:opacity-40"
                >
                  {isApplying ? '…' : 'Apply'}
                </button>
                <button
                  type="button"
                  disabled={!activeImportId}
                  onClick={() => void deleteImport()}
                  className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-red-600 transition hover:bg-red-500 hover:text-white disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {ALL_ROW_GROUPS.map(status => (
                <label
                  key={status}
                  title={
                    status === 'near'
                      ? `Loose match ignoring: ${NEAR_MATCH_CHARS_LABEL}. Tick this to preview/apply those rows as product updates.`
                      : undefined
                  }
                  className={
                    'inline-flex cursor-pointer items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-black transition ' +
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
                    className="h-2.5 w-2.5 accent-emerald-600"
                  />
                  {ROW_MATCH_STATUS_LABELS[status]} {isMatchConfigured ? rowStatusCounts[status] : 0}
                </label>
              ))}

              <div
                className={
                  'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 transition ' +
                  (isVerifiedFilterActive
                    ? 'border-emerald-500/30 bg-emerald-500/10 dark:border-emerald-400/25 dark:bg-emerald-500/15'
                    : 'border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03]')
                }
                title="Isolate or exclude Matched rows based on whether the selected Products field has a value."
              >
                <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Verified
                </span>
                <select
                  value={verifiedMatchedColumn}
                  onChange={(event) => setVerifiedMatchedColumn(event.target.value)}
                  disabled={!isMatchConfigured}
                  className="h-5 max-w-[150px] rounded-md border border-black/10 bg-white px-1 text-[9px] font-bold text-black/70 outline-none disabled:opacity-40 dark:border-white/10 dark:bg-black/40 dark:text-white/70"
                  aria-label="Products field used to detect verified matched rows"
                  title="Field checked on the existing matched product."
                >
                  <option value="">Field…</option>
                  {verifiedMatchedColumnOptions.map(column => (
                    <option key={column} value={column}>{column}</option>
                  ))}
                </select>
                <label
                  className={
                    'inline-flex cursor-pointer items-center gap-1 rounded-md border px-1 py-0.5 text-[9px] font-black transition ' +
                    (verifiedProductValueRequired
                      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-200'
                      : 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:text-amber-200')
                  }
                  title={
                    verifiedProductValueRequired
                      ? 'Checked: match rows where this Products field has a value.'
                      : 'Unchecked: match rows where this Products field is empty/missing.'
                  }
                >
                  <input
                    type="checkbox"
                    checked={verifiedProductValueRequired}
                    onChange={(event) => setVerifiedProductValueRequired(event.target.checked)}
                    disabled={!isMatchConfigured || !verifiedMatchedColumn}
                    className="h-2.5 w-2.5 accent-emerald-600 disabled:opacity-40"
                  />
                  {verifiedProductValueRequired ? 'Has value' : 'No value'}
                </label>
                <div className="inline-flex overflow-hidden rounded-md border border-black/10 dark:border-white/10">
                  {VERIFIED_FILTER_MODES.map((mode) => {
                    const active = verifiedFilterMode === mode;
                    const showCount = mode !== 'off' && Boolean(verifiedMatchedColumn);
                    const targetText = verifiedProductValueRequired ? 'has a value' : 'is empty';
                    return (
                      <button
                        key={mode}
                        type="button"
                        disabled={mode !== 'off' && (!isMatchConfigured || !verifiedMatchedColumn)}
                        onClick={() => setVerifiedFilterMode(mode)}
                        aria-pressed={active}
                        title={
                          mode === 'off'
                            ? 'Show all matched rows'
                            : mode === 'only'
                              ? `Show only matched rows where this Products field ${targetText}`
                              : `Hide matched rows where this Products field ${targetText}`
                        }
                        className={
                          'px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40 ' +
                          (active
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-black/50 hover:bg-black/5 dark:bg-black/40 dark:text-white/50 dark:hover:bg-white/10')
                        }
                      >
                        {VERIFIED_FILTER_MODE_LABELS[mode]}
                        {showCount ? ` ${verifiedMatchedCount}` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              {hiddenRowCount > 0 ? (
                <span className="rounded-full border border-zinc-300/60 bg-zinc-100/80 px-1.5 py-0.5 text-[9px] font-bold text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
                  {hiddenRowCount} excluded
                </span>
              ) : null}

              <div
                className="inline-flex min-w-0 flex-wrap items-center gap-1 rounded-full border border-black/10 bg-black/[0.02] px-1.5 py-0.5 dark:border-white/10 dark:bg-white/[0.03]"
                title={
                  isShowLabelFilterActive
                    ? 'Only rows whose Label matches a selected chip are shown and eligible for Apply. Empty = blank Label cells.'
                    : 'No Show labels selected — all rows are visible. Toggle chips to whitelist Label values (including Empty).'
                }
              >
                <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-black/35 dark:text-white/35">
                  Show labels
                </span>
                {!isShowLabelFilterActive ? (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                    All
                  </span>
                ) : null}
                {showLabelChipOptions.map((label) => {
                  const selected = showLabels.some(
                    (item) => normalizeShowLabelToken(item).toLowerCase() === label.toLowerCase(),
                  );
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleShowLabel(label)}
                      aria-pressed={selected}
                      className={
                        'rounded-full border px-1.5 py-0.5 text-[9px] font-bold transition ' +
                        (selected
                          ? 'border-emerald-500/50 bg-emerald-600 text-white'
                          : 'border-zinc-300/60 bg-zinc-100/80 text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:text-white/55 dark:hover:bg-white/10')
                      }
                      title={
                        label === EMPTY_ROW_LABEL_TOKEN
                          ? selected
                            ? 'Stop showing blank Label rows'
                            : 'Show blank Label rows'
                          : selected
                            ? `Stop showing “${formatShowLabelChip(label)}”`
                            : `Show only rows labeled “${formatShowLabelChip(label)}” (with other selected chips)`
                      }
                    >
                      {formatShowLabelChip(label)}
                    </button>
                  );
                })}
                <input
                  value={showLabelDraft}
                  onChange={(event) => setShowLabelDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addShowLabel();
                    }
                  }}
                  placeholder="Add…"
                  className="h-5 w-16 min-w-0 rounded-md border border-black/10 bg-white px-1 text-[9px] font-semibold text-black outline-none dark:border-white/10 dark:bg-black/40 dark:text-white"
                  aria-label="Add a custom Label value to the show filter"
                />
                <button
                  type="button"
                  onClick={addShowLabel}
                  disabled={!showLabelDraft.trim()}
                  className="rounded-full border border-black/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-black/55 transition hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:text-white/55 dark:hover:bg-white/10"
                >
                  Add
                </button>
                {isShowLabelFilterActive ? (
                  <button
                    type="button"
                    onClick={clearShowLabels}
                    className="rounded-full border border-black/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-black/45 transition hover:bg-black/5 dark:border-white/10 dark:text-white/45 dark:hover:bg-white/10"
                    title="Clear show-labels filter (show all rows)"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            {matchPreviewError ? (
              <p className="text-[9px] font-bold text-red-600 dark:text-red-300">{matchPreviewError}</p>
            ) : null}

            <p className="truncate text-[9px] font-medium text-black/45 dark:text-white/45" title={rowsData?.import.filename}>
              {rowsData
                ? `${rowsData.import.filename} · ${searchFilteredImportRows.length}/${rowsData.count} shown` +
                  (debouncedSearch.trim() ? ` · search “${debouncedSearch.trim()}”` : '') +
                  (hiddenRowCount > 0 ? ` · ${hiddenRowCount} excluded by show-labels` : '') +
                  (isVerifiedFilterActive
                    ? verifiedFilterMode === 'only'
                      ? ` · showing ${verifiedMatchedCount} where ${verifiedMatchedColumn} ${verifiedProductValueRequired ? 'has value' : 'has no value'}`
                      : ` · ${verifiedMatchedCount} hidden where ${verifiedMatchedColumn} ${verifiedProductValueRequired ? 'has value' : 'has no value'}`
                    : '') +
                  ` · ${mappedColumnCount} mapped cols` +
                  (selectedRowGroups.size === 0 && !showHiddenRows ? ' · tick a group' : '')
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
                <thead className="sticky top-0 z-40 bg-white dark:bg-zinc-950">
                  <tr>
                    <th className="sticky left-0 top-0 z-50 min-w-[148px] whitespace-nowrap border-b border-r border-black/10 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black/40 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-zinc-950 dark:text-white/40 dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]">
                      <div className="flex flex-col gap-1.5">
                        <span>Label</span>
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[9px] font-bold normal-case tracking-normal text-black/55 dark:text-white/55">
                          <input
                            type="checkbox"
                            checked={showHiddenRows}
                            onChange={(event) => setShowHiddenRows(event.target.checked)}
                            className="h-3 w-3 accent-emerald-600"
                          />
                          Show excluded
                        </label>
                      </div>
                    </th>
                    <th className="sticky top-0 z-40 whitespace-nowrap border-b border-black/10 bg-white px-3 py-3 text-[10px] font-black uppercase tracking-widest text-black/40 dark:border-white/10 dark:bg-zinc-950 dark:text-white/40">
                      Match
                    </th>
                    <th className="sticky top-0 z-40 whitespace-nowrap border-b border-black/10 bg-white px-3 py-3 text-[10px] font-black uppercase tracking-widest text-black/40 dark:border-white/10 dark:bg-zinc-950 dark:text-white/40">
                      Sheet
                    </th>
                    <th className="sticky top-0 z-40 whitespace-nowrap border-b border-black/10 bg-white px-3 py-3 text-[10px] font-black uppercase tracking-widest text-black/40 dark:border-white/10 dark:bg-zinc-950 dark:text-white/40">
                      Row
                    </th>
                    {visibleColumns.map(column => (
                      <th
                        key={column}
                        className="sticky top-0 z-40 min-w-[140px] max-w-[200px] border-b border-black/10 bg-white px-2 py-2 text-[10px] font-black uppercase tracking-widest text-black/40 dark:border-white/10 dark:bg-zinc-950 dark:text-white/40"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="truncate" title={column}>{column}</span>
                          <select
                            value={columnMappings[column] ?? ''}
                            onChange={(event) => setColumnMapping(column, event.target.value)}
                            className={
                              'h-7 w-full min-w-0 rounded-md border px-1 text-[9px] font-semibold normal-case tracking-normal outline-none ' +
                              (columnMappings[column]?.trim()
                                ? 'border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-950/40 dark:text-emerald-100'
                                : 'border-black/10 bg-white text-black dark:border-white/10 dark:bg-black/40 dark:text-white')
                            }
                            aria-label={`Map ${column} to a Products column`}
                            title="Products column to receive this import column on Apply"
                          >
                            <option value="">— skip —</option>
                            {transferProductColumnOptions.map((productColumn) => (
                              <option key={productColumn} value={productColumn}>
                                {productColumn}
                              </option>
                            ))}
                          </select>
                        </div>
                      </th>
                    ))}
                    <th className="sticky top-0 z-40 whitespace-nowrap border-b border-black/10 bg-white px-3 py-3 text-[10px] font-black uppercase tracking-widest text-black/40 dark:border-white/10 dark:bg-zinc-950 dark:text-white/40">
                      Warnings
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {searchFilteredImportRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleColumns.length + 5}
                        className="border-b border-black/5 px-3 py-10 text-center text-xs font-bold text-black/40 dark:border-white/5 dark:text-white/40"
                      >
                        {debouncedSearch.trim() && filteredImportRows.length > 0
                          ? 'No rows match your search.'
                          : selectedRowGroups.size === 0 && !showHiddenRows
                            ? 'Tick at least one group (Matched, Near, Unmatched, or Empty) to view rows.'
                            : selectedRowGroups.size === 0 && showHiddenRows && hiddenRowCount === 0
                              ? 'No hidden rows in this import.'
                              : isVerifiedFilterActive && verifiedFilterMode === 'only' && verifiedMatchedCount === 0
                                ? `No matched rows where ${verifiedMatchedColumn} ${verifiedProductValueRequired ? 'has a value' : 'has no value'} in Products.`
                                : isVerifiedFilterActive && verifiedFilterMode === 'hide' && verifiedMatchedCount > 0
                                  ? `All visible matched rows match the ${verifiedMatchedColumn} ${verifiedProductValueRequired ? 'has value' : 'no value'} filter.`
                                  : 'No rows in the selected groups.'}
                      </td>
                    </tr>
                  ) : null}
                  {searchFilteredImportRows.map(row => {
                    const rowStatus = rowStatusById.get(row.id);
                    const rowHidden = isRowHiddenForView(row);
                    const rowTone = rowHidden
                      ? 'border-black/5 bg-zinc-100/90 text-black/55 dark:border-white/5 dark:bg-white/[0.04] dark:text-white/55'
                      : rowStatus
                        ? ROW_MATCH_ROW_CLASS[rowStatus]
                        : NEUTRAL_ROW_CLASS;
                    const displayLabel = getImportRowDisplayLabel(row);
                    const existingProduct =
                      (rowStatus === 'matched' || rowStatus === 'near') && matchImportColumns.length > 0
                        ? rowStatus === 'matched'
                          ? findExistingProductByColumn(row, existingProductIndex, matchImportColumns)
                          : findExistingProductByLooseColumn(row, existingLooseProductIndex, matchImportColumns)
                        : null;
                    const nearDetail = rowStatus === 'near' ? nearMatchDetailById.get(row.id) : undefined;

                    return (
                      <tr key={row.id} className={rowHidden ? 'opacity-90' : undefined}>
                        <td className="sticky left-0 z-20 min-w-[148px] border-b border-r border-black/5 bg-white px-2 py-1.5 align-top shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:border-white/5 dark:bg-zinc-950 dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.4)]">
                          <input
                            type="text"
                            defaultValue={displayLabel}
                            key={`${row.id}:${displayLabel}`}
                            disabled={savingLabelRowId === row.id}
                            placeholder="Note…"
                            title={
                              rowHidden
                                ? 'Excluded by Show labels — not matched or applied. Toggle Label chips to include this row.'
                                : 'Staging label — stays on this import only'
                            }
                            className="h-8 w-full min-w-[132px] rounded-md border border-black/10 bg-white/90 px-2 text-[11px] font-medium text-black outline-none placeholder:text-black/30 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 disabled:opacity-60 dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder:text-white/30"
                            onBlur={(event) => void saveRowLabel(row.id, event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                event.currentTarget.blur();
                              }
                            }}
                          />
                        </td>
                        <td className={'whitespace-nowrap border-b px-3 py-2 font-bold ' + rowTone}>
                          {rowHidden ? (
                            <span className="inline-block rounded-full bg-zinc-500/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                              Excluded
                            </span>
                          ) : rowStatus ? (
                            <span
                              className={'inline-flex max-w-[220px] flex-col gap-0.5'}
                              title={
                                rowStatus === 'near' && nearDetail
                                  ? `Near match ignoring (${nearDetail.ignored})\nExcel: ${nearDetail.importValue}\nProducts: ${nearDetail.productValue}`
                                  : undefined
                              }
                            >
                              <span className={'inline-block rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ' + ROW_MATCH_BADGE_CLASS[rowStatus]}>
                                {rowStatus === 'near' ? 'Near' : ROW_MATCH_STATUS_LABELS[rowStatus]}
                              </span>
                              {rowStatus === 'near' && nearDetail ? (
                                <span className="text-[8px] font-bold normal-case tracking-normal text-sky-700/80 dark:text-sky-200/80">
                                  ({nearDetail.ignored})
                                </span>
                              ) : null}
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
                          const isNearMatchingCell =
                            !isMatchingCell && existingProduct && rowStatus === 'near'
                              ? fieldNearMatchesExisting(row.fields[column], existingProduct.fields ?? {}, column)
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
                                (isNearMatchingCell ? ' ring-1 ring-inset ring-sky-500/40' : '') +
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
                                    <span className="line-clamp-3 whitespace-pre-line">
                                      {search.trim()
                                        ? highlightMatches(renderCell(row.fields[column], column), search)
                                        : renderCell(row.fields[column], column)}
                                    </span>
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
