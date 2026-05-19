'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';

export type FieldChangeEntry = {
  id: string;
  username: string;
  timestamp: string;
  action: string;
  field: string;
  change_type: 'update' | 'add' | 'clear' | 'unchanged' | 'unknown';
  old_value: string;
  new_value: string;
};

export type FieldChangesIndex = Record<string, Record<string, FieldChangeEntry[]>>;

function normalizeFieldKey(fieldName: string): string {
  return fieldName.trim().toLowerCase();
}

function findFieldEntries(
  index: FieldChangesIndex,
  recordId: string,
  fieldName: string,
): FieldChangeEntry[] {
  const byField = index[recordId];
  if (!byField) return [];
  const target = normalizeFieldKey(fieldName);
  const exact = byField[fieldName];
  if (exact?.length) return exact;
  for (const [key, entries] of Object.entries(byField)) {
    if (normalizeFieldKey(key) === target) return entries;
  }
  return [];
}

function filterEntriesByUsername(entries: FieldChangeEntry[], username: string | null | undefined) {
  if (!username) return entries;
  return entries.filter((entry) => entry.username === username);
}

export function useFieldChangeAudit(enabled: boolean, editorUsername: string | null = null) {
  const [index, setIndex] = React.useState<FieldChangesIndex>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchChanges = React.useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/admin/products/field-changes?limit=5000');
      if (!res.ok) {
        throw new Error(`Failed to load field changes (${res.status})`);
      }
      const json = (await res.json()) as { changes?: FieldChangesIndex };
      setIndex(json.changes ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load field changes');
      setIndex({});
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled) {
      setIndex({});
      setError(null);
      return;
    }
    void fetchChanges();
  }, [enabled, fetchChanges]);

  const editorUsernames = React.useMemo(() => {
    const names = new Set<string>();
    for (const fields of Object.values(index)) {
      for (const entries of Object.values(fields)) {
        for (const entry of entries) {
          const name = entry.username?.trim();
          if (name) names.add(name);
        }
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [index]);

  const recordIdsForEditor = React.useMemo(() => {
    if (!editorUsername) return null;
    const ids = new Set<string>();
    for (const [recordId, fields] of Object.entries(index)) {
      for (const entries of Object.values(fields)) {
        if (entries.some((entry) => entry.username === editorUsername)) {
          ids.add(recordId);
          break;
        }
      }
    }
    return ids;
  }, [index, editorUsername]);

  const hasChanges = React.useCallback(
    (recordId: string, fieldName: string) =>
      filterEntriesByUsername(findFieldEntries(index, recordId, fieldName), editorUsername).length > 0,
    [index, editorUsername],
  );

  const getEntries = React.useCallback(
    (recordId: string, fieldName: string) =>
      filterEntriesByUsername(findFieldEntries(index, recordId, fieldName), editorUsername),
    [index, editorUsername],
  );

  const changedCellCount = React.useMemo(() => {
    let count = 0;
    for (const [recordId, fields] of Object.entries(index)) {
      if (recordIdsForEditor && !recordIdsForEditor.has(recordId)) continue;
      for (const entries of Object.values(fields)) {
        if (filterEntriesByUsername(entries, editorUsername).length > 0) count += 1;
      }
    }
    return count;
  }, [index, editorUsername, recordIdsForEditor]);

  return {
    index,
    loading,
    error,
    hasChanges,
    getEntries,
    changedCellCount,
    editorUsernames,
    recordIdsForEditor,
    editorUsername,
    refresh: fetchChanges,
  };
}

export type FieldChangeAuditApi = ReturnType<typeof useFieldChangeAudit>;
