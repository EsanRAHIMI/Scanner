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

export type ChangeSourceFilter = 'all' | 'manual' | 'import';

const MANUAL_EDIT_ACTIONS = new Set(['PRODUCT_EDIT', 'PRODUCT_INLINE_EDIT']);
const IMPORT_EDIT_ACTION = 'PRODUCT_IMPORT_EDIT';

function normalizeFieldKey(fieldName: string): string {
  return fieldName.trim().toLowerCase();
}

function isManualEditAction(action: string): boolean {
  return MANUAL_EDIT_ACTIONS.has(action);
}

function isImportEditAction(action: string): boolean {
  return action === IMPORT_EDIT_ACTION;
}

export function isImportFieldChangeEntry(entry: FieldChangeEntry): boolean {
  return isImportEditAction(entry.action);
}

function passesAuditFilters(
  entry: FieldChangeEntry,
  editorUsername: string | null | undefined,
  sourceFilter: ChangeSourceFilter,
): boolean {
  if (editorUsername && entry.username !== editorUsername) return false;
  if (sourceFilter === 'manual' && !isManualEditAction(entry.action)) return false;
  if (sourceFilter === 'import' && !isImportEditAction(entry.action)) return false;
  return true;
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

export function useFieldChangeAudit(
  enabled: boolean,
  editorUsername: string | null = null,
  sourceFilter: ChangeSourceFilter = 'all',
) {
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
          if (!passesAuditFilters(entry, null, sourceFilter)) continue;
          const name = entry.username?.trim();
          if (name) names.add(name);
        }
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [index, sourceFilter]);

  const recordIdsMatchingFilter = React.useMemo(() => {
    if (!editorUsername && sourceFilter === 'all') return null;
    const ids = new Set<string>();
    for (const [recordId, fields] of Object.entries(index)) {
      for (const entries of Object.values(fields)) {
        if (entries.some((entry) => passesAuditFilters(entry, editorUsername, sourceFilter))) {
          ids.add(recordId);
          break;
        }
      }
    }
    return ids;
  }, [index, editorUsername, sourceFilter]);

  const hasChanges = React.useCallback(
    (recordId: string, fieldName: string) =>
      findFieldEntries(index, recordId, fieldName).some((entry) =>
        passesAuditFilters(entry, editorUsername, sourceFilter),
      ),
    [index, editorUsername, sourceFilter],
  );

  const getEntries = React.useCallback(
    (recordId: string, fieldName: string) =>
      findFieldEntries(index, recordId, fieldName).filter((entry) =>
        passesAuditFilters(entry, editorUsername, sourceFilter),
      ),
    [index, editorUsername, sourceFilter],
  );

  const changedCellCount = React.useMemo(() => {
    let count = 0;
    for (const [recordId, fields] of Object.entries(index)) {
      if (recordIdsMatchingFilter && !recordIdsMatchingFilter.has(recordId)) continue;
      for (const entries of Object.values(fields)) {
        const matching = entries.filter((entry) =>
          passesAuditFilters(entry, editorUsername, sourceFilter),
        );
        if (matching.length > 0) count += 1;
      }
    }
    return count;
  }, [index, editorUsername, recordIdsMatchingFilter, sourceFilter]);

  return {
    index,
    loading,
    error,
    hasChanges,
    getEntries,
    changedCellCount,
    editorUsernames,
    recordIdsMatchingFilter,
    /** @deprecated use recordIdsMatchingFilter */
    recordIdsForEditor: recordIdsMatchingFilter,
    editorUsername,
    sourceFilter,
    refresh: fetchChanges,
  };
}

export type FieldChangeAuditApi = ReturnType<typeof useFieldChangeAudit>;
