'use client';

import * as React from 'react';

import { apiJson } from '@/lib/api';
import { useDamCache } from '@/app/dam-cache-provider';
import type { ClassItem } from '@/types/trainer';

type CreateBody = { id: string; name: string };

type RenameBody = { name: string };

export default function ClassesPage() {
  const { data: damData, loading: damLoading, error: damError } = useDamCache();
  const [items, setItems] = React.useState<ClassItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [newId, setNewId] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const [addingKey, setAddingKey] = React.useState<string | null>(null);
  const [bulkAdd, setBulkAdd] = React.useState<{ total: number; done: number } | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const data = await apiJson<ClassItem[]>('/classes');
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const localById = React.useMemo(() => {
    const m = new Map<string, ClassItem>();
    for (const c of items) m.set(c.id, c);
    return m;
  }, [items]);

  const localPairs = React.useMemo(() => {
    const s = new Set<string>();
    for (const c of items) s.add(`${c.id}\n${c.name}`);
    return s;
  }, [items]);

  const damDerivedClasses = React.useMemo(() => {
    if (!damData?.records?.length) return [] as ClassItem[];

    const codeKey = 'Collection Code';
    const nameKey = 'Collection Name';
    const seenPairs = new Set<string>();
    const out: ClassItem[] = [];

    for (const r of damData.records) {
      const f = r?.fields;
      if (!f || typeof f !== 'object') continue;

      const rawCode = (f as Record<string, unknown>)[codeKey];
      const rawName = (f as Record<string, unknown>)[nameKey];

      const code =
        typeof rawCode === 'string'
          ? rawCode.trim()
          : typeof rawCode === 'number'
            ? String(rawCode)
            : '';
      const name =
        typeof rawName === 'string'
          ? rawName.trim()
          : typeof rawName === 'number'
            ? String(rawName)
            : '';

      if (!code || !name) continue;

      const pairKey = `${code}\n${name}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      out.push({ id: code, name });
    }

    out.sort((a, b) => {
      const byId = a.id.localeCompare(b.id);
      if (byId !== 0) return byId;
      return a.name.localeCompare(b.name);
    });
    return out;
  }, [damData?.records]);

  const damNewClasses = React.useMemo(() => {
    return damDerivedClasses.filter((c) => !localPairs.has(`${c.id}\n${c.name}`));
  }, [damDerivedClasses, localPairs]);

  const addDamRowToLocal = React.useCallback(
    async (c: ClassItem) => {
      const rowKey = `${c.id}\n${c.name}`;
      setAddingKey(rowKey);
      setError(null);
      try {
        const existing = localById.get(c.id);
        if (!existing) {
          await apiJson('/classes', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: c.id, name: c.name } satisfies CreateBody),
          });
        } else if (existing.name !== c.name) {
          await apiJson(`/classes/${encodeURIComponent(c.id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: c.name } satisfies RenameBody),
          });
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Add failed');
      } finally {
        setAddingKey(null);
      }
    },
    [load, localById]
  );

  const addAllDamNewToLocal = React.useCallback(async () => {
    setError(null);

    const toAdd = damNewClasses.slice();
    if (toAdd.length === 0) return;

    setBulkAdd({ total: toAdd.length, done: 0 });
    const nextLocalById = new Map(localById);

    try {
      for (let i = 0; i < toAdd.length; i++) {
        const c = toAdd[i];

        const existing = nextLocalById.get(c.id);
        if (!existing) {
          await apiJson('/classes', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: c.id, name: c.name } satisfies CreateBody),
          });
          nextLocalById.set(c.id, { id: c.id, name: c.name });
        } else if (existing.name !== c.name) {
          await apiJson(`/classes/${encodeURIComponent(c.id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: c.name } satisfies RenameBody),
          });
          nextLocalById.set(c.id, { id: c.id, name: c.name });
        }

        setBulkAdd({ total: toAdd.length, done: i + 1 });
      }

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setBulkAdd(null);
    }
  }, [damNewClasses, load, localById]);

  const create = React.useCallback(async () => {
    setError(null);
    const body: CreateBody = { id: newId.trim(), name: newName.trim() };
    if (!body.id || !body.name) {
      setError('Collection Code and Collection Name are required.');
      return;
    }

    try {
      await apiJson('/classes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      setNewId('');
      setNewName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    }
  }, [load, newId, newName]);

  const rename = React.useCallback(
    async (id: string, name: string) => {
      setError(null);
      const body: RenameBody = { name: name.trim() };
      if (!body.name) return;
      try {
        await apiJson(`/classes/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Rename failed');
      }
    },
    [load]
  );

  const remove = React.useCallback(
    async (id: string) => {
      setError(null);
      try {
        await apiJson(`/classes/${encodeURIComponent(id)}`, { method: 'DELETE' });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed');
      }
    },
    [load]
  );

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Classes</h1>
        <p className="mt-1 text-sm text-black/60">
          Manage class Collection Codes and Collection Names used for YOLO dataset export.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="text-sm font-medium">Add class</div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            className="rounded-md border border-black/15 px-3 py-2 text-sm"
            placeholder="Collection Code (e.g. 2328)"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
          />
          <input
            className="rounded-md border border-black/15 px-3 py-2 text-sm"
            placeholder="Collection Name (e.g. SPARK)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/90"
            onClick={() => void create()}
            type="button"
          >
            Add
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-white px-4 py-3">
            <div className="text-sm font-medium">Local (classes.json)</div>
            <div className="text-xs text-black/50">{items.length}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white text-xs uppercase tracking-wide text-black/60 shadow-sm">
                <tr>
                  <th className="bg-white px-4 py-3">Collection Code</th>
                  <th className="bg-white px-4 py-3">Collection Name</th>
                  <th className="bg-white px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-t border-black/10">
                    <td className="px-4 py-3 font-mono text-xs">{c.id}</td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
                        defaultValue={c.name}
                        onBlur={(e) => void rename(c.id, e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5"
                        onClick={() => void remove(c.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td className="px-4 py-5 text-sm text-black/50" colSpan={3}>
                      No classes.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-white px-4 py-3">
            <div className="text-sm font-medium">From DAM (Airtable)</div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-black/50">
                {damLoading
                  ? 'Loading DAM…'
                  : damError
                    ? 'DAM offline'
                    : bulkAdd
                      ? `Adding… ${bulkAdd.done}/${bulkAdd.total}`
                      : `NEW: ${damNewClasses.length}`}
              </div>
              <button
                className="rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
                type="button"
                onClick={() => void addAllDamNewToLocal()}
                disabled={
                  damLoading ||
                  !!damError ||
                  damNewClasses.length === 0 ||
                  addingKey !== null ||
                  bulkAdd !== null
                }
                title="Add all NEW classes to local storage/classes.json"
              >
                Add all NEW
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white text-xs uppercase tracking-wide text-black/60 shadow-sm">
                <tr>
                  <th className="bg-white px-4 py-3">Collection Code</th>
                  <th className="bg-white px-4 py-3">Collection Name</th>
                  <th className="bg-white px-4 py-3">Status</th>
                  <th className="bg-white px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {damNewClasses.map((c) => (
                  <tr key={`${c.id}\n${c.name}`} className="border-t border-black/10">
                    <td className="px-4 py-3 font-mono text-xs">{c.id}</td>
                    <td className="px-4 py-3">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                        NEW
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
                        type="button"
                        onClick={() => void addDamRowToLocal(c)}
                        disabled={addingKey === `${c.id}\n${c.name}`}
                        title="Add this class to local storage/classes.json"
                      >
                        {addingKey === `${c.id}\n${c.name}` ? 'Adding…' : 'Add to local'}
                      </button>
                    </td>
                  </tr>
                ))}

                {!damLoading && !damError && damData && damNewClasses.length === 0 ? (
                  <tr>
                    <td className="px-4 py-5 text-sm text-black/50" colSpan={4}>
                      No NEW classes from DAM.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
