import Link from 'next/link';

import { apiJson } from '@/lib/api';
import { getTrainerApiBase } from '@/lib/env';
import { MetricCard, PageHeader } from '@/lib/trainer-ui';
import type { QueueItem, TrainStatusResponse } from '@/types/trainer';

async function getQueue() {
  try {
    const q = await apiJson<QueueItem[]>('/queue');
    return { queue: q, error: null as string | null };
  } catch {
    return { queue: null as QueueItem[] | null, error: 'Failed to reach Trainer API (/queue)' };
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
  const apiBase = getTrainerApiBase();

  const queueRes = await getQueue();
  const queue = queueRes.queue;
  const pending = queue ? queue.filter((q) => q.status === 'pending').length : 0;
  const labeled = queue ? queue.filter((q) => q.status === 'labeled').length : 0;

  const lastJob = await getLastJob();

  return (
    <main className="min-h-0 flex-1 space-y-8 overflow-y-auto scrollbar-minimal pr-1 pb-8 animate-fade-in">
      <section className="dash-hero">
        <p className="dash-eyebrow relative z-10">Training pipeline</p>
        <h1 className="relative z-10 mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-brand-white md:text-4xl">
          Label datasets. Train models. Publish to production.
        </h1>
        <p className="relative z-10 mt-4 max-w-2xl text-base leading-relaxed text-brand-light-gray">
          Upload images, label one box per image, export YOLO dataset, train, and publish{' '}
          <code className="rounded bg-brand-white/10 px-1.5 py-0.5 text-sm">best.pt</code> into the inference backend.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Pending" value={String(pending)} hint="Items waiting for labeling" />
        <MetricCard label="Labeled" value={String(labeled)} hint="Ready for dataset export" />
        <MetricCard
          label="Trainer API"
          value={queue ? 'Online' : 'Offline'}
          hint={queue ? apiBase : queueRes.error ?? `API base: ${apiBase}`}
        />
      </div>

      <div className="dash-panel p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="dash-eyebrow">Workflow</p>
            <h2 className="mt-2 text-lg font-semibold text-brand-black">Quick actions</h2>
            <p className="mt-1 text-sm text-brand-dark-gray">Common workflow shortcuts</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn-primary" href="/upload">
              Upload
            </Link>
            <Link className="btn-outline" href="/queue">
              Label queue
            </Link>
            <Link className="btn-outline" href="/train">
              Train
            </Link>
          </div>
        </div>

        <div className="mt-6 border-t border-brand-light-gray pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-medium-gray">Last job</p>
          <div className="mt-2 text-sm text-brand-dark-gray">
            {lastJob ? (
              <span>
                Status: <span className="font-semibold text-brand-black">{lastJob.status}</span>
              </span>
            ) : (
              <span className="text-brand-medium-gray">No job tracked on dashboard.</span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
