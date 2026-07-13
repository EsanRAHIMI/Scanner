import type { ProductsAssetsResponse } from '@/types/trainer';

/** Merge PATCH response fields into an optimistic snapshot (keeps other records/fields intact). */
export function mergeServerRecordIntoSnapshot(
  snapshot: ProductsAssetsResponse,
  serverRecord: { id: string; fields: Record<string, unknown> },
): ProductsAssetsResponse {
  return {
    ...snapshot,
    records: snapshot.records.map((r) =>
      r.id === serverRecord.id
        ? { ...r, fields: { ...(r.fields ?? {}), ...serverRecord.fields } }
        : r,
    ),
  };
}

/** Prefer canonical spellings; fall back to legacy column keys present in `columns`. */
const FIELD_ALIAS_CANDIDATES: Record<string, string[]> = {
  'collection name': ['Collection Name', 'Colecction Name', 'Name'],
  'colecction name': ['Collection Name', 'Colecction Name', 'Name'],
  'collection code': ['Collection Code', 'Colecction Code', 'Code'],
  'colecction code': ['Collection Code', 'Colecction Code', 'Code'],
};

function pickExactColumn(columns: string[], candidates: string[]): string | null {
  const byLower = new Map(columns.map((c) => [c.trim().toLowerCase(), c]));
  for (const candidate of candidates) {
    const found = byLower.get(candidate.trim().toLowerCase());
    if (found) return found;
  }
  return null;
}

/** Map a UI / legacy field label to the exact Mongo field key from `columns`. */
export function resolveExactFieldName(columns: string[], fieldName: string): string {
  const resolved = resolveExactFieldNames(columns, { [fieldName]: '' });
  return Object.keys(resolved)[0] ?? fieldName.trim();
}

/** Resolve every key in a PATCH body to exact column names (avoids duplicate fields). */
export function resolveExactFieldNames(
  columns: string[],
  fieldsPatch: Record<string, unknown>,
): Record<string, unknown> {
  const byLower = new Map(columns.map((c) => [c.trim().toLowerCase(), c]));
  const resolved: Record<string, unknown> = {};

  for (const [fieldName, value] of Object.entries(fieldsPatch)) {
    const key = fieldName.trim().toLowerCase();
    const aliasCandidates = FIELD_ALIAS_CANDIDATES[key];
    const exact =
      byLower.get(key) ??
      (aliasCandidates ? pickExactColumn(columns, aliasCandidates) : null) ??
      fieldName.trim();

    resolved[exact] = value;
  }

  return resolved;
}
