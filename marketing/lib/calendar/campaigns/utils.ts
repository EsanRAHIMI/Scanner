import { differenceInCalendarDays, format, parseISO } from 'date-fns';

import type { ContentItem } from '../types';
import { normalizeIsoDateInput, parseMarketingDate, todayIsoDate } from '../date-utils';
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

/** Short label for rail cells, e.g. "May 1". */
export function formatCampaignShortDate(iso: string): string {
  const d = parseMarketingDate(iso);
  if (!d) return iso;
  return format(d, 'MMM d');
}

/**
 * Calendar days from today until campaign end (inclusive of end day as 0).
 * Negative when the end date has passed.
 */
export function getCampaignDaysRemaining(
  campaign: MarketingCampaign,
  now: Date = new Date(),
): number | null {
  const end = parseMarketingDate(getCampaignEffectiveEnd(campaign));
  if (!end) return null;
  const today = parseISO(format(now, 'yyyy-MM-dd'));
  return differenceInCalendarDays(end, today);
}

export function formatCampaignDaysRemaining(days: number): string {
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`;
  if (days === 0) return 'Ends today';
  return `${days} day${days === -1 ? '' : 's'}`;
}

export function isFutureCampaign(
  campaign: MarketingCampaign,
  today: string = todayIsoDate(),
): boolean {
  return Boolean(parseMarketingDate(campaign.start_date) && campaign.start_date > today);
}

export function campaignHasLinkedContent(
  campaign: MarketingCampaign,
  items: ContentItem[],
): boolean {
  return getLinkedPostsForCampaign(campaign, items).length > 0;
}

/** Future campaigns with no content in range — sorted by start date (soonest first). */
export function getUnplannedFutureCampaigns(
  campaigns: MarketingCampaign[],
  items: ContentItem[],
): MarketingCampaign[] {
  return campaigns
    .filter((c) => isFutureCampaign(c))
    .filter((c) => !campaignHasLinkedContent(c, items))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}

export function getCampaignDaysUntilStart(
  campaign: MarketingCampaign,
  now: Date = new Date(),
): number | null {
  const start = parseMarketingDate(campaign.start_date);
  if (!start) return null;
  const today = parseISO(format(now, 'yyyy-MM-dd'));
  return differenceInCalendarDays(start, today);
}

export function formatCampaignDaysUntilStart(days: number): string {
  if (days > 0) return `Starts in ${days} day${days === 1 ? '' : 's'}`;
  if (days === 0) return 'Starts today';
  return `Started ${Math.abs(days)} day${days === -1 ? '' : 's'} ago`;
}

export function parseChannelsList(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Sort campaigns by start date (newest / latest start first — matches content calendar rows). */
export function sortCampaignsByStartDate(campaigns: MarketingCampaign[]): MarketingCampaign[] {
  return [...campaigns].sort((a, b) => b.start_date.localeCompare(a.start_date));
}
