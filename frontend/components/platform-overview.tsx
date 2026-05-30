'use client';

import { useEffect, useState } from 'react';

import { safelyVoid } from '@/lib/client-log';
import { EMPTY_PLATFORM_STATS, type PlatformStats } from '@/lib/platform-stats';

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatUpdatedAt(iso: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function LiveMetric({
  label,
  value,
  loading,
  accent,
}: {
  label: string;
  value: number;
  loading: boolean;
  accent: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${accent} p-5`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_55%)]" />
      <div className="relative">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">{label}</p>
        <p className="mt-3 text-3xl font-light tabular-nums text-white">
          {loading ? '—' : formatNumber(value)}
        </p>
      </div>
    </div>
  );
}

function ModuleCard({
  title,
  description,
  tech,
  metric,
  loading,
}: {
  title: string;
  description: string;
  tech: string[];
  metric: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.05]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-medium text-white">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/45">{description}</p>
        </div>
        <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-emerald-300">
          Live
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {tech.map((item) => (
          <span
            key={item}
            className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/55"
          >
            {item}
          </span>
        ))}
      </div>
      <p className="mt-4 text-sm text-white/70">
        {loading ? 'Loading live metrics…' : metric}
      </p>
    </div>
  );
}

type PlatformOverviewProps = {
  visible: boolean;
};

export function PlatformOverview({ visible }: PlatformOverviewProps) {
  const [stats, setStats] = useState<PlatformStats>(EMPTY_PLATFORM_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const res = await fetch('/hub/platform-stats', { cache: 'no-store' });
        if (!res.ok) throw new Error(`stats ${res.status}`);
        const data = (await res.json()) as PlatformStats;
        if (!cancelled) {
          setStats(data);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load stats');
          setLoading(false);
        }
      }
    };

    safelyVoid('platform_stats_initial', refresh());
    const interval = setInterval(() => {
      safelyVoid('platform_stats_poll', refresh());
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <section
      className={`transition-all duration-1000 delay-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
    >
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/35">Platform Intelligence</p>
          <h2 className="mt-2 text-xl font-semibold text-gray-200">Live data footprint</h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-500">
            Product catalog, media assets, and AI pipeline metrics loaded directly from MongoDB.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/45">
          MongoDB {stats.db_status === 'connected' ? 'connected' : 'offline'}
          {!loading && stats.updated_at ? ` · updated ${formatUpdatedAt(stats.updated_at)}` : ''}
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Live stats unavailable: {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LiveMetric
          label="Products"
          value={stats.products_count}
          loading={loading}
          accent="from-emerald-500/10 to-transparent"
        />
        <LiveMetric
          label="Product Images"
          value={stats.product_images_count}
          loading={loading}
          accent="from-sky-500/10 to-transparent"
        />
        <LiveMetric
          label="DAM Assets"
          value={stats.dam_assets_count}
          loading={loading}
          accent="from-violet-500/10 to-transparent"
        />
        <LiveMetric
          label="Catalog Categories"
          value={stats.category_labels_count}
          loading={loading}
          accent="from-amber-500/10 to-transparent"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ModuleCard
          title="Products"
          description="Central product catalog with rich attributes, imports, and CloudFront-backed media."
          tech={['Next.js', 'MongoDB', 'AWS S3', 'CloudFront']}
          metric={`${formatNumber(stats.products_count)} products · ${formatNumber(stats.product_images_count)} indexed images`}
          loading={loading}
        />
        <ModuleCard
          title="Scanner"
          description="Real-time camera detection with YOLO bounding boxes and product matching on the hub."
          tech={['YOLOv8', 'FastAPI', 'WebRTC', 'Next.js']}
          metric={`${formatNumber(stats.yolo_classes_count)} trained detection classes in the pipeline`}
          loading={loading}
        />
        <ModuleCard
          title="Trainer"
          description="Labeling, training, publishing, and unified auth for the entire platform stack."
          tech={['PyTorch', 'Ultralytics', 'FastAPI', 'MongoDB']}
          metric={`${formatNumber(stats.users_count)} platform users · ${formatNumber(stats.yolo_classes_count)} model classes`}
          loading={loading}
        />
        <ModuleCard
          title="Marketing OS"
          description="Campaign planning, content calendar, and operational workflows for the brand team."
          tech={['Next.js', 'MongoDB', 'Calendar API']}
          metric={`${formatNumber(stats.calendar_items_count)} scheduled content entries`}
          loading={loading}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.04] via-transparent to-white/[0.04] px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">Unified data layer</p>
            <p className="mt-1 text-sm text-white/40">
              Dockerized services on Dokploy, Traefik routing, and a single MongoDB source of truth.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
            <span className="rounded-full border border-white/10 px-3 py-1">MongoDB</span>
            <span className="rounded-full border border-white/10 px-3 py-1">CloudFront</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Docker</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Dokploy</span>
          </div>
        </div>
      </div>
    </section>
  );
}
