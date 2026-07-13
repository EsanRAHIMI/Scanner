'use client';

import * as React from 'react';
import type { ProductsRecord } from '@/types/trainer';
import { downloadProductsXlsx } from '../lib/export-products-xlsx';

interface ProductsExcelExportProps {
  records: ProductsRecord[];
  allColumns: string[];
  /** Same order as the products list table (change-control export UI). */
  columnOrder?: string[];
  hasActiveRowFilters: boolean;
}

function orderColumnsLikeTable(allColumns: string[], columnOrder?: string[]): string[] {
  if (!columnOrder?.length) return allColumns;
  const available = new Set(allColumns);
  const ordered = columnOrder.filter((column) => available.has(column));
  const orderedSet = new Set(ordered);
  const rest = allColumns.filter((column) => !orderedSet.has(column));
  return [...ordered, ...rest];
}

export function ProductsExcelExport({
  records,
  allColumns,
  columnOrder,
  hasActiveRowFilters,
}: ProductsExcelExportProps) {
  const orderedColumns = React.useMemo(
    () => orderColumnsLikeTable(allColumns, columnOrder),
    [allColumns, columnOrder],
  );
  const [expanded, setExpanded] = React.useState(false);
  const [selectedColumns, setSelectedColumns] = React.useState<Set<string>>(() => new Set(orderedColumns));
  const [exporting, setExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Stable key — parent passes a new `columns` array reference on every SWR/cache refresh
  // even when column names are unchanged; do not reset user selection on those re-renders.
  const columnsKey = orderedColumns.join('\u0000');

  React.useEffect(() => {
    setSelectedColumns(new Set(orderedColumns));
  }, [columnsKey]);

  const toggleColumn = React.useCallback((column: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  }, []);

  const selectAllColumns = React.useCallback(() => {
    setSelectedColumns(new Set(orderedColumns));
  }, [orderedColumns]);

  const clearAllColumns = React.useCallback(() => {
    setSelectedColumns(new Set());
  }, []);

  const handleExport = React.useCallback(async () => {
    setError(null);
    const exportColumns = orderedColumns.filter((column) => selectedColumns.has(column));
    setExporting(true);
    try {
      await downloadProductsXlsx(records, exportColumns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [orderedColumns, records, selectedColumns]);

  const selectedCount = selectedColumns.size;

  return (
    <div className="rounded-xl border border-emerald-300/45 bg-emerald-50/80 dark:border-emerald-500/25 dark:bg-emerald-500/10">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0 text-xs text-emerald-950 dark:text-emerald-100">
          <p className="font-semibold">Excel export (.xlsx)</p>
          <p className="mt-0.5 text-[11px] text-emerald-900/75 dark:text-emerald-100/75">
            {hasActiveRowFilters
              ? `${records.length.toLocaleString('en-US')} filtered row(s) · choose columns for Aippo import`
              : `${records.length.toLocaleString('en-US')} row(s) · all products (no search/filter active)`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-full border border-emerald-500/25 bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-800 transition hover:bg-white dark:border-emerald-400/20 dark:bg-black/30 dark:text-emerald-200 dark:hover:bg-black/45"
          >
            {expanded ? 'Hide columns' : 'Choose columns'}
          </button>
          <button
            type="button"
            disabled={exporting || records.length === 0 || selectedCount === 0}
            onClick={() => void handleExport()}
            className="rounded-full bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {exporting ? 'Exporting…' : 'Download .xlsx'}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-emerald-300/35 px-3 py-2 dark:border-emerald-500/20">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-900/70 dark:text-emerald-100/70">
              Columns ({selectedCount}/{orderedColumns.length})
            </span>
            <button
              type="button"
              onClick={selectAllColumns}
              className="text-[10px] font-bold text-emerald-700 hover:underline dark:text-emerald-300"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAllColumns}
              className="text-[10px] font-bold text-emerald-700 hover:underline dark:text-emerald-300"
            >
              Clear all
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-emerald-500/15 bg-white/60 p-2 dark:border-emerald-400/15 dark:bg-black/25">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {orderedColumns.map((column) => (
                <label
                  key={column}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] font-semibold text-emerald-950 hover:bg-emerald-500/10 dark:text-emerald-100"
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.has(column)}
                    onChange={() => toggleColumn(column)}
                    className="h-3 w-3 accent-emerald-600"
                  />
                  <span className="truncate" title={column}>
                    {column}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="border-t border-red-300/35 px-3 py-2 text-[11px] font-semibold text-red-700 dark:border-red-500/25 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
