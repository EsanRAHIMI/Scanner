import * as React from 'react';
import type { ProductsRecord, ProductsAssetsResponse } from '@/types/trainer';
import { apiFetch } from '@/lib/api';
import { resolveExactFieldNames } from '../lib/product-mutation-utils';
import {
  isVideoUrl,
  sameProductMediaUrl,
  collectMergedProductMediaUrls,
  applyMediaListChange,
} from '../lib/product-utils';

interface UseProductDragDropProps {
  applyCacheUpdate: (
    updater: (prev: ProductsAssetsResponse) => ProductsAssetsResponse,
  ) => Promise<ProductsAssetsResponse | null>;
  handleSaveField: (recordId: string, fieldName: string, newValue: unknown, records: ProductsRecord[]) => Promise<void>;
  handleSaveFields?: (recordId: string, fieldsPatch: Record<string, unknown>, records: ProductsRecord[]) => Promise<void>;
  records: ProductsRecord[];
  columns: string[];
}

export function useProductDragDrop({
  applyCacheUpdate,
  handleSaveField,
  handleSaveFields,
  records,
  columns,
}: UseProductDragDropProps) {
  const [draggedUrlInfo, setDraggedUrlInfo] = React.useState<{ url: string; sourceId: string; sourceColumn: string } | null>(null);
  const activeDropTargetRef = React.useRef<HTMLElement | null>(null);

  const handleMoveUrl = React.useCallback(async (url: string, fromId: string, toId: string, targetCol?: string) => {
    if (fromId === toId) return;

    let finalUrlToMove = url;

    if (targetCol?.trim().toLowerCase() === 'video' && !isVideoUrl(finalUrlToMove)) {
      finalUrlToMove = finalUrlToMove.trim() + '#video';
    } else if (targetCol?.trim().toLowerCase() !== 'video' && isVideoUrl(finalUrlToMove)) {
      finalUrlToMove = finalUrlToMove.replace('#video', '').trim();
    }

    const sourceRecord = records.find(r => r.id === fromId);
    const targetRecord = records.find(r => r.id === toId);
    if (!sourceRecord || !targetRecord) return;

    const sourceMerged = collectMergedProductMediaUrls(sourceRecord.fields, columns);
    const targetMerged = collectMergedProductMediaUrls(targetRecord.fields, columns);

    const sourceNext = sourceMerged.filter((u) => !sameProductMediaUrl(u, url));
    const targetHasUrl = targetMerged.some((u) => sameProductMediaUrl(u, finalUrlToMove));
    const targetNext = targetHasUrl ? targetMerged : [...targetMerged, finalUrlToMove];

    const sourcePatch = resolveExactFieldNames(
      columns,
      applyMediaListChange(sourceRecord.fields, columns, sourceNext),
    );
    const targetPatch = resolveExactFieldNames(
      columns,
      applyMediaListChange(targetRecord.fields, columns, targetNext),
    );

    if (Object.keys(sourcePatch).length === 0 && Object.keys(targetPatch).length === 0) return;

    const previousFieldsById: Record<string, Record<string, unknown> | undefined> = {
      [fromId]: sourceRecord.fields,
      [toId]: targetRecord.fields,
    };

    const applyPatchesToRecord = (
      fields: Record<string, unknown>,
      patch: Record<string, unknown>,
    ) => ({ ...fields, ...patch });

    try {
      await applyCacheUpdate((prev) => ({
        ...prev,
        records: prev.records.map((r) => {
          if (r.id === fromId) {
            return { ...r, fields: applyPatchesToRecord(r.fields, sourcePatch) };
          }
          if (r.id === toId) {
            return { ...r, fields: applyPatchesToRecord(r.fields, targetPatch) };
          }
          return r;
        }),
      }));

      if (handleSaveFields) {
        await Promise.all([
          Object.keys(sourcePatch).length > 0
            ? handleSaveFields(fromId, sourcePatch, records)
            : Promise.resolve(),
          Object.keys(targetPatch).length > 0
            ? handleSaveFields(toId, targetPatch, records)
            : Promise.resolve(),
        ]);
      } else {
        const requests: Promise<Response>[] = [];
        if (Object.keys(targetPatch).length > 0) requests.push(apiFetchPatch(toId, columns, targetPatch));
        if (Object.keys(sourcePatch).length > 0) requests.push(apiFetchPatch(fromId, columns, sourcePatch));
        const results = await Promise.all(requests);
        if (!results.every((res) => res.ok)) {
          throw new Error('Move URL API failed');
        }
      }
    } catch (err) {
      await applyCacheUpdate((prev) => ({
        ...prev,
        records: prev.records.map((r) => {
          const rollback = previousFieldsById[r.id];
          return rollback ? { ...r, fields: rollback } : r;
        }),
      }));
      throw err;
    }
  }, [columns, records, applyCacheUpdate, handleSaveFields]);

  const handleReorderUrls = React.useCallback(
    async (recordId: string, fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      const record = records.find((r) => r.id === recordId);
      if (!record) return;

      const urls = collectMergedProductMediaUrls(record.fields, columns);
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= urls.length ||
        toIndex >= urls.length
      ) {
        return;
      }

      const next = [...urls];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      const patch = resolveExactFieldNames(
        columns,
        applyMediaListChange(record.fields, columns, next),
      );
      if (Object.keys(patch).length === 0) return;

      if (handleSaveFields) {
        await handleSaveFields(recordId, patch, records);
      } else {
        const res = await apiFetchPatch(recordId, columns, patch);
        if (!res.ok) {
          throw new Error('Reorder URLs API failed');
        }
      }
    },
    [columns, records, handleSaveFields],
  );

  return {
    draggedUrlInfo,
    setDraggedUrlInfo,
    activeDropTargetRef,
    handleMoveUrl,
    handleReorderUrls,
  };
}

function apiFetchPatch(
  recordId: string,
  columns: string[],
  fields: Record<string, unknown>,
) {
  const resolved = resolveExactFieldNames(columns, fields);
  return apiFetch(`/products/assets/${recordId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: resolved }),
  });
}
