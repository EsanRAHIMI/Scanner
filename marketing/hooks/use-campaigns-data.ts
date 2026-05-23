'use client';

import { useState, useCallback, useEffect } from 'react';

import type { CampaignListResponse, MarketingCampaign } from '../lib/calendar/campaigns/types';
import { sortCampaignsByStartDate } from '../lib/calendar/campaigns/utils';
import { useToast } from '../components/ui/toast-provider';

export function useCampaignsData(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { error: toastError } = useToast();

  const fetchCampaigns = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/marketing-campaigns', { cache: 'no-store' });

      if (response.status === 401) {
        setCampaigns([]);
        return;
      }

      if (!response.ok) throw new Error(`Request failed (${response.status})`);

      const data = (await response.json()) as CampaignListResponse;
      setCampaigns(
        sortCampaignsByStartDate(Array.isArray(data.items) ? data.items : []),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load campaigns';
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  }, [enabled, toastError]);

  useEffect(() => {
    if (!enabled) {
      setCampaigns([]);
      setLoading(false);
      return;
    }
    void fetchCampaigns();
  }, [enabled, fetchCampaigns]);

  return {
    campaigns,
    setCampaigns,
    loading,
    error,
    refresh: fetchCampaigns,
  };
}
