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
