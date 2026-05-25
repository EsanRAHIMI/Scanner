import * as React from 'react';
import type { ProductsRecord, ProductsAssetsResponse } from '@/types/trainer';
import { apiFetch } from '@/lib/api';
import { logFrontendEvent } from '../lib/product-service';
import { formatScalar } from '../lib/product-utils';
import { mergeServerRecordIntoSnapshot } from '../lib/product-mutation-utils';

interface UseProductMutationsProps {
  setData: React.Dispatch<React.SetStateAction<ProductsAssetsResponse | null>>;
  mutate: (optimisticData?: ProductsAssetsResponse) => Promise<void>;
  notePendingDelete: (recordId: string) => void;
  columns: string[];
  /** When provided, blocks save for fields sales cannot edit. */
  canEditField?: (fieldName: string) => boolean;
}

/** Extracts a collection name key from a record's fields. */
function getCollectionKey(fields: Record<string, unknown> | undefined): string {
  return (
    formatScalar(fields?.['Colecction Name']) || 
    formatScalar(fields?.Name) || 
    formatScalar(fields?.['Collection Name']) || 
    ''
  ).trim();
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

/** Apply optimistic snapshot to local override + SWR cache (single commit path). */
async function commitOptimisticSnapshot(
  setData: React.Dispatch<React.SetStateAction<ProductsAssetsResponse | null>>,
  mutate: (optimisticData?: ProductsAssetsResponse) => Promise<void>,
  next: ProductsAssetsResponse,
) {
  setData(next);
  await mutate(next);
}

export function useProductMutations({
  setData,
  mutate,
  notePendingDelete,
  columns,
  canEditField,
}: UseProductMutationsProps) {
  const [isSaving, setIsSaving] = React.useState(false);

  const rollbackRecords = React.useCallback(
    async (previousFieldsById: Record<string, Record<string, unknown> | undefined>) => {
      const ids = new Set(Object.keys(previousFieldsById));
      if (ids.size === 0) return;

      let rolledBack: ProductsAssetsResponse | null = null;
      setData((prev) => {
        if (!prev) return prev;
        rolledBack = {
          ...prev,
          records: prev.records.map((r) =>
            ids.has(r.id) ? { ...r, fields: previousFieldsById[r.id] ?? r.fields } : r,
          ),
        };
        return rolledBack;
      });

      if (rolledBack) {
        await mutate(rolledBack);
      } else {
        await mutate();
      }
    },
    [setData, mutate],
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
      await commitOptimisticSnapshot(setData, mutate, confirmed);
    },
    [setData, mutate],
  );

  const handleUpdateVariant = React.useCallback(async (
    id: string, 
    fields: Record<string, unknown>, 
    records: ProductsRecord[]
  ) => {
    if (isSaving) return;

    const targetRecord = records.find(r => r.id === id);
    if (!targetRecord) return;

    if (!assertCanEditFields(canEditField, Object.keys(fields))) return;

    const isNameUpdate = 'Colecction Name' in fields || 'Collection Name' in fields || 'Name' in fields;
    let idsToUpdate = [id];

    if (isNameUpdate) {
      const currentName = getCollectionKey(targetRecord.fields);
      if (currentName) {
        idsToUpdate = records
          .filter(r => getCollectionKey(r.fields) === currentName)
          .map(r => r.id);
      }
    }

    const updateSet = new Set(idsToUpdate);
    const previousFieldsById: Record<string, Record<string, unknown> | undefined> = {};
    let optimisticNext: ProductsAssetsResponse | null = null;

    setData(prev => {
      if (!prev) return prev;
      for (const r of prev.records) {
        if (updateSet.has(r.id)) {
          previousFieldsById[r.id] = r.fields;
        }
      }
      optimisticNext = {
        ...prev,
        records: prev.records.map(r =>
          updateSet.has(r.id) ? { ...r, fields: { ...r.fields, ...fields } } : r
        )
      };
      return optimisticNext;
    });

    if (!optimisticNext) return;
    await commitOptimisticSnapshot(setData, mutate, optimisticNext);

    setIsSaving(true);
    try {
      const results = await Promise.all(
        idsToUpdate.map(tid => 
          apiFetch(`/products/assets/${tid}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields }),
          })
        )
      );

      if (results.every(res => res.ok)) {
        logFrontendEvent(
          'PRODUCT_INLINE_EDIT', 
          `Updated fields: ${Object.keys(fields).join(', ')} across ${idsToUpdate.length} records`, 
          id
        );
      } else {
        throw new Error('Update variant API failed');
      }
    } catch (e) {
      console.error('Update failed', e);
      await rollbackRecords(previousFieldsById);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, setData, mutate, rollbackRecords, canEditField]);

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

      let optimisticNext: ProductsAssetsResponse | null = null;
      setData(prev => {
        if (!prev) return prev;
        for (const r of prev.records) {
          if (r.id === recordId || getCollectionKey(r.fields) === groupKey) {
            previousFieldsById[r.id] = r.fields;
          }
        }
        optimisticNext = {
          ...prev,
          records: prev.records.map(r => {
            if (r.id === recordId) return { ...r, fields: { ...r.fields, Main: true } };
            if (getCollectionKey(r.fields) === groupKey) return { ...r, fields: { ...r.fields, Main: false } };
            return r;
          })
        };
        return optimisticNext;
      });

      if (!optimisticNext) return;
      await commitOptimisticSnapshot(setData, mutate, optimisticNext);

      const updates = [
        { id: recordId, fields: { Main: true } }, 
        ...otherMainIds.map(oid => ({ id: oid, fields: { Main: false } }))
      ];
      const responses = await Promise.all(updates.map(u => apiFetch(`/products/assets/${u.id}`, { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: u.fields }) 
      })));
      if (!responses.every(res => res.ok)) {
        throw new Error('Toggle Main API failed');
      }
    } catch (err) {
      console.error('Toggle Main failed', err);
      await rollbackRecords(previousFieldsById);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, setData, mutate, rollbackRecords, canEditField]);

  const handleSaveFields = React.useCallback(async (
    recordId: string,
    fieldsPatch: Record<string, unknown>,
    records: ProductsRecord[]
  ) => {
    const keys = Object.keys(fieldsPatch);
    if (keys.length === 0) return;
    if (!assertCanEditFields(canEditField, keys)) return;

    const previousFieldsById: Record<string, Record<string, unknown> | undefined> = {};
    let optimisticNext: ProductsAssetsResponse | null = null;

    try {
      setData(prev => {
        if (!prev) return prev;
        const existing = prev.records.find(r => r.id === recordId);
        if (existing) {
          previousFieldsById[recordId] = existing.fields;
        }
        const resolvedPatch: Record<string, unknown> = {};
        for (const fieldName of keys) {
          const exactFieldName =
            columns.find(c => c.trim().toLowerCase() === fieldName.trim().toLowerCase()) || fieldName;
          resolvedPatch[exactFieldName] = fieldsPatch[fieldName];
        }
        optimisticNext = {
          ...prev,
          records: prev.records.map(r =>
            r.id === recordId ? { ...r, fields: { ...r.fields, ...resolvedPatch } } : r
          ),
        };
        return optimisticNext;
      });

      if (!optimisticNext) return;
      await commitOptimisticSnapshot(setData, mutate, optimisticNext);

      const resolvedForApi: Record<string, unknown> = {};
      for (const fieldName of keys) {
        const exactFieldName =
          columns.find(c => c.trim().toLowerCase() === fieldName.trim().toLowerCase()) || fieldName;
        resolvedForApi[exactFieldName] = fieldsPatch[fieldName];
      }

      const res = await apiFetch(`/products/assets/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: resolvedForApi }),
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
      await rollbackRecords(previousFieldsById);
      throw err;
    }
  }, [setData, mutate, columns, rollbackRecords, commitServerRecord, canEditField]);

  const handleSaveField = React.useCallback(async (
    recordId: string, 
    fieldName: string, 
    newValue: unknown, 
    records: ProductsRecord[]
  ) => {
    if (!assertCanEditFields(canEditField, [fieldName])) return;

    const previousFieldsById: Record<string, Record<string, unknown> | undefined> = {};
    let optimisticNext: ProductsAssetsResponse | null = null;

    try {
      const exactFieldName = columns.find(c => c.trim().toLowerCase() === fieldName.trim().toLowerCase()) || fieldName;
      
      setData(prev => {
        if (!prev) return prev;
        const existing = prev.records.find(r => r.id === recordId);
        if (existing) {
          previousFieldsById[recordId] = existing.fields;
        }
        optimisticNext = {
          ...prev,
          records: prev.records.map(r => 
            r.id === recordId ? { ...r, fields: { ...r.fields, [exactFieldName]: newValue } } : r
          )
        };
        return optimisticNext;
      });

      if (!optimisticNext) return;
      await commitOptimisticSnapshot(setData, mutate, optimisticNext);

      const res = await apiFetch(`/products/assets/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { [exactFieldName]: newValue } })
      });
      if (!res.ok) {
        throw new Error('Save field API failed');
      }
      try {
        const json = await res.json() as { id?: string; fields?: Record<string, unknown> };
        await commitServerRecord(optimisticNext, json);
      } catch {
        // keep optimistic state if response body is missing/invalid
      }
    } catch (err) {
      console.error('Save field failed', err);
      await rollbackRecords(previousFieldsById);
      throw err;
    }
  }, [setData, mutate, columns, rollbackRecords, commitServerRecord, canEditField]);

  const handleAddMediaToVariant = React.useCallback(async (
    variantId: string, 
    newUrl: string, 
    records: ProductsRecord[]
  ) => {
    if (!newUrl || isSaving) return;
    setIsSaving(true);
    const previousFieldsById: Record<string, Record<string, unknown> | undefined> = {};
    let optimisticNext: ProductsAssetsResponse | null = null;

    try {
      const urlFieldName = columns.find((c) => c.trim().toLowerCase() === 'url') || 'URL';
      const record = records.find(r => r.id === variantId);
      if (!record) throw new Error('Record not found in state');
      
      const currentFieldValue = String(record.fields[urlFieldName] || '').trim();
      const finalValueToSave = currentFieldValue ? currentFieldValue + '\n' + newUrl.trim() : newUrl.trim();

      setData(prev => {
        if (!prev) return prev;
        const existing = prev.records.find(r => r.id === variantId);
        if (existing) {
          previousFieldsById[variantId] = existing.fields;
        }
        optimisticNext = {
          ...prev,
          records: prev.records.map(r => 
            r.id === variantId ? { ...r, fields: { ...r.fields, [urlFieldName]: finalValueToSave } } : r
          )
        };
        return optimisticNext;
      });

      if (!optimisticNext) return;
      await commitOptimisticSnapshot(setData, mutate, optimisticNext);

      const res = await apiFetch(`/products/assets/${variantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { [urlFieldName]: finalValueToSave } }),
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
      await rollbackRecords(previousFieldsById);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, setData, mutate, columns, rollbackRecords, commitServerRecord]);

  const handleDeleteProduct = React.useCallback(async (
    recordId: string,
    records: ProductsRecord[]
  ) => {
    if (isSaving) return;
    const targetRecord = records.find(r => r.id === recordId);
    if (!targetRecord) return;

    notePendingDelete(recordId);

    let previousData: ProductsAssetsResponse | null = null;
    let optimisticNext: ProductsAssetsResponse | null = null;
    setData(prev => {
      if (!prev) return prev;
      previousData = prev;
      optimisticNext = {
        ...prev,
        records: prev.records.filter(r => r.id !== recordId),
        count: Math.max(0, prev.count - 1),
      };
      return optimisticNext;
    });

    if (optimisticNext) {
      await commitOptimisticSnapshot(setData, mutate, optimisticNext);
    }

    setIsSaving(true);
    try {
      const res = await apiFetch(`/products/assets/${recordId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Delete product API failed');
      }
      logFrontendEvent(
        'PRODUCT_DELETE',
        `Deleted product: ${formatScalar(targetRecord.fields?.['Colecction Name']) || formatScalar(targetRecord.fields?.Name) || recordId}`,
        recordId
      );
    } catch (err) {
      console.error('Delete product failed', err);
      if (previousData) {
        await commitOptimisticSnapshot(setData, mutate, previousData);
      } else {
        await mutate();
      }
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, setData, mutate, notePendingDelete]);

  const DELETE_CHUNK = 6;

  const handleBulkDeleteProducts = React.useCallback(async (recordIds: string[]) => {
    const ids = [...new Set(recordIds)].filter(Boolean);
    if (isSaving || ids.length === 0) return;

    const idSet = new Set(ids);
    for (const id of ids) {
      notePendingDelete(id);
    }

    let previousData: ProductsAssetsResponse | null = null;
    let optimisticNext: ProductsAssetsResponse | null = null;
    setData(prev => {
      if (!prev) return prev;
      previousData = prev;
      optimisticNext = {
        ...prev,
        records: prev.records.filter(r => !idSet.has(r.id)),
        count: Math.max(0, prev.count - ids.length),
      };
      return optimisticNext;
    });

    if (optimisticNext) {
      await commitOptimisticSnapshot(setData, mutate, optimisticNext);
    }

    setIsSaving(true);
    try {
      for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
        const chunk = ids.slice(i, i + DELETE_CHUNK);
        const results = await Promise.all(
          chunk.map(id => apiFetch(`/products/assets/${id}`, { method: 'DELETE' }))
        );
        if (results.some(res => !res.ok)) {
          throw new Error('Bulk delete API failed');
        }
      }
      logFrontendEvent(
        'PRODUCT_BULK_DELETE',
        `Bulk deleted ${ids.length} product rows`,
        ids[0] ?? ''
      );
    } catch (err) {
      console.error('Bulk delete failed', err);
      if (previousData) {
        await commitOptimisticSnapshot(setData, mutate, previousData);
      } else {
        await mutate();
      }
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, setData, mutate, notePendingDelete]);

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
