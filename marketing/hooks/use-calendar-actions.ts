'use client';

import { useState } from 'react';
import { ContentItem } from '../lib/calendar/types';
import { useToast } from '../components/ui/toast-provider';
import { normalizeDateForInput, weekdayFromIsoDate } from '../lib/calendar/utils';

interface UseCalendarActionsProps {
  setItems: React.Dispatch<React.SetStateAction<ContentItem[]>>;
  refresh: () => Promise<void>;
}

export function useCalendarActions({ setItems, refresh }: UseCalendarActionsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { success, error: toastError } = useToast();

  const createNew = async () => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/content-calendar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fields: {} }),
      });
      if (!res.ok) throw new Error('Create failed');
      await refresh();
      success('New item created');
    } catch {
      toastError('Failed to create item');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/content-calendar/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      setItems(prev => prev.filter(it => it.id !== id));
      success('Item deleted');
    } catch {
      toastError('Failed to delete item');
    } finally {
      setIsSaving(false);
    }
  };

  const duplicateItem = async (source: ContentItem) => {
    try {
      setIsSaving(true);
      const fields = { ...(source.fields ?? {}) };
      const res = await fetch('/api/content-calendar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) throw new Error('Duplicate failed');
      const created = (await res.json()) as ContentItem;
      setItems(prev => [created, ...prev]);
      success('Item duplicated');
    } catch {
      toastError('Failed to duplicate item');
    } finally {
      setIsSaving(false);
    }
  };

  const commitCellEdit = async (id: string, column: string, value: string) => {
    try {
      setIsSaving(true);
      const next: Record<string, string> = { [column]: value };
      
      if (column.toLowerCase().includes('date')) {
        const iso = normalizeDateForInput(value);
        if (iso) {
          next[column] = iso;
          next['Day of Week'] = weekdayFromIsoDate(iso);
        }
      }

      const res = await fetch(`/api/content-calendar/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fields: next }),
      });
      
      if (!res.ok) throw new Error('Update failed');
      
      setItems(prev => prev.map(it => {
        if (it.id !== id) return it;
        return { ...it, fields: { ...it.fields, ...next } };
      }));
      success('Updated');
    } catch {
      toastError('Failed to update cell');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    createNew,
    deleteItem,
    duplicateItem,
    commitCellEdit,
  };
}
