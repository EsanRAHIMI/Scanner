'use client';

import React, { useEffect, useMemo, useState } from 'react';

import type { InstagramStatsResponse } from '../../lib/calendar/instagram-stats';
import { parseInstagramUrl } from '../../lib/calendar/instagram';

interface InstagramSocialViewsProps {
  contentLink: string;
}

function unavailableLabel(reason?: InstagramStatsResponse['unavailableReason']): string {
  switch (reason) {
    case 'INSTAGRAM_TOKEN_REQUIRED':
      return 'API token missing';
    case 'VIEWS_NOT_FOUND':
      return 'No views';
    case 'FETCH_FAILED':
      return 'Fetch failed';
    case 'PAGE_UNAVAILABLE':
      return 'Unavailable';
    default:
      return 'No views';
  }
}

function unavailableTitle(reason?: InstagramStatsResponse['unavailableReason']): string {
  switch (reason) {
    case 'INSTAGRAM_TOKEN_REQUIRED':
      return 'Set INSTAGRAM_ACCESS_TOKEN in marketing .env — Instagram no longer exposes view counts without the official API.';
    case 'VIEWS_NOT_FOUND':
      return 'Instagram returned no view metric for this media (photo posts often have no public view count).';
    default:
      return 'View count could not be loaded.';
  }
}

export function InstagramSocialViews({ contentLink }: InstagramSocialViewsProps) {
  const parsed = useMemo(() => parseInstagramUrl(contentLink), [contentLink]);
  const [stats, setStats] = useState<InstagramStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!parsed) {
      setStats(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const res = await fetch(
          `/api/instagram/stats?url=${encodeURIComponent(parsed.permalink)}`,
          { cache: 'no-store' },
        );
        const data = (await res.json()) as InstagramStatsResponse & { error?: string };
        if (!cancelled) {
          if (!res.ok) {
            setStats({
              permalink: parsed.permalink,
              type: parsed.type,
              views: null,
              display: null,
              unavailableReason: 'FETCH_FAILED',
            });
          } else {
            setStats(data);
          }
        }
      } catch {
        if (!cancelled) {
          setStats({
            permalink: parsed.permalink,
            type: parsed.type,
            views: null,
            display: null,
            unavailableReason: 'FETCH_FAILED',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parsed]);

  if (!parsed) {
    return <span className="text-muted-foreground/30">—</span>;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-[11px] font-medium text-muted-foreground">Loading…</span>
      </div>
    );
  }

  if (stats?.views == null || !stats.display) {
    const label = unavailableLabel(stats?.unavailableReason);
    return (
      <span
        className="text-[11px] font-medium text-muted-foreground/70"
        title={unavailableTitle(stats?.unavailableReason)}
      >
        {label}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 py-0.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1.5">
        <svg
          className="h-3.5 w-3.5 shrink-0 text-primary/80"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        <span className="text-sm font-bold tabular-nums tracking-tight text-foreground">
          {stats.display}
        </span>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
        views
      </span>
    </div>
  );
}
