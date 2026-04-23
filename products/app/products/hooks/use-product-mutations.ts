import * as React from 'react';
import type { ProductsRecord, ProductsAssetsResponse } from '@/types/trainer';
import { apiFetch } from '@/lib/api';
import { logFrontendEvent } from '../lib/product-service';
import { formatScalar } from '../lib/product-utils';

interface UseProductMutationsProps {
  setData: React.Dispatch<React.SetStateAction<ProductsAssetsResponse | null>>;
  mutate: (optimisticData?: ProductsAssetsResponse) => Promise<void>;
  columns: string[];
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

export function useProductMutations({ setData, mutate, columns }: UseProductMutationsProps) {
  const [isSaving, setIsSaving] = React.useState(false);

  /** Applies an optimistic update and schedules SWR cache sync via queueMicrotask. */
  const optimisticUpdate = React.useCallback(
    (updater: (prev: ProductsAssetsResponse) => ProductsAssetsResponse) => {
      setData(prev => {
        if (!prev) return prev;
        const next = updater(prev);
        // Use queueMicrotask instead of setTimeout(0) to avoid race conditions
        queueMicrotask(() => void mutate(next));
        return next;
      });
    },
    [setData, mutate]
  );

  const handleUpdateVariant = React.useCallback(async (
    id: string, 
    fields: Record<string, unknown>, 
    records: ProductsRecord[]
  ) => {
    if (isSaving) return;

    const targetRecord = records.find(r => r.id === id);
    if (!targetRecord) return;

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

    // Optimistic UI update
    const updateSet = new Set(idsToUpdate);
    optimisticUpdate(prev => ({
      ...prev,
      records: prev.records.map(r => 
        updateSet.has(r.id) ? { ...r, fields: { ...r.fields, ...fields } } : r
      )
    }));

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
      }
    } catch (e) {
      console.error('Update failed', e);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, optimisticUpdate]);

  const handleToggleMain = React.useCallback(async (recordId: string, records: ProductsRecord[]) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const targetRecord = records.find(r => r.id === recordId);
      if (!targetRecord) return;

      const groupKey = getCollectionKey(targetRecord.fields);
      const otherMainIds = records
        .filter(r => r.id !== recordId && getCollectionKey(r.fields) === groupKey && r.fields?.Main === true)
        .map(r => r.id);

      optimisticUpdate(prev => ({
        ...prev,
        records: prev.records.map(r => {
          if (r.id === recordId) return { ...r, fields: { ...r.fields, Main: true } };
          if (getCollectionKey(r.fields) === groupKey) return { ...r, fields: { ...r.fields, Main: false } };
          return r;
        })
      }));

      const updates = [
        { id: recordId, fields: { Main: true } }, 
        ...otherMainIds.map(oid => ({ id: oid, fields: { Main: false } }))
      ];
      await Promise.all(updates.map(u => apiFetch(`/products/assets/${u.id}`, { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: u.fields }) 
      })));
    } catch (err) {
      console.error('Toggle Main failed', err);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, optimisticUpdate]);

  const handleSaveField = React.useCallback(async (
    recordId: string, 
    fieldName: string, 
    newValue: unknown, 
    records: ProductsRecord[]
  ) => {
    try {
      const exactFieldName = columns.find(c => c.trim().toLowerCase() === fieldName.trim().toLowerCase()) || fieldName;
      
      optimisticUpdate(prev => ({
        ...prev,
        records: prev.records.map(r => 
          r.id === recordId ? { ...r, fields: { ...r.fields, [exactFieldName]: newValue } } : r
        )
      }));

      await apiFetch(`/products/assets/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { [exactFieldName]: newValue } })
      });
    } catch (err) {
      console.error('Save field failed', err);
    }
  }, [optimisticUpdate, columns]);

  const handleAddMediaToVariant = React.useCallback(async (
    variantId: string, 
    newUrl: string, 
    records: ProductsRecord[]
  ) => {
    if (!newUrl || isSaving) return;
    setIsSaving(true);
    try {
      const urlFieldName = columns.find((c) => c.trim().toLowerCase() === 'url') || 'URL';
      const record = records.find(r => r.id === variantId);
      if (!record) throw new Error('Record not found in state');
      
      const currentFieldValue = String(record.fields[urlFieldName] || '').trim();
      const finalValueToSave = currentFieldValue ? currentFieldValue + '\n' + newUrl.trim() : newUrl.trim();

      optimisticUpdate(prev => ({
        ...prev,
        records: prev.records.map(r => 
          r.id === variantId ? { ...r, fields: { ...r.fields, [urlFieldName]: finalValueToSave } } : r
        )
      }));

      await apiFetch(`/products/assets/${variantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { [urlFieldName]: finalValueToSave } }),
      });
    } catch (err) {
      console.error('Add media failed', err);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, optimisticUpdate, columns]);

  return {
    isSaving,
    handleUpdateVariant,
    handleToggleMain,
    handleSaveField,
    handleAddMediaToVariant
  };
}
