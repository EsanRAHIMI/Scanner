import { weekdayFromIsoDate } from '../utils';
import type { ContentItem } from '../types';
import {
  CAMPAIGN_PLANNING_DRAFT_FIELD,
  CAMPAIGN_PLANNING_STATUS,
} from '../constants';
import type { MarketingCampaign } from './types';
import { campaignHasLinkedContent, getContentPublishDate } from './utils';

export function isCampaignPlanningDraft(item: ContentItem): boolean {
  const marker = item.fields?.[CAMPAIGN_PLANNING_DRAFT_FIELD];
  return typeof marker === 'string' && marker.length > 0;
}

export function getPlanningDraftCampaignId(item: ContentItem): string | null {
  const marker = item.fields?.[CAMPAIGN_PLANNING_DRAFT_FIELD];
  return typeof marker === 'string' && marker.trim() ? marker.trim() : null;
}

export function hasPlanningDraftForCampaign(
  campaignId: string,
  items: ContentItem[],
): boolean {
  return items.some((item) => getPlanningDraftCampaignId(item) === campaignId);
}

/** Matches auto-created placeholder rows even if the hidden marker was not persisted. */
export function isCampaignPlanningPlaceholder(
  item: ContentItem,
  campaign: MarketingCampaign,
): boolean {
  if (getPlanningDraftCampaignId(item) === campaign.id) return true;
  const title = String(item.fields?.Title ?? '').trim();
  const status = String(item.fields?.Status ?? '').trim();
  const publishDate = getContentPublishDate(item);
  return (
    title === '' &&
    status === CAMPAIGN_PLANNING_STATUS &&
    publishDate === campaign.start_date
  );
}

export function hasPlanningPlaceholderForCampaign(
  campaign: MarketingCampaign,
  items: ContentItem[],
): boolean {
  return items.some((item) => isCampaignPlanningPlaceholder(item, campaign));
}

/** Campaigns that need an auto-created empty planning row in the content calendar. */
export function getCampaignsNeedingPlanningDraft(
  campaigns: MarketingCampaign[],
  items: ContentItem[],
): MarketingCampaign[] {
  return campaigns.filter((campaign) => {
    if (hasPlanningPlaceholderForCampaign(campaign, items)) return false;
    return !campaignHasLinkedContent(campaign, items);
  });
}

export function buildCampaignPlanningDraftFields(
  campaign: MarketingCampaign,
): Record<string, string> {
  const publishDate = campaign.start_date;
  return {
    Title: '',
    'Publish Date': publishDate,
    'Day of Week': weekdayFromIsoDate(publishDate) ?? '',
    Status: CAMPAIGN_PLANNING_STATUS,
    [CAMPAIGN_PLANNING_DRAFT_FIELD]: campaign.id,
  };
}

export function isPlanningDraftReadyForUse(item: ContentItem): boolean {
  const title = String(item.fields?.Title ?? '').trim();
  const status = String(item.fields?.Status ?? '').trim();
  if (!isCampaignPlanningDraft(item)) return true;
  return title.length > 0 && status !== CAMPAIGN_PLANNING_STATUS;
}

/** True when publish date still matches the linked campaign start (draft untouched). */
export function planningDraftMatchesCampaignStart(
  item: ContentItem,
  campaign: MarketingCampaign,
): boolean {
  const publishDate = getContentPublishDate(item);
  return publishDate === campaign.start_date;
}
