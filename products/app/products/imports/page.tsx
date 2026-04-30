'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';

import { apiFetch } from '@/lib/api';
import { useProductsCache } from '../../products-cache-provider';
import { formatPrice, formatScalar } from '../lib/product-utils';
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

function buildProductMatchKeys(fields: Record<string, unknown>) {
  const collectionName = normalizeComparable(getFirstField(fields, ['Colecction Name', 'Collection Name', 'Name']));
  const collectionCode = normalizeComparable(getFirstField(fields, ['Colecction Code', 'Collection Code', 'Code']));
  const variant = normalizeComparable(getFirstField(fields, ['Variant Number', 'Variant', 'Num']));
  const codeNumber = normalizeComparable(getFirstField(fields, ['CODE NUMBER', 'Code Number', 'Code No']));

  return [
    codeNumber ? `code-number:${codeNumber}` : '',
    collectionCode && variant ? `collection-code-variant:${collectionCode}:${variant}` : '',
    collectionName && variant ? `collection-name-variant:${collectionName}:${variant}` : '',
    collectionCode ? `collection-code:${collectionCode}` : '',
  ].filter(Boolean);
}

function getEquivalentFieldValue(fields: Record<string, unknown>, column: string) {
  const lower = column.trim().toLowerCase();
  const aliases: Record<string, string[]> = {
    'colecction name': ['Colecction Name', 'Collection Name', 'Name'],
    'collection name': ['Colecction Name', 'Collection Name', 'Name'],
    name: ['Colecction Name', 'Collection Name', 'Name'],
    'colecction code': ['Colecction Code', 'Collection Code', 'Code'],
    'collection code': ['Colecction Code', 'Collection Code', 'Code'],
    code: ['Colecction Code', 'Collection Code', 'Code'],
    'variant number': ['Variant Number', 'Variant', 'Num'],
    variant: ['Variant Number', 'Variant', 'Num'],
    num: ['Num', 'Variant Number', 'Variant'],
    'code number': ['CODE NUMBER', 'Code Number', 'Code No'],
    'dimension (mm)': ['DIMENSION (mm)', 'Dimension (mm)', 'DIMENSION', 'Dimension', 'Dimensions', 'Size'],
  };
  return getFirstField(fields, aliases[lower] ?? [column]);
}

function buildExistingProductIndex(records: ProductsRecord[]) {
  const index = new Map<string, ProductsRecord>();
  for (const record of records) {
    for (const key of buildProductMatchKeys(record.fields ?? {})) {
      if (!index.has(key)) index.set(key, record);
    }
  }
  return index;
}

function findExistingProduct(row: ProductImportRow, index: Map<string, ProductsRecord>) {
  for (const key of buildProductMatchKeys(row.fields ?? {})) {
    const product = index.get(key);
    if (product) return product;
  }
  return null;
}

function fieldMatchesExisting(rowValue: unknown, existingFields: Record<string, unknown>, column: string) {
  const left = normalizeComparable(rowValue);
  if (!left) return false;
  const right = normalizeComparable(getEquivalentFieldValue(existingFields, column));
  return Boolean(right) && left === right;
}

export default function ProductImportsPage() {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [selectedImportId, setSelectedImportId] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [editingCell, setEditingCell] = React.useState<EditingCell | null>(null);
  const [savingCellKey, setSavingCellKey] = React.useState<string | null>(null);
  const saveInFlightRef = React.useRef(false);
  const { data: productsData } = useProductsCache();

  const {
    data: importsData,
    error: importsError,
    isLoading: importsLoading,
    mutate: mutateImports,
  } = useSWR<ImportsResponse>('/admin/products/imports', fetchJson);

  const imports = importsData?.imports ?? [];
  const activeImportId = selectedImportId ?? imports[0]?.id ?? null;

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
    if (!selectedImportId && imports[0]?.id) {
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
      setMessage('فایل آپلود و به لیست جدید تبدیل شد.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteImport = async () => {
    if (!activeImportId) return;
    const ok = window.confirm('این import staging حذف شود؟ جدول اصلی محصولات تغییر نمی‌کند.');
    if (!ok) return;
    setMessage(null);
    try {
      const res = await apiFetch(`/admin/products/imports/${activeImportId}`, { method: 'DELETE' });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Delete failed');
      setSelectedImportId(null);
      await mutateImports();
      await mutateRows(undefined, { revalidate: false });
      setMessage('Import حذف شد.');
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
    } catch (err) {
      await mutateRows(previousData, { revalidate: false });
      setMessage(err instanceof Error ? err.message : 'Cell update failed');
    } finally {
      setSavingCellKey(null);
      saveInFlightRef.current = false;
    }
  }, [activeImportId, editingCell, mutateRows, rowsData]);

  const columns = rowsData?.columns ?? [];
  const existingProductIndex = React.useMemo(
    () => buildExistingProductIndex(productsData?.records ?? []),
    [productsData?.records]
  );
  const matchedRowsCount = React.useMemo(() => {
    if (!rowsData) return 0;
    return rowsData.records.filter(row => findExistingProduct(row, existingProductIndex)).length;
  }, [existingProductIndex, rowsData]);
  const visibleColumns = React.useMemo(() => {
    const preferred = [
      'Image',
      'DAM',
      'Video',
      'Price',
      'URL',
      'Colecction Name',
      'Colecction Code',
      'Variant Number',
      'Category',
      'Space',
      'Color',
      'Material',
      'DIMENSION (mm)',
      'Note',
      'CODE NUMBER',
      'L000',
      'Num',
      'Main',
      'Content Calendar',
    ];
    return [
      ...preferred.filter(column => columns.includes(column)),
      ...columns.filter(column => !preferred.includes(column)),
    ];
  }, [columns]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden animate-fade-in">
      <div className="flex flex-col gap-3 border-b border-black/10 pb-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-xs font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
              Dashboard
            </Link>
            <span className="text-black/20 dark:text-white/20">/</span>
            <Link href="/products" className="text-xs font-black uppercase tracking-widest text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white">
              Products
            </Link>
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-black dark:text-white">
            Excel Product Imports
          </h1>
          <p className="mt-1 max-w-3xl text-sm font-medium text-black/45 dark:text-white/45">
            فایل اکسل در یک جدول staging جدا پاکسازی و نمایش داده می‌شود. جدول اصلی محصولات در این صفحه تغییر نمی‌کند.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-700 dark:text-amber-300">
          Safe staging only
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col gap-4 rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black/25">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-black/60 dark:text-white/60">
              Upload Spreadsheet
            </h2>
            <p className="mt-1 text-xs font-medium text-black/40 dark:text-white/40">
              فایل‌های xlsx، xlsm و numbers پشتیبانی می‌شوند.
            </p>
          </div>

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
            className="rounded-full bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isUploading ? 'Uploading...' : 'Upload and Convert'}
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
                دسترسی یا اتصال به importها ممکن نیست.
              </div>
            ) : imports.length === 0 ? (
              <div className="rounded-xl bg-black/[0.03] p-4 text-xs font-bold text-black/40 dark:bg-white/[0.04] dark:text-white/40">
                هنوز فایلی آپلود نشده است.
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

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-black/25">
          <div className="flex flex-col gap-3 border-b border-black/10 p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-black/60 dark:text-white/60">
                Staged Product List
              </h2>
              <p className="mt-1 text-xs font-medium text-black/40 dark:text-white/40">
                {rowsData ? `${rowsData.records.length} of ${rowsData.count} row(s) shown from ${rowsData.import.filename} • ${matchedRowsCount} matched old product(s)` : 'یک import را انتخاب کن.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!activeImportId}
                onClick={() => void mutateRows()}
                className="rounded-full border border-black/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black/60 transition hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/10"
              >
                Refresh
              </button>
              <button
                type="button"
                disabled={!activeImportId}
                onClick={() => void deleteImport()}
                className="rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-600 transition hover:bg-red-500 hover:text-white disabled:opacity-40"
              >
                Delete Import
              </button>
            </div>
          </div>

          {rowsError ? (
            <div className="m-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-bold text-red-500">
              ردیف‌های import قابل دریافت نیستند.
            </div>
          ) : rowsLoading ? (
            <div className="m-4 rounded-xl bg-black/[0.03] p-4 text-xs font-bold text-black/40 dark:bg-white/[0.04] dark:text-white/40">
              Loading staged rows...
            </div>
          ) : !rowsData ? (
            <div className="m-4 rounded-xl bg-black/[0.03] p-4 text-xs font-bold text-black/40 dark:bg-white/[0.04] dark:text-white/40">
              بعد از آپلود اکسل، لیست تبدیل‌شده اینجا نمایش داده می‌شود.
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto scrollbar-minimal">
              <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
                <thead className="sticky top-0 z-10 bg-white dark:bg-zinc-950">
                  <tr>
                    <th className="whitespace-nowrap border-b border-black/10 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-black/40 dark:border-white/10 dark:text-white/40">
                      Sheet
                    </th>
                    <th className="whitespace-nowrap border-b border-black/10 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-black/40 dark:border-white/10 dark:text-white/40">
                      Row
                    </th>
                    {visibleColumns.map(column => (
                      <th
                        key={column}
                        className="max-w-[180px] whitespace-nowrap border-b border-black/10 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-black/40 dark:border-white/10 dark:text-white/40"
                      >
                        {column}
                      </th>
                    ))}
                    <th className="whitespace-nowrap border-b border-black/10 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-black/40 dark:border-white/10 dark:text-white/40">
                      Warnings
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rowsData.records.map(row => {
                    const existingProduct = findExistingProduct(row, existingProductIndex);
                    const isMatchedOldProduct = Boolean(existingProduct);

                    return (
                      <tr key={row.id} className="odd:bg-black/[0.015] dark:odd:bg-white/[0.02]">
                        <td className={
                          'whitespace-nowrap border-b px-3 py-2 font-bold ' +
                          (isMatchedOldProduct
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'border-black/5 text-black/45 dark:border-white/5 dark:text-white/45')
                        }>
                          <div>{row.source_sheet || '—'}</div>
                          {isMatchedOldProduct ? (
                            <div className="mt-1 text-[9px] font-black uppercase tracking-widest">
                              Old product
                            </div>
                          ) : null}
                        </td>
                        <td className={
                          'whitespace-nowrap border-b px-3 py-2 font-bold ' +
                          (isMatchedOldProduct
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'border-black/5 text-black/45 dark:border-white/5 dark:text-white/45')
                        }>
                          {row.source_row_number ?? '—'}
                        </td>
                        {visibleColumns.map(column => {
                          const isMatchingCell = existingProduct
                            ? fieldMatchesExisting(row.fields[column], existingProduct.fields ?? {}, column)
                            : false;
                          const isPriceColumn = column.trim().toLowerCase() === 'price';
                          const isEditingThisCell = editingCell?.rowId === row.id && editingCell.column === column;
                          const cellKey = `${row.id}:${column}`;
                          const isSavingThisCell = savingCellKey === cellKey;

                          return (
                            <td
                              key={`${row.id}-${column}`}
                              className={
                                'relative max-w-[220px] border-b p-0 align-top ' +
                                (isMatchingCell
                                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
                                  : 'border-black/5 text-black/70 dark:border-white/5 dark:text-white/70') +
                                (isPriceColumn ? ' font-bold' : '')
                              }
                              title={renderCell(row.fields[column], column)}
                            >
                              {isEditingThisCell ? (
                                <div className="relative min-h-[38px] w-full">
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
                                    'block min-h-[38px] w-full px-3 py-2 text-left text-xs transition hover:bg-emerald-500/10 disabled:cursor-wait disabled:opacity-60 ' +
                                    (isPriceColumn ? 'font-bold' : 'font-medium')
                                  }
                                >
                                  <span className="line-clamp-3 whitespace-pre-line">{isSavingThisCell ? 'Saving...' : renderCell(row.fields[column], column)}</span>
                                </button>
                              )}
                            </td>
                          );
                        })}
                        <td className="max-w-[260px] border-b border-black/5 px-3 py-2 align-top dark:border-white/5">
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
