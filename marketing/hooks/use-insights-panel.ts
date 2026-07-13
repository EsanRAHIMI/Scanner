'use client';

import { useCallback, useEffect, useState } from 'react';

import { INSIGHTS_PANEL_STORAGE_KEY } from '../lib/calendar/constants';

export function useInsightsPanel(defaultExpanded = false) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(INSIGHTS_PANEL_STORAGE_KEY);
      if (raw === 'true') setExpanded(true);
      if (raw === 'false') setExpanded(false);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(INSIGHTS_PANEL_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const collapse = useCallback(() => {
    setExpanded(false);
    try {
      localStorage.setItem(INSIGHTS_PANEL_STORAGE_KEY, 'false');
    } catch {
      /* ignore */
    }
  }, []);

  const expand = useCallback(() => {
    setExpanded(true);
    try {
      localStorage.setItem(INSIGHTS_PANEL_STORAGE_KEY, 'true');
    } catch {
      /* ignore */
    }
  }, []);

  return { expanded, toggle, collapse, expand, hydrated };
}
