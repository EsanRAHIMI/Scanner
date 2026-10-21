'use client';

import { useEffect, useState } from 'react';

import { useCalendarFieldOptions } from '@/hooks/use-calendar-field-options';
import { invalidate, useApi } from '@/lib/os/client';
import type { Campaign, Content, Initiative, Task } from '@/lib/os/model';

export function useContent(start: string, end: string) {
  return useApi<{ items: Content[] }>(`content?start=${start}&end=${end}`);
}

export function useAllContent() {
  return useApi<{ items: Content[] }>('content');
}

export function useCampaigns() {
  return useApi<{ items: Campaign[] }>('campaigns');
}

export function useInitiatives() {
  return useApi<{ items: Initiative[] }>('initiatives');
}

export function useTasks() {
  return useApi<{ items: Task[]; archive: Task[] }>('work');
}

export function usePeople() {
  return useApi<{ items: string[] }>('people');
}

export function useFieldOptions() {
  const { options } = useCalendarFieldOptions();
  return { formats: options.Format ?? [], pillars: options['Content Pillar'] ?? [] };
}

/** Everything that summarises content, campaigns, tasks, or initiatives. */
export function refreshAfterWrite(kind: 'content' | 'campaign' | 'initiative' | 'task') {
  const shared = ['overview', 'report', 'search', 'people', 'timeline'];
  if (kind === 'content') invalidate('content', 'campaigns', ...shared);
  if (kind === 'campaign') invalidate('campaigns', 'content', ...shared);
  if (kind === 'initiative') invalidate('initiatives', ...shared);
  if (kind === 'task') invalidate('work', 'campaigns', 'initiatives', ...shared);
}

let damUrl: string | null = null;

export function useDamUrl(): string | null {
  const [url, setUrl] = useState(damUrl);
  useEffect(() => {
    if (damUrl) return;
    let live = true;
    void fetch('/api/service-urls', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { productsWeb?: string } | null) => {
        if (!body?.productsWeb) return;
        damUrl = `${body.productsWeb.replace(/\/+$/, '')}/products`;
        if (live) setUrl(damUrl);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return url;
}
