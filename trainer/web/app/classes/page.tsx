'use client';

import * as React from 'react';

import { apiJson } from '@/lib/api';
import type { ClassItem } from '@/types/trainer';

type CreateBody = { id: string; name: string };

type RenameBody = { name: string };

export default function ClassesPage() {
  const [items, setItems] = React.useState<ClassItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [newId, setNewId] = React.useState('');
  const [newName, setNewName] = React.useState('');

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

  const create = React.useCallback(async () => {
    setError(null);
    const body: CreateBody = { id: newId.trim(), name: newName.trim() };
    if (!body.id || !body.name) {
      setError('Collection Code and name are required.');
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
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Classes</h1>
        <p className="mt-1 text-sm text-black/60">
          Manage class ids and names used for YOLO dataset export.
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
            placeholder="Collection Code (e.g. spark)"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
          />
          <input
            className="rounded-md border border-black/15 px-3 py-2 text-sm"
            placeholder="name (e.g. SPARK)"
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

      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/5 text-xs uppercase tracking-wide text-black/60">
            <tr>
              <th className="px-4 py-3">Collection Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Actions</th>
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
    </main>
  );
}
