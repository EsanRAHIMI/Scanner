import Link from 'next/link';

import { apiJson } from '@/lib/api';
import { getTrainerApiBase } from '@/lib/env';
import type { QueueItem, TrainStatusResponse } from '@/types/trainer';

function Card({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="text-xs tracking-wide text-black/50">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-black/50">{hint}</div> : null}
    </div>
  );
}

async function getQueue() {
  try {
    return await apiJson<QueueItem[]>('/queue');
  } catch {
    return null;
  }
}

async function getLastJob() {
  const jobId = process.env.NEXT_PUBLIC_LAST_TRAIN_JOB_ID;
  if (!jobId) return null;
  try {
    return await apiJson<TrainStatusResponse>(`/train/${jobId}?lines=20`);
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const queue = await getQueue();
  const pending = queue ? queue.filter((q) => q.status === 'pending').length : 0;
  const labeled = queue ? queue.filter((q) => q.status === 'labeled').length : 0;

  const apiBase = getTrainerApiBase();

  const lastJob = await getLastJob();

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-black/60">
          Upload images, label one box per image, export YOLO dataset, train, and publish
          `best.pt` into the inference backend.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card title="Pending" value={String(pending)} hint="Items waiting for labeling" />
        <Card title="Labeled" value={String(labeled)} hint="Ready for dataset export" />
        <Card
          title="Trainer API"
          value={queue ? 'Online' : 'Offline'}
          hint={queue ? apiBase : 'Start trainer/server on port 8010'}
        />
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">Quick actions</div>
            <div className="text-xs text-black/50">Common workflow shortcuts</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/90" href="/upload">
              Upload
            </Link>
            <Link className="rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/5" href="/queue">
              Label queue
            </Link>
            <Link className="rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/5" href="/train">
              Train
            </Link>
          </div>
        </div>

        <div className="mt-5 border-t border-black/10 pt-4">
          <div className="text-sm font-medium">Last job</div>
          <div className="mt-1 text-sm text-black/60">
            {lastJob ? (
              <span>
                Status: <span className="font-medium text-black">{lastJob.status}</span>
              </span>
            ) : (
              <span className="text-black/50">No job tracked on dashboard.</span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
