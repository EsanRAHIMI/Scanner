import Link from 'next/link';

import { apiJson } from '@/lib/api';
import { getTrainerApiBase } from '@/lib/env';
import { PageHeader, StatusPill } from '@/lib/trainer-ui';
import type { QueueItem } from '@/types/trainer';

async function getQueue() {
  return await apiJson<QueueItem[]>('/queue');
}

export default async function QueuePage() {
  const items = await getQueue();
  const base = getTrainerApiBase();

  return (
    <main className="min-h-0 flex-1 space-y-6 overflow-y-auto scrollbar-minimal pr-1 pb-8 animate-fade-in">
      <PageHeader
        eyebrow="Labeling"
        title="Queue"
        description="Click an item to label one bounding box."
      />

      <div className="table-shell">
        <table className="w-full text-left text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3">Preview</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map((q) => (
              <tr key={q.item_id} className="border-t border-brand-light-gray transition-colors hover:bg-brand-burgundy/[0.03]">
                <td className="px-4 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${base}${q.image_url ?? ''}`}
                    alt={q.item_id}
                    className="h-12 w-12 rounded-xl border border-brand-medium-gray/30 object-cover"
                  />
                </td>
                <td className="px-4 py-3">
                  <Link className="text-sm font-semibold text-brand-black hover:text-brand-burgundy" href={`/queue/${q.item_id}`}>
                    {q.item_id}
                  </Link>
                  <div className="text-xs text-brand-dark-gray">{q.filename}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={q.status} />
                </td>
                <td className="px-4 py-3 text-xs text-brand-dark-gray">{q.created_at}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-brand-medium-gray" colSpan={4}>
                  Queue is empty.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
