import * as React from 'react';
import type { ProductsRecord } from '@/types/trainer';
import { apiFetch } from '@/lib/api';
import { logFrontendEvent } from '../lib/product-service';
import { formatScalar } from '../lib/product-utils';

interface UseProductMutationsProps {
  setData: (fn: (prev: any) => any) => void;
  mutate: (optimisticData?: any) => Promise<any>;
  columns: string[];
}

export function useProductMutations({ setData, mutate, columns }: UseProductMutationsProps) {
  const [isSaving, setIsSaving] = React.useState(false);

  const handleUpdateVariant = React.useCallback(async (id: string, fields: Record<string, any>, records: ProductsRecord[]) => {
    if (isSaving) return;

    const targetRecord = records.find(r => r.id === id);
    if (!targetRecord) return;

    const isNameUpdate = 'Colecction Name' in fields || 'Collection Name' in fields || 'Name' in fields;
    let idsToUpdate = [id];

    if (isNameUpdate) {
      const currentName = (
        formatScalar(targetRecord.fields?.['Colecction Name']) || 
        formatScalar(targetRecord.fields?.Name) || 
        formatScalar(targetRecord.fields?.['Collection Name']) || 
        ''
      ).trim();

      if (currentName) {
        idsToUpdate = records
          .filter(r => {
            const rName = (
              formatScalar(r.fields?.['Colecction Name']) || 
              formatScalar(r.fields?.Name) || 
              formatScalar(r.fields?.['Collection Name']) || 
              ''
            ).trim();
            return rName === currentName;
          })
          .map(r => r.id);
      }
    }

    // Calculate next state
    const updateSet = new Set(idsToUpdate);
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        records: prev.records.map((r: any) => updateSet.has(r.id) ? { ...r, fields: { ...r.fields, ...fields } } : r)
      };
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
        logFrontendEvent('PRODUCT_INLINE_EDIT', `Updated fields: ${Object.keys(fields).join(', ')} across ${idsToUpdate.length} records`, id);
        // Sync SWR cache
        setData(prev => {
          if (!prev) return prev;
          const next = {
            ...prev,
            records: prev.records.map((r: any) => updateSet.has(r.id) ? { ...r, fields: { ...r.fields, ...fields } } : r)
          };
          mutate(next);
          return next;
        });
      } else {
        console.error('Update failed on some records');
      }
    } catch (e) {
      console.error('Update failed', e);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, setData, mutate]);

  const handleToggleMain = React.useCallback(async (recordId: string, records: ProductsRecord[]) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const targetRecord = records.find(r => r.id === recordId);
      if (!targetRecord) return;

      const getCollectionKey = (rFields: any) => {
        return (formatScalar(rFields?.['Colecction Name']) || 
                formatScalar(rFields?.Name) || 
                formatScalar(rFields?.['Collection Name']) || 
                '').trim();
      };

      const groupKey = getCollectionKey(targetRecord.fields);
      const otherMainIds = records
        .filter(r => r.id !== recordId && getCollectionKey(r.fields) === groupKey && r.fields?.Main === true)
        .map(r => r.id);

      let nextData: any = null;
      setData(prev => {
        if (!prev) return prev;
        nextData = {
          ...prev,
          records: prev.records.map((r: any) => {
            const rFields = r.fields || {};
            if (r.id === recordId) return { ...r, fields: { ...rFields, Main: true } };
            if (getCollectionKey(rFields) === groupKey) return { ...r, fields: { ...rFields, Main: false } };
            return r;
          })
        };
        mutate(nextData);
        return nextData;
      });

      const updates = [{ id: recordId, fields: { Main: true } }, ...otherMainIds.map(id => ({ id, fields: { Main: false } }))];
      const res = await Promise.all(updates.map(u => apiFetch(`/products/assets/${u.id}`, { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: u.fields }) 
      })));
    } catch (err) {
      console.error('Toggle Main failed', err);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, setData, mutate]);

  const handleSaveField = React.useCallback(async (recordId: string, fieldName: string, newValue: any, records: ProductsRecord[]) => {
    try {
      const exactFieldName = columns.find(c => c.trim().toLowerCase() === fieldName.trim().toLowerCase()) || fieldName;
      
      setData(prev => {
        if (!prev) return prev;
        const next = {
          ...prev,
          records: prev.records.map((r: any) => r.id === recordId ? { ...r, fields: { ...r.fields, [exactFieldName]: newValue } } : r)
        };
        mutate(next);
        return next;
      });

      await apiFetch(`/products/assets/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { [exactFieldName]: newValue } })
      });
    } catch (err) {
      console.error('Save field failed', err);
    }
  }, [setData, mutate, columns]);

  const handleAddMediaToVariant = React.useCallback(async (variantId: string, newUrl: string, records: ProductsRecord[]) => {
    if (!newUrl || isSaving) return;
    setIsSaving(true);
    try {
      const urlFieldName = columns.find((c) => c.trim().toLowerCase() === 'url') || 'URL';
      const record = records.find(r => r.id === variantId);
      if (!record) throw new Error('Record not found in state');
      
      const currentFieldValue = String(record.fields[urlFieldName] || '').trim();
      const finalValueToSave = currentFieldValue ? currentFieldValue + '\n' + newUrl.trim() : newUrl.trim();

      setData(prev => {
        if (!prev) return prev;
        const next = {
          ...prev,
          records: prev.records.map((r: any) => r.id === variantId ? { ...r, fields: { ...r.fields, [urlFieldName]: finalValueToSave } } : r)
        };
        mutate(next);
        return next;
      });

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
  }, [isSaving, setData, mutate, columns]);

  return {
    isSaving,
    handleUpdateVariant,
    handleToggleMain,
    handleSaveField,
    handleAddMediaToVariant
  };
}
