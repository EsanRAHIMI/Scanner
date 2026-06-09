import type { ProductsRecord } from '@/types/trainer';
import { extractUrls, formatScalar } from './product-utils';

function parsePriceAsInteger(value: unknown): number | '' {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/,/g, '');
    if (!cleaned) return '';
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return '';
}

function resolveNumSortValue(record: ProductsRecord): number | string {
  const directNum = formatScalar(record.fields?.Num).trim();
  if (directNum) {
    const parsed = Number(directNum);
    return Number.isFinite(parsed) ? parsed : directNum.toLowerCase();
  }
  const variantNum = formatScalar(record.fields?.['Variant Number']).trim();
  if (variantNum) {
    const parsed = Number(variantNum);
    return Number.isFinite(parsed) ? parsed : variantNum.toLowerCase();
  }
  return '';
}

/** Export default: ascending Num, empty Num/Variant at the end. */
export function sortRecordsForExport(records: ProductsRecord[]): ProductsRecord[] {
  if (records.length <= 1) return records;
  return [...records].sort((a, b) => {
    const av = resolveNumSortValue(a);
    const bv = resolveNumSortValue(b);
    const aEmpty = av === '';
    const bEmpty = bv === '';
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av).localeCompare(String(bv));
  });
}

export function formatFieldValueForExport(value: unknown, columnName: string): string | number | boolean {
  if (value === null || value === undefined) return '';

  const colLower = columnName.trim().toLowerCase();
  if (colLower === 'price') {
    const price = parsePriceAsInteger(value);
    return price === '' ? '' : price;
  }
  if (colLower === 'image' || colLower === 'dam' || colLower === 'url' || colLower === 'video') {
    const urls = extractUrls(value);
    if (urls.length > 0) return urls.join(' | ');
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => formatScalar(item))
      .filter(Boolean)
      .join(' | ');
  }

  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  return formatScalar(value);
}

function buildExportFilename(): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `products-export-${stamp}.xlsx`;
}

export async function downloadProductsXlsx(
  records: ProductsRecord[],
  exportColumns: string[],
): Promise<void> {
  if (exportColumns.length === 0) {
    throw new Error('Select at least one column to export.');
  }
  if (records.length === 0) {
    throw new Error('No products to export.');
  }

  const XLSX = await import('xlsx');
  const sortedRecords = sortRecordsForExport(records);
  const rows = sortedRecords.map((record) =>
    exportColumns.map((column) => {
      const value = record.fields?.[column];
      return formatFieldValueForExport(value, column);
    }),
  );

  const worksheet = XLSX.utils.aoa_to_sheet([exportColumns, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = buildExportFilename();
  anchor.click();
  URL.revokeObjectURL(url);
}
