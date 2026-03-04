import Link from 'next/link';

import { apiJson } from '@/lib/api';
import { getTrainerApiBase } from '@/lib/env';
import type { QueueItem } from '@/types/trainer';

async function getQueue() {
  return await apiJson<QueueItem[]>('/queue');
}

function StatusPill({ status }: { status: string }) {
  const isPending = status === 'pending';
  return (
    <span
      className={
        'rounded-full px-2 py-1 text-xs ' +
        (isPending ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800')
      }
    >
      {status}
    </span>
  );
}

export default async function QueuePage() {
  const items = await getQueue();
  const base = getTrainerApiBase();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Queue</h1>
        <p className="mt-1 text-sm text-black/60">Click an item to label one bounding box.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/5 text-xs uppercase tracking-wide text-black/60">
            <tr>
              <th className="px-4 py-3">Preview</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map((q) => (
              <tr key={q.item_id} className="border-t border-black/10">
                <td className="px-4 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${base}${q.image_url ?? ''}`}
                    alt={q.item_id}
                    className="h-12 w-12 rounded-md border border-black/10 object-cover"
                  />
                </td>
                <td className="px-4 py-3">
                  <Link className="text-sm font-medium hover:underline" href={`/queue/${q.item_id}`}>
                    {q.item_id}
                  </Link>
                  <div className="text-xs text-black/50">{q.filename}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={q.status} />
                </td>
                <td className="px-4 py-3 text-xs text-black/60">{q.created_at}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-sm text-black/50" colSpan={4}>
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
