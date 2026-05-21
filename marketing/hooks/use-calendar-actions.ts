'use client';

import { useState } from 'react';
import { ContentItem } from '../lib/calendar/types';
import { useToast } from '../components/ui/toast-provider';
import {
  type CalendarFieldOptionsMap,
  type CalendarSelectableField,
  isCalendarSelectableField,
  isMultiValueCalendarField,
  normalizeCalendarFieldOptionsResponse,
} from '../lib/calendar/field-options';
import { removeMultiValueItem, parseMultiValueField } from '../lib/calendar/multi-value-field';
import {
  buildCampaignPlanningDraftFields,
  getCampaignsNeedingPlanningDraft,
} from '../lib/calendar/campaigns/planning-drafts';
import type { MarketingCampaign } from '../lib/calendar/campaigns/types';
import { CAMPAIGN_PLANNING_STATUS } from '../lib/calendar/constants';
import { normalizeDateForInput, weekdayFromIsoDate, extractUrls, isImageUrl } from '../lib/calendar/utils';

function syncFieldsFromAssets(assetsValue: string): Record<string, string> {
  const urls = extractUrls(assetsValue);
  if (urls.length === 0) {
    return { 'Product Image': '', Product: '' };
  }
  return { 'Product Image': urls.find(isImageUrl) ?? '' };
}

function removeFieldValueFromItem(fields: Record<string, unknown>, field: CalendarSelectableField, option: string) {
  const current = fields[field];
  if (isMultiValueCalendarField(field)) {
    return removeMultiValueItem(current, option);
  }
  return '';
}

interface UseCalendarActionsProps {
  setItems: React.Dispatch<React.SetStateAction<ContentItem[]>>;
  refresh: () => Promise<void>;
  setFieldOptions?: React.Dispatch<React.SetStateAction<CalendarFieldOptionsMap>>;
  registerFieldOptions?: (field: CalendarSelectableField, values: string[]) => Promise<void>;
}

export function useCalendarActions({
  setItems,
  refresh,
  setFieldOptions,
  registerFieldOptions,
}: UseCalendarActionsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { success, error: toastError } = useToast();

  const createNew = async () => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/content-calendar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fields: {} }),
      });
      if (!res.ok) throw new Error('Create failed');
      const created = (await res.json()) as ContentItem;
      setItems(prev => [created, ...prev]);
      success('New item created');
    } catch {
      toastError('Failed to create item');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/content-calendar/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      setItems(prev => prev.filter(it => it.id !== id));
      success('Item deleted');
    } catch {
      toastError('Failed to delete item');
    } finally {
      setIsSaving(false);
    }
  };

  const duplicateItem = async (source: ContentItem) => {
    try {
      setIsSaving(true);
      const fields = { ...(source.fields ?? {}) };
      delete fields['Publish Date'];
      delete fields['Day of Week'];

      const res = await fetch('/api/content-calendar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) throw new Error('Duplicate failed');
      const created = (await res.json()) as ContentItem;
      setItems(prev => [created, ...prev]);
      success('Item duplicated');
    } catch {
      toastError('Failed to duplicate item');
    } finally {
      setIsSaving(false);
    }
  };

  const commitCellEdit = async (id: string, column: string, value: string) => {
    try {
      setIsSaving(true);
      const next: Record<string, string> = { [column]: value };
      
      if (column.toLowerCase().includes('date')) {
        const iso = normalizeDateForInput(value);
        if (iso) {
          next[column] = iso;
          next['Day of Week'] = weekdayFromIsoDate(iso);
        }
      }

      if (column === 'Assets') {
        Object.assign(next, syncFieldsFromAssets(value));
      }

      const res = await fetch(`/api/content-calendar/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fields: next }),
      });
      
      if (!res.ok) throw new Error('Update failed');
      
      setItems(prev => prev.map(it => {
        if (it.id !== id) return it;
        return { ...it, fields: { ...it.fields, ...next } };
      }));

      if (isCalendarSelectableField(column) && registerFieldOptions) {
        const values = isMultiValueCalendarField(column)
          ? parseMultiValueField(value)
          : [value.trim()].filter(Boolean);
        await registerFieldOptions(column, values);
      }

      success('Updated');
    } catch {
      toastError('Failed to update cell');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteFieldOption = async (field: CalendarSelectableField, option: string) => {
    const trimmed = option.trim();
    if (!trimmed) return null;

    if (!confirm(`Remove "${trimmed}" from ${field} everywhere? This cannot be undone.`)) {
      return null;
    }

    try {
      setIsSaving(true);
      const res = await fetch('/api/content-calendar/field-options/remove', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ field, value: trimmed }),
      });

      if (res.status === 403) {
        toastError('Only admins can remove field options');
        return null;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Remove failed (${res.status})`);
      }

      const data = (await res.json()) as {
        updated_items?: number;
        all_options?: CalendarFieldOptionsMap;
      };

      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          fields: {
            ...item.fields,
            [field]: removeFieldValueFromItem(item.fields ?? {}, field, trimmed),
          },
        })),
      );

      if (data.all_options && setFieldOptions) {
        setFieldOptions(normalizeCalendarFieldOptionsResponse({ options: data.all_options }));
      }

      success(
        data.updated_items
          ? `Removed "${trimmed}" from ${data.updated_items} item${data.updated_items === 1 ? '' : 's'}`
          : `Removed "${trimmed}"`,
      );
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove field option';
      toastError(msg);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const syncCampaignPlanningDrafts = async (
    campaigns: MarketingCampaign[],
    currentItems: ContentItem[],
  ) => {
    const needed = getCampaignsNeedingPlanningDraft(campaigns, currentItems);
    if (needed.length === 0) return;

    try {
      setIsSaving(true);
      const created: ContentItem[] = [];

      for (const campaign of needed) {
        const fields = buildCampaignPlanningDraftFields(campaign);
        const res = await fetch('/api/content-calendar', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            fields,
            publish_date: campaign.start_date,
          }),
        });
        if (!res.ok) throw new Error(`Planning row failed (${res.status})`);
        created.push((await res.json()) as ContentItem);
      }

      if (created.length > 0) {
        setItems((prev) => [...created, ...prev]);
        if (registerFieldOptions) {
          await registerFieldOptions('Status', [CAMPAIGN_PLANNING_STATUS]);
        }
      }
    } catch {
      toastError('Failed to create campaign planning rows');
    } finally {
      setIsSaving(false);
    }
  };

  const ensureCampaignPlanningDraftForCampaign = async (
    campaign: MarketingCampaign,
    currentItems: ContentItem[],
  ) => {
    await syncCampaignPlanningDrafts([campaign], currentItems);
  };

  return {
    isSaving,
    createNew,
    deleteItem,
    duplicateItem,
    commitCellEdit,
    deleteFieldOption,
    syncCampaignPlanningDrafts,
    ensureCampaignPlanningDraftForCampaign,
  };
}
