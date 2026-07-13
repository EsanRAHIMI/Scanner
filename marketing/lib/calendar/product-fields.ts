import { extractUrls, getGoogleDriveFileId, getMediaPreviewUrl, isImageUrl } from './utils';

export function getFirstStringField(fields: Record<string, unknown> | undefined, keys: string[]): string {
  if (!fields) return '';
  for (const key of keys) {
    const v = fields[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  }
  return '';
}

export function getProductCollectionName(fields: Record<string, unknown> | undefined): string {
  return getFirstStringField(fields, ['Colecction Name', 'Collection Name', 'Name']);
}

export function getProductCodeNumber(fields: Record<string, unknown> | undefined): string {
  return getFirstStringField(fields, ['CODE NUMBER', 'Code Number', 'Code No']);
}

export function getProductCollectionCode(fields: Record<string, unknown> | undefined): string {
  return getFirstStringField(fields, ['Colecction Code', 'Collection Code', 'Code']);
}

/** Primary display label for calendar Product field (collection name). */
export function getProductDisplayLabel(
  record: { id: string; fields: Record<string, unknown> },
): string {
  return getProductCollectionName(record.fields) || record.id;
}

export function getProductMediaUrls(
  fields: Record<string, unknown> | undefined,
  urlFieldName = 'URL',
): string[] {
  if (!fields) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: unknown) => {
    for (const u of extractUrls(raw)) {
      if (!seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    }
  };
  for (const key of ['Image', 'Main', urlFieldName, 'DAM', 'Video']) {
    if (key in fields) add(fields[key]);
  }
  return out;
}

export function getProductPreviewUrl(
  fields: Record<string, unknown> | undefined,
  urlFieldName = 'URL',
): string {
  const urls = getProductMediaUrls(fields, urlFieldName);
  const firstVisual = urls.find((u) => isImageUrl(u) || getGoogleDriveFileId(u));
  return firstVisual ? getMediaPreviewUrl(firstVisual) : '';
}

export function getProductNum(fields: Record<string, unknown> | undefined): string {
  return getFirstStringField(fields, ['Num', 'Variant Number']);
}

export function getProductNumSortValue(fields: Record<string, unknown> | undefined): number | null {
  const raw = getProductNum(fields);
  if (!raw) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : null;
}

/** Group key for variant counts (same collection / family). */
export function getProductFamilyKey(fields: Record<string, unknown> | undefined): string {
  const name = getProductCollectionName(fields);
  if (name) return `name:${name.toLowerCase()}`;
  const code = getProductCollectionCode(fields);
  if (code) return `code:${code.toLowerCase()}`;
  return '';
}

export function getProductFamilyDisplayKey(fields: Record<string, unknown> | undefined): string {
  return getProductCollectionName(fields) || getProductCollectionCode(fields);
}

export function buildVariantCounts(
  records: Array<{ fields: Record<string, unknown> }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of records) {
    const key = getProductFamilyDisplayKey(r.fields);
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function getVariantCountForRecord(
  record: { fields: Record<string, unknown> },
  variantCounts: Record<string, number>,
): number {
  const key = getProductFamilyDisplayKey(record.fields);
  if (!key) return 1;
  return variantCounts[key] ?? 1;
}

export function countProductImageUrls(
  fields: Record<string, unknown> | undefined,
  urlFieldName = 'URL',
): number {
  return getProductMediaUrls(fields, urlFieldName).filter(
    (u) => isImageUrl(u) || getGoogleDriveFileId(u),
  ).length;
}

export function sortProductsByNum<T extends { id: string; fields: Record<string, unknown> }>(
  records: T[],
): T[] {
  return [...records].sort((a, b) => {
    const aNum = getProductNumSortValue(a.fields);
    const bNum = getProductNumSortValue(b.fields);
    if (aNum === null && bNum === null) return a.id.localeCompare(b.id);
    if (aNum === null) return 1;
    if (bNum === null) return -1;
    if (aNum !== bNum) return aNum - bNum;
    const aMain = a.fields?.Main === true;
    const bMain = b.fields?.Main === true;
    if (aMain !== bMain) return aMain ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

export function productMatchesSearch(
  record: { id: string; fields: Record<string, unknown> },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const parts = [
    record.id,
    getProductCollectionName(record.fields),
    getProductCodeNumber(record.fields),
    getProductCollectionCode(record.fields),
    getProductNum(record.fields),
  ];
  return parts.some((p) => p.toLowerCase().includes(q));
}
