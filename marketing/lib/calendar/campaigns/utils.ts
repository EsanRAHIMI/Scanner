import type { ContentItem } from '../types';
import { normalizeIsoDateInput } from '../date-utils';
import type { CampaignLinkedPost, MarketingCampaign } from './types';

export function parseIsoDateOnly(raw: unknown): string | null {
  return normalizeIsoDateInput(raw);
}

export function getContentPublishDate(item: ContentItem): string | null {
  return parseIsoDateOnly(item.publish_date) ?? parseIsoDateOnly(item.fields?.['Publish Date']);
}

export function getCampaignEffectiveEnd(campaign: MarketingCampaign): string {
  return campaign.end_date?.trim() || campaign.start_date;
}

export function isDateInCampaignRange(dateIso: string, campaign: MarketingCampaign): boolean {
  const end = getCampaignEffectiveEnd(campaign);
  return dateIso >= campaign.start_date && dateIso <= end;
}

/** Campaigns whose date range includes the content publish date (auto-link). */
export function getCampaignsForContentItem(
  item: ContentItem,
  campaigns: MarketingCampaign[],
): MarketingCampaign[] {
  const publishDate = getContentPublishDate(item);
  if (!publishDate) return [];
  return campaigns.filter((c) => isDateInCampaignRange(publishDate, c));
}

export function getLinkedPostsForCampaign(
  campaign: MarketingCampaign,
  items: ContentItem[],
): CampaignLinkedPost[] {
  return items
    .filter((item) => {
      const d = getContentPublishDate(item);
      return d ? isDateInCampaignRange(d, campaign) : false;
    })
    .map((item) => ({
      id: item.id,
      title: String(item.fields?.Title ?? '').trim() || 'Untitled',
      publishDate: getContentPublishDate(item) ?? '—',
      status: String(item.fields?.Status ?? '').trim() || '—',
    }))
    .sort((a, b) => a.publishDate.localeCompare(b.publishDate));
}

export function formatCampaignDateRange(campaign: MarketingCampaign): string {
  const end = getCampaignEffectiveEnd(campaign);
  if (campaign.start_date === end) return campaign.start_date;
  return `${campaign.start_date} → ${end}`;
}

export function parseChannelsList(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
