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

  const applyRollback = React.useCallback(async (snapshot: ProductsAssetsResponse | null) => {
    if (snapshot) {
      setData(snapshot);
    }
    await mutate();
  }, [setData, mutate]);

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
    let snapshot: ProductsAssetsResponse | null = null;
    setData(prev => {
      if (!prev) return prev;
      snapshot = prev;
      const next = {
        ...prev,
        records: prev.records.map(r =>
          updateSet.has(r.id) ? { ...r, fields: { ...r.fields, ...fields } } : r
        )
      };
      queueMicrotask(() => void mutate(next));
      return next;
    });

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
      await applyRollback(snapshot);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, setData, mutate, applyRollback]);

  const handleToggleMain = React.useCallback(async (recordId: string, records: ProductsRecord[]) => {
    if (isSaving) return;
    setIsSaving(true);
    let snapshot: ProductsAssetsResponse | null = null;
    try {
      const targetRecord = records.find(r => r.id === recordId);
      if (!targetRecord) return;

      const groupKey = getCollectionKey(targetRecord.fields);
      const otherMainIds = records
        .filter(r => r.id !== recordId && getCollectionKey(r.fields) === groupKey && r.fields?.Main === true)
        .map(r => r.id);

      setData(prev => {
        if (!prev) return prev;
        snapshot = prev;
        const next = {
          ...prev,
          records: prev.records.map(r => {
            if (r.id === recordId) return { ...r, fields: { ...r.fields, Main: true } };
            if (getCollectionKey(r.fields) === groupKey) return { ...r, fields: { ...r.fields, Main: false } };
            return r;
          })
        };
        queueMicrotask(() => void mutate(next));
        return next;
      });

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
      await applyRollback(snapshot);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, setData, mutate, applyRollback]);

  const handleSaveField = React.useCallback(async (
    recordId: string, 
    fieldName: string, 
    newValue: unknown, 
    records: ProductsRecord[]
  ) => {
    let snapshot: ProductsAssetsResponse | null = null;
    try {
      const exactFieldName = columns.find(c => c.trim().toLowerCase() === fieldName.trim().toLowerCase()) || fieldName;
      
      setData(prev => {
        if (!prev) return prev;
        snapshot = prev;
        const next = {
          ...prev,
          records: prev.records.map(r => 
            r.id === recordId ? { ...r, fields: { ...r.fields, [exactFieldName]: newValue } } : r
          )
        };
        queueMicrotask(() => void mutate(next));
        return next;
      });

      const res = await apiFetch(`/products/assets/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { [exactFieldName]: newValue } })
      });
      if (!res.ok) {
        throw new Error('Save field API failed');
      }
    } catch (err) {
      console.error('Save field failed', err);
      await applyRollback(snapshot);
      throw err;
    }
  }, [setData, mutate, columns, applyRollback]);

  const handleAddMediaToVariant = React.useCallback(async (
    variantId: string, 
    newUrl: string, 
    records: ProductsRecord[]
  ) => {
    if (!newUrl || isSaving) return;
    setIsSaving(true);
    let snapshot: ProductsAssetsResponse | null = null;
    try {
      const urlFieldName = columns.find((c) => c.trim().toLowerCase() === 'url') || 'URL';
      const record = records.find(r => r.id === variantId);
      if (!record) throw new Error('Record not found in state');
      
      const currentFieldValue = String(record.fields[urlFieldName] || '').trim();
      const finalValueToSave = currentFieldValue ? currentFieldValue + '\n' + newUrl.trim() : newUrl.trim();

      setData(prev => {
        if (!prev) return prev;
        snapshot = prev;
        const next = {
          ...prev,
          records: prev.records.map(r => 
            r.id === variantId ? { ...r, fields: { ...r.fields, [urlFieldName]: finalValueToSave } } : r
          )
        };
        queueMicrotask(() => void mutate(next));
        return next;
      });

      const res = await apiFetch(`/products/assets/${variantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { [urlFieldName]: finalValueToSave } }),
      });
      if (!res.ok) {
        throw new Error('Add media API failed');
      }
    } catch (err) {
      console.error('Add media failed', err);
      await applyRollback(snapshot);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, setData, mutate, columns, applyRollback]);

  return {
    isSaving,
    handleUpdateVariant,
    handleToggleMain,
    handleSaveField,
    handleAddMediaToVariant
  };
}
