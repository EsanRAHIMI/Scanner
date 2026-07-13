'use client';

import { useCallback, useState } from 'react';

import type { CampaignFormValues, MarketingCampaign } from '../lib/calendar/campaigns/types';
import { sortCampaignsByStartDate } from '../lib/calendar/campaigns/utils';
import { useToast } from '../components/ui/toast-provider';

type UseCampaignsActionsOptions = {
  setCampaigns: React.Dispatch<React.SetStateAction<MarketingCampaign[]>>;
  refresh: () => Promise<void>;
};

function buildPayload(values: CampaignFormValues) {
  return {
    name: values.name.trim(),
    start_date: values.start_date,
    end_date: values.end_date.trim() || null,
    color: values.color,
    goal: values.goal.trim(),
    channels: values.channels.trim(),
    is_critical: values.is_critical,
  };
}

export function useCampaignsActions({ setCampaigns, refresh }: UseCampaignsActionsOptions) {
  const [isSaving, setIsSaving] = useState(false);
  const { success, error: toastError } = useToast();

  const createCampaign = useCallback(
    async (values: CampaignFormValues) => {
      setIsSaving(true);
      try {
        const response = await fetch('/api/marketing-campaigns', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(buildPayload(values)),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Create failed (${response.status})`);
        }

        const created = (await response.json()) as MarketingCampaign;
        setCampaigns((prev) => sortCampaignsByStartDate([created, ...prev]));
        success('Campaign created');
        return created;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create campaign';
        toastError(msg);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [setCampaigns, success, toastError],
  );

  const updateCampaign = useCallback(
    async (id: string, values: CampaignFormValues) => {
      setIsSaving(true);
      try {
        const response = await fetch(`/api/marketing-campaigns/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(buildPayload(values)),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Update failed (${response.status})`);
        }

        const updated = (await response.json()) as MarketingCampaign;
        setCampaigns((prev) =>
          sortCampaignsByStartDate(prev.map((c) => (c.id === id ? updated : c))),
        );
        success('Campaign updated');
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update campaign';
        toastError(msg);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [setCampaigns, success, toastError],
  );

  const deleteCampaign = useCallback(
    async (id: string) => {
      setIsSaving(true);
      try {
        const response = await fetch(`/api/marketing-campaigns/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Delete failed (${response.status})`);
        }

        setCampaigns((prev) => prev.filter((c) => c.id !== id));
        success('Campaign deleted');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to delete campaign';
        toastError(msg);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [setCampaigns, success, toastError],
  );

  return {
    isSaving,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    refresh,
  };
}
