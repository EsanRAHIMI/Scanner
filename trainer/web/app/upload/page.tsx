'use client';

import * as React from 'react';

import { apiFetch } from '@/lib/api';
import { PageHeader, StatusPill } from '@/lib/trainer-ui';

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
    <main className="min-h-0 flex-1 space-y-6 overflow-y-auto scrollbar-minimal pr-1 pb-8 animate-fade-in">
      <PageHeader
        eyebrow="Ingest"
        title="Upload"
        description="Upload one or more images. Each upload becomes a queue item."
      />

      <div className="dash-panel p-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-brand-black">Choose images</h2>
            <p className="text-xs text-brand-dark-gray">JPG/PNG recommended</p>
          </div>
          <button className="btn-primary" onClick={() => inputRef.current?.click()} type="button">
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

      <div className="table-shell">
        <table className="w-full text-left text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-brand-light-gray">
                <td className="px-4 py-3 font-medium text-brand-black">{r.name}</td>
                <td className="px-4 py-3">
                  <StatusPill status={r.status} />
                </td>
                <td className="px-4 py-3 text-xs text-brand-dark-gray">{r.message ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-brand-medium-gray" colSpan={3}>
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
