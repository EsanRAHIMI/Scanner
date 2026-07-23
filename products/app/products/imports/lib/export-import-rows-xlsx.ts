import { formatFieldValueForExport } from '../../lib/export-products-xlsx';
import { getImportRowDisplayLabel } from './import-row-visibility';

export type ImportExportRow = {
  id: string;
  row_label?: string;
  fields: Record<string, unknown>;
  warnings: string[];
  source_sheet?: string;
  source_row_number?: number;
};

export type ImportRowMatchStatus = 'matched' | 'near' | 'unmatched' | 'empty';

const MATCH_STATUS_EXPORT_LABELS: Record<ImportRowMatchStatus, string> = {
  matched: 'Matched',
  near: 'Near',
  unmatched: 'Unmatched',
  empty: 'Empty',
};

function sanitizeFilenamePart(value: string): string {
  const cleaned = value
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned.slice(0, 80) || 'import';
}

function buildExportFilename(importFilename?: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = importFilename ? sanitizeFilenamePart(importFilename) : 'import';
  return `${base}-filtered-${stamp}.xlsx`;
}

function resolveMatchExportValue(
  rowId: string,
  rowStatusById: Map<string, ImportRowMatchStatus> | undefined,
  hiddenRowIds?: Set<string>,
): string {
  if (hiddenRowIds?.has(rowId)) return 'Excluded';
  const status = rowStatusById?.get(rowId);
  if (!status) return '';
  return MATCH_STATUS_EXPORT_LABELS[status];
}

/**
 * Export the currently visible/filtered import table:
 * Label, Match, Sheet, Row, Excel columns, Warnings.
 */
export async function downloadImportRowsXlsx(options: {
  rows: ImportExportRow[];
  excelColumns: string[];
  rowStatusById?: Map<string, ImportRowMatchStatus>;
  hiddenRowIds?: Set<string>;
  importFilename?: string;
}): Promise<void> {
  const { rows, excelColumns, rowStatusById, hiddenRowIds, importFilename } = options;

  if (rows.length === 0) {
    throw new Error('No rows to export.');
  }

  const headers = ['Label', 'Match', 'Sheet', 'Row', ...excelColumns, 'Warnings'];

  const dataRows = rows.map((row) => {
    const label = getImportRowDisplayLabel(row);
    const match = resolveMatchExportValue(row.id, rowStatusById, hiddenRowIds);
    const sheet = (row.source_sheet ?? '').trim();
    const sourceRow =
      row.source_row_number == null || !Number.isFinite(row.source_row_number)
        ? ''
        : row.source_row_number;
    const fieldValues = excelColumns.map((column) =>
      formatFieldValueForExport(row.fields?.[column], column),
    );
    const warnings = (row.warnings ?? []).filter(Boolean).join(' / ');

    return [label, match, sheet, sourceRow, ...fieldValues, warnings];
  });

  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Import');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = buildExportFilename(importFilename);
  anchor.click();
  URL.revokeObjectURL(url);
}
