import * as React from 'react';
import type { ProductsRecord, ProductsAssetsResponse } from '@/types/trainer';
import { apiFetch } from '@/lib/api';
import { logFrontendEvent } from '../lib/product-service';
import {
  formatScalar,
  getCollectionKey,
  resolveCollectionName,
  patchTouchesCollectionIdentity,
  applyMediaListChange,
  collectMergedProductMediaUrls,
  sameProductMediaUrl,
} from '../lib/product-utils';
import {
  mergeServerRecordIntoSnapshot,
  resolveExactFieldName,
  resolveExactFieldNames,
} from '../lib/product-mutation-utils';

interface UseProductMutationsProps {
  applyCacheUpdate: (
    updater: (prev: ProductsAssetsResponse) => ProductsAssetsResponse,
  ) => Promise<ProductsAssetsResponse | null>;
  commitOptimisticSnapshot: (optimisticData: ProductsAssetsResponse) => Promise<void>;
  mutate: (optimisticData?: ProductsAssetsResponse) => Promise<void>;
  notePendingDelete: (recordId: string) => void;
  clearPendingDelete: (recordId: string) => void;
  clearPendingDeletes: (recordIds: Iterable<string>) => void;
  columns: string[];
  canEditField?: (fieldName: string) => boolean;
}

function assertCanEditFields(
  canEditField: ((fieldName: string) => boolean) | undefined,
  fieldNames: string[],
): boolean {
  if (!canEditField) return true;
  const blocked = fieldNames.filter((f) => !canEditField(f));
  if (blocked.length === 0) return true;
  window.alert(`You do not have permission to edit: ${blocked.join(', ')}`);
  return false;
}

export function useProductMutations({
  applyCacheUpdate,
  commitOptimisticSnapshot,
  mutate,
  notePendingDelete,
  clearPendingDelete,
  clearPendingDeletes,
  columns,
  canEditField,
}: UseProductMutationsProps) {
  const [isSaving, setIsSaving] = React.useState(false);

  const rollbackFields = React.useCallback(
    async (previousFieldsById: Record<string, Record<string, unknown> | undefined>) => {
      const ids = new Set(Object.keys(previousFieldsById));
      if (ids.size === 0) return;

      await applyCacheUpdate((prev) => ({
        ...prev,
        records: prev.records.map((r) =>
          ids.has(r.id) ? { ...r, fields: previousFieldsById[r.id] ?? r.fields } : r,
        ),
      }));
    },
    [applyCacheUpdate],
  );

  const commitServerRecord = React.useCallback(
    async (
      optimisticSnapshot: ProductsAssetsResponse,
      serverRecord: { id?: string; fields?: Record<string, unknown> } | null | undefined,
    ) => {
      if (!serverRecord?.id || !serverRecord.fields) return;
      const confirmed = mergeServerRecordIntoSnapshot(optimisticSnapshot, {
        id: serverRecord.id,
        fields: serverRecord.fields,
      });
      await commitOptimisticSnapshot(confirmed);
    },
    [commitOptimisticSnapshot],
  );

  const handleUpdateVariant = React.useCallback(async (
    id: string,
    fields: Record<string, unknown>,
    records: ProductsRecord[],
  ) => {
    if (isSaving) return;

    const targetRecord = records.find(r => r.id === id);
    if (!targetRecord) return;

    const resolvedFields = resolveExactFieldNames(columns, fields);
    if (!assertCanEditFields(canEditField, Object.keys(resolvedFields))) return;

    let idsToUpdate = [id];

    if (patchTouchesCollectionIdentity(resolvedFields)) {
      const groupKey = getCollectionKey(targetRecord.fields);
      if (groupKey) {
        idsToUpdate = records
          .filter((r) => getCollectionKey(r.fields) === groupKey)
          .map((r) => r.id);
      }
    }

    const updateSet = new Set(idsToUpdate);
    const previousFieldsById: Record<string, Record<string, unknown> | undefined> = {};
    for (const r of records) {
      if (updateSet.has(r.id)) previousFieldsById[r.id] = r.fields;
    }

    const optimisticNext = await applyCacheUpdate((prev) => ({
      ...prev,
      records: prev.records.map(r =>
        updateSet.has(r.id) ? { ...r, fields: { ...r.fields, ...resolvedFields } } : r,
      ),
    }));

    if (!optimisticNext) return;

    setIsSaving(true);
    try {
      const results = await Promise.all(
        idsToUpdate.map(tid =>
          apiFetch(`/products/assets/${tid}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: resolvedFields }),
          }),
        ),
      );

      if (results.every(res => res.ok)) {
        logFrontendEvent(
          'PRODUCT_INLINE_EDIT',
          `Updated fields: ${Object.keys(resolvedFields).join(', ')} across ${idsToUpdate.length} records`,
          id,
        );
      } else {
        throw new Error('Update variant API failed');
      }
    } catch (e) {
      console.error('Update failed', e);
      await rollbackFields(previousFieldsById);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, applyCacheUpdate, rollbackFields, canEditField, columns]);

  const handleToggleMain = React.useCallback(async (recordId: string, records: ProductsRecord[]) => {
    if (isSaving) return;
    setIsSaving(true);

    const previousFieldsById: Record<string, Record<string, unknown> | undefined> = {};
    try {
      const targetRecord = records.find(r => r.id === recordId);
      if (!targetRecord) return;

      const groupKey = getCollectionKey(targetRecord.fields);
      const otherMainIds = records
        .filter(r => r.id !== recordId && getCollectionKey(r.fields) === groupKey && r.fields?.Main === true)
        .map(r => r.id);

      for (const r of records) {
        if (r.id === recordId || getCollectionKey(r.fields) === groupKey) {
          previousFieldsById[r.id] = r.fields;
        }
      }

      const mainField = resolveExactFieldName(columns, 'Main');
      const optimisticNext = await applyCacheUpdate((prev) => ({
        ...prev,
        records: prev.records.map(r => {
          if (r.id === recordId) return { ...r, fields: { ...r.fields, [mainField]: true } };
          if (getCollectionKey(r.fields) === groupKey) return { ...r, fields: { ...r.fields, [mainField]: false } };
          return r;
        }),
      }));

      if (!optimisticNext) return;

      const mainTruePatch = resolveExactFieldNames(columns, { [mainField]: true });
      const mainFalsePatch = resolveExactFieldNames(columns, { [mainField]: false });
      const updates = [
        { id: recordId, fields: mainTruePatch },
        ...otherMainIds.map((oid) => ({ id: oid, fields: mainFalsePatch })),
      ];
      const responses = await Promise.all(
        updates.map(u =>
          apiFetch(`/products/assets/${u.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: u.fields }),
          }),
        ),
      );
      if (!responses.every(res => res.ok)) {
        throw new Error('Toggle Main API failed');
      }
    } catch (err) {
      console.error('Toggle Main failed', err);
      await rollbackFields(previousFieldsById);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, applyCacheUpdate, rollbackFields, canEditField, columns]);

  const handleSaveFields = React.useCallback(async (
    recordId: string,
    fieldsPatch: Record<string, unknown>,
    records: ProductsRecord[],
  ) => {
    const keys = Object.keys(fieldsPatch);
    if (keys.length === 0) return;
    if (!assertCanEditFields(canEditField, keys)) return;

    const record = records.find(r => r.id === recordId);
    const previousFields = record?.fields;

    try {
      const resolvedPatch = resolveExactFieldNames(columns, fieldsPatch);

      const optimisticNext = await applyCacheUpdate((prev) => ({
        ...prev,
        records: prev.records.map(r =>
          r.id === recordId ? { ...r, fields: { ...r.fields, ...resolvedPatch } } : r,
        ),
      }));

      if (!optimisticNext) return;

      const res = await apiFetch(`/products/assets/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: resolvedPatch }),
      });
      if (!res.ok) {
        throw new Error('Save fields API failed');
      }
      try {
        const json = (await res.json()) as { id?: string; fields?: Record<string, unknown> };
        await commitServerRecord(optimisticNext, json);
      } catch {
        // keep optimistic state
      }
    } catch (err) {
      console.error('Save fields failed', err);
      if (previousFields) {
        await rollbackFields({ [recordId]: previousFields });
      }
      throw err;
    }
  }, [applyCacheUpdate, columns, rollbackFields, commitServerRecord, canEditField]);

  const handleSaveField = React.useCallback(async (
    recordId: string,
    fieldName: string,
    newValue: unknown,
    records: ProductsRecord[],
  ) => {
    if (!assertCanEditFields(canEditField, [fieldName])) return;

    const record = records.find(r => r.id === recordId);
    const previousFields = record?.fields;
    const resolvedPatch = resolveExactFieldNames(columns, { [fieldName]: newValue });

    try {
      const optimisticNext = await applyCacheUpdate((prev) => ({
        ...prev,
        records: prev.records.map(r =>
          r.id === recordId ? { ...r, fields: { ...r.fields, ...resolvedPatch } } : r,
        ),
      }));

      if (!optimisticNext) return;

      const res = await apiFetch(`/products/assets/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: resolvedPatch }),
      });
      if (!res.ok) {
        throw new Error('Save field API failed');
      }
      try {
        const json = await res.json() as { id?: string; fields?: Record<string, unknown> };
        await commitServerRecord(optimisticNext, json);
      } catch {
        // keep optimistic state
      }
    } catch (err) {
      console.error('Save field failed', err);
      if (previousFields) {
        await rollbackFields({ [recordId]: previousFields });
      }
      throw err;
    }
  }, [applyCacheUpdate, columns, rollbackFields, commitServerRecord, canEditField]);

  const handleAddMediaToVariant = React.useCallback(async (
    variantId: string,
    newUrl: string,
    records: ProductsRecord[],
  ) => {
    if (!newUrl || isSaving) return;
    setIsSaving(true);

    const record = records.find(r => r.id === variantId);
    const previousFields = record?.fields;

    try {
      if (!record) throw new Error('Record not found in state');

      const trimmed = newUrl.trim();
      const merged = collectMergedProductMediaUrls(record.fields, columns);
      if (merged.some((u) => sameProductMediaUrl(u, trimmed))) return;

      const patch = resolveExactFieldNames(
        columns,
        applyMediaListChange(record.fields, columns, [...merged, trimmed]),
      );
      if (Object.keys(patch).length === 0) return;

      const optimisticNext = await applyCacheUpdate((prev) => ({
        ...prev,
        records: prev.records.map(r =>
          r.id === variantId ? { ...r, fields: { ...r.fields, ...patch } } : r,
        ),
      }));

      if (!optimisticNext) return;

      const res = await apiFetch(`/products/assets/${variantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: patch }),
      });
      if (!res.ok) {
        throw new Error('Add media API failed');
      }
      try {
        const json = (await res.json()) as { id?: string; fields?: Record<string, unknown> };
        await commitServerRecord(optimisticNext, json);
      } catch {
        // keep optimistic state
      }
    } catch (err) {
      console.error('Add media failed', err);
      if (previousFields) {
        await rollbackFields({ [variantId]: previousFields });
      }
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, applyCacheUpdate, columns, rollbackFields, commitServerRecord]);

  const handleDeleteProduct = React.useCallback(async (
    recordId: string,
    records: ProductsRecord[],
  ) => {
    if (isSaving) return;
    const targetRecord = records.find(r => r.id === recordId);
    if (!targetRecord) return;

    notePendingDelete(recordId);

    let previousData: ProductsAssetsResponse | null = null;

    try {
      previousData = await applyCacheUpdate((prev) => ({
        ...prev,
        records: prev.records.filter(r => r.id !== recordId),
        count: Math.max(0, prev.count - 1),
      }));

      setIsSaving(true);
      const res = await apiFetch(`/products/assets/${recordId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Delete product API failed');
      }
      logFrontendEvent(
        'PRODUCT_DELETE',
        `Deleted product: ${resolveCollectionName(targetRecord.fields) || recordId}`,
        recordId,
      );
    } catch (err) {
      console.error('Delete product failed', err);
      clearPendingDelete(recordId);
      if (previousData) {
        await commitOptimisticSnapshot(previousData);
      } else {
        await mutate();
      }
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    applyCacheUpdate,
    commitOptimisticSnapshot,
    mutate,
    notePendingDelete,
    clearPendingDelete,
  ]);

  const DELETE_CHUNK = 6;

  const handleBulkDeleteProducts = React.useCallback(async (recordIds: string[]) => {
    const ids = [...new Set(recordIds)].filter(Boolean);
    if (isSaving || ids.length === 0) return;

    const idSet = new Set(ids);
    for (const id of ids) {
      notePendingDelete(id);
    }

    let previousData: ProductsAssetsResponse | null = null;

    try {
      previousData = await applyCacheUpdate((prev) => ({
        ...prev,
        records: prev.records.filter(r => !idSet.has(r.id)),
        count: Math.max(0, prev.count - ids.length),
      }));

      setIsSaving(true);
      for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
        const chunk = ids.slice(i, i + DELETE_CHUNK);
        const results = await Promise.all(
          chunk.map(id => apiFetch(`/products/assets/${id}`, { method: 'DELETE' })),
        );
        if (results.some(res => !res.ok)) {
          throw new Error('Bulk delete API failed');
        }
      }
      logFrontendEvent(
        'PRODUCT_BULK_DELETE',
        `Bulk deleted ${ids.length} product rows`,
        ids[0] ?? '',
      );
    } catch (err) {
      console.error('Bulk delete failed', err);
      clearPendingDeletes(ids);
      if (previousData) {
        await commitOptimisticSnapshot(previousData);
      } else {
        await mutate();
      }
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    applyCacheUpdate,
    commitOptimisticSnapshot,
    mutate,
    notePendingDelete,
    clearPendingDeletes,
  ]);

  return {
    isSaving,
    handleUpdateVariant,
    handleToggleMain,
    handleSaveField,
    handleSaveFields,
    handleAddMediaToVariant,
    handleDeleteProduct,
    handleBulkDeleteProducts,
  };
}
