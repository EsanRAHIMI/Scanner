'use client';

import { useEffect, useState } from 'react';

import { DashboardSection, StatusBadge, formatStatusPresentation, type HealthStatus } from '@/components/dashboard-ui';
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
  featured = false,
}: {
  label: string;
  value: number;
  loading: boolean;
  featured?: boolean;
}) {
  return (
    <div className={`dash-metric ${featured ? 'dash-metric-featured md:col-span-2 md:row-span-2 flex flex-col justify-between p-8' : ''}`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-burgundy">{label}</p>
        <p className={`mt-3 font-light tabular-nums text-brand-black ${featured ? 'text-5xl md:text-6xl' : 'text-3xl md:text-4xl'}`}>
          {loading ? '—' : formatNumber(value)}
        </p>
      </div>
      {featured ? (
        <p className="mt-6 text-sm leading-relaxed text-brand-dark-gray">
          Live count from MongoDB — refreshed every 30 seconds.
        </p>
      ) : null}
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
    <div className="dash-card flex h-full flex-col p-6 pt-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-brand-black">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-brand-dark-gray">{description}</p>
        </div>
        <StatusBadge status="online" label="Live" surface="light" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {tech.map((item) => (
          <span
            key={item}
            className="rounded-full border border-brand-light-gray bg-brand-light-gray/80 px-3 py-1 text-xs text-brand-black"
          >
            {item}
          </span>
        ))}
      </div>
      <p className="mt-auto border-t border-brand-light-gray pt-4 text-sm text-brand-black">
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
    <DashboardSection
      eyebrow="Platform intelligence"
      title="Live data footprint"
      description="Product catalog, media assets, and AI pipeline metrics loaded directly from MongoDB."
      action={
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {(() => {
            const dbStatus: HealthStatus = loading
              ? 'loading'
              : stats.db_status === 'connected'
                ? 'online'
                : 'offline';
            const presentation = formatStatusPresentation(
              dbStatus,
              'MongoDB',
              error || (dbStatus === 'offline' ? 'Could not load platform stats' : undefined),
            );
            return (
              <StatusBadge
                status={dbStatus}
                label={presentation.label}
                hint={presentation.hint}
                size="md"
                surface="light"
              />
            );
          })()}
          {!loading && stats.updated_at ? (
            <span className="text-xs text-brand-dark-gray">Updated {formatUpdatedAt(stats.updated_at)}</span>
          ) : null}
        </div>
      }
      className={`transition-all duration-700 delay-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
    >
      {error ? (
        <div className="mb-6 rounded-2xl border border-brand-burgundy bg-brand-burgundy/10 px-5 py-4 text-sm text-brand-burgundy">
          Live stats unavailable: {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:grid-rows-2">
        <LiveMetric label="Products" value={stats.products_count} loading={loading} featured />
        <LiveMetric label="Product Images" value={stats.product_images_count} loading={loading} />
        <LiveMetric label="DAM Assets" value={stats.dam_assets_count} loading={loading} />
        <LiveMetric label="Catalog Categories" value={stats.category_labels_count} loading={loading} />
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

      <div className="dash-panel mt-6 flex flex-col gap-4 border-l-4 border-l-brand-burgundy px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-base font-semibold text-brand-black">Unified data layer</p>
          <p className="mt-1 text-sm leading-relaxed text-brand-dark-gray">
            Dockerized services on Dokploy, Traefik routing, and a single MongoDB source of truth.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['MongoDB', 'CloudFront', 'Docker', 'Dokploy'].map((item) => (
            <span
              key={item}
              className="rounded-full border border-brand-burgundy/20 bg-brand-burgundy/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-burgundy"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </DashboardSection>
  );
}
