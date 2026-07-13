'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { api, fmtDate } from '@/lib/api';
import { useMe } from '../shell';

type Asset = {
  id: string;
  key: string;
  url: string;
  kind: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
};

const KINDS = ['image', 'logo', 'pattern', 'other'];

export default function AssetsPage() {
  const me = useMe();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState('image');
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ assets: Asset[] }>(`/assets${filter ? `?kind=${filter}` : ''}`);
      setAssets(res.assets);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        await api(`/assets/upload?kind=${kind}`, { method: 'POST', body: form });
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this asset?')) return;
    try {
      await api(`/assets/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Assets</h1>
          <p className="text-sm text-gray-500">
            Uploaded images, logos and patterns used in proposals and templates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input max-w-[140px]" value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                Upload as: {k}
              </option>
            ))}
          </select>
          <button className="btn-primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? 'Uploading…' : '+ Upload'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void upload(e.target.files)}
          />
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <select className="input max-w-[160px]" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All kinds</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="card mb-4 border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">Loading…</div>
      ) : assets.length === 0 ? (
        <div className="card p-12 text-center text-sm text-gray-500">No assets uploaded yet.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {assets.map((a) => (
            <div key={a.id} className="card overflow-hidden">
              <div className="aspect-square bg-gray-100">
                {a.content_type?.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.filename} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400">
                    {a.content_type}
                  </div>
                )}
              </div>
              <div className="p-2">
                <div className="truncate text-xs font-medium" title={a.filename}>
                  {a.filename}
                </div>
                <div className="text-[10px] text-gray-400">
                  {a.kind} · {fmtDate(a.created_at)}
                </div>
                <div className="mt-1 flex gap-2">
                  <button
                    className="text-[11px] text-brand-burgundy hover:underline"
                    onClick={() => void navigator.clipboard.writeText(a.url)}
                  >
                    Copy URL
                  </button>
                  {me?.is_admin && (
                    <button
                      className="text-[11px] text-red-500 hover:underline"
                      onClick={() => void remove(a.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
