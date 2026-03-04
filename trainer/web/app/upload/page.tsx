'use client';

import * as React from 'react';

import { apiFetch } from '@/lib/api';

type UploadResult = {
  item_id: string;
  image_url: string;
};

type Row = {
  name: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  message?: string;
};

export default function UploadPage() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const uploadFiles = React.useCallback(async (files: FileList) => {
    const initial: Row[] = Array.from(files).map((f) => ({ name: f.name, status: 'pending' }));
    setRows(initial);

    for (const file of Array.from(files)) {
      setRows((prev) =>
        prev.map((r) => (r.name === file.name ? { ...r, status: 'uploading' } : r))
      );

      try {
        const fd = new FormData();
        fd.append('file', file);

        const res = await apiFetch('/uploads', { method: 'POST', body: fd });
        const text = await res.text();
        if (!res.ok) throw new Error(text || `Upload failed (${res.status})`);

        const _data = JSON.parse(text) as UploadResult;
        setRows((prev) =>
          prev.map((r) =>
            r.name === file.name ? { ...r, status: 'done', message: _data.item_id } : r
          )
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        setRows((prev: Row[]) =>
          prev.map((r: Row) =>
            r.name === file.name ? { ...r, status: 'error', message: msg } : r
          )
        );
      }
    }
  }, []);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Upload</h1>
        <p className="mt-1 text-sm text-black/60">Upload one or more images. Each upload becomes a queue item.</p>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="text-sm font-medium">Choose images</div>
            <div className="text-xs text-black/50">JPG/PNG recommended</div>
          </div>
          <button
            className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/90"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            Select files
          </button>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const files = e.target.files;
              if (!files || files.length === 0) return;
              void uploadFiles(files);
            }}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/5 text-xs uppercase tracking-wide text-black/60">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-black/10">
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-black/5 px-2 py-1 text-xs">{r.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-black/60">{r.message ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-sm text-black/50" colSpan={3}>
                  No uploads yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
