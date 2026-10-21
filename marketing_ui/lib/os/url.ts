'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const HISTORY = new Set(['open', 'new', 'tl']);

/** Query-string state for drawers and deep links (`?open=id`, `?new=1`). */
export function useUrlState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      let history = false;
      for (const [key, value] of Object.entries(patch)) {
        if (HISTORY.has(key)) history = true;
        if (value == null || value === '') next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      const current = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      if (href === current) return;
      const go = history ? router.push : router.replace;
      go(href, { scroll: false });
    },
    [params, pathname, router],
  );

  return { params, update };
}

/** Open/create drawer driven by the URL so refresh, share, and back/forward keep working. */
export function useDrawerRecord<T extends { id: string }>(items: T[] | undefined) {
  const { params, update } = useUrlState();
  const openId = params.get('open');
  const creating = params.get('new') === '1';
  const item = openId && items ? (items.find((row) => row.id === openId) ?? null) : null;
  const missing = Boolean(openId) && items != null && !item && !creating;
  return {
    params,
    update,
    openId,
    creating,
    item,
    missing,
    drawerOpen: Boolean(item) || creating,
    close: (extra?: Record<string, string | null>) => update({ open: null, new: null, ...extra }),
  };
}
