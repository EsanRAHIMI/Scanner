import { num, type DashboardPayload } from '@/lib/os/types';

export const PAID_LEAD = ['Meta', 'Google Ads', 'LinkedIn'] as const;
export const PAID_ALSO = ['Pinterest', 'TikTok', 'Snapchat'] as const;
export const AUDIENCE_CHANNELS = ['Instagram', 'Facebook', 'Pinterest', 'TikTok', 'LinkedIn', 'Snapchat'] as const;

export type SourceRef = {
  id: string;
  title: string;
  role: string;
  href: string;
};

export type DashboardSection = {
  id: string;
  title: string;
  summary: string;
  sources: SourceRef[];
};

/** Add a source here and it shows on the dashboard and the connections page. */
export const DASHBOARD_SECTIONS: DashboardSection[] = [
  {
    id: 'measurement',
    title: 'Site measurement',
    summary: 'Tag Manager checks the tags. GA4 records what happened. Google Cloud keeps those events.',
    sources: [
      { id: 'gtm', title: 'Tag Manager', role: 'Are the tags installed and reachable?', href: '/connections' },
      { id: 'ga4', title: 'GA4', role: 'Sessions and users on the site.', href: '/connections' },
      { id: 'cloud', title: 'Google Cloud', role: 'BigQuery store for the same GA4 events.', href: '/connections' },
    ],
  },
  {
    id: 'discovery',
    title: 'Found on Google',
    summary: 'Search Console is how people look for Lorenzo. Reviews are what they read before they visit.',
    sources: [
      { id: 'search', title: 'Search Console', role: 'Queries, impressions, and clicks.', href: '/connections' },
      { id: 'reviews', title: 'Google Reviews', role: 'Rating and number of reviews.', href: '/connections' },
    ],
  },
  {
    id: 'pipeline',
    title: 'Follow-up',
    summary: 'Content, the showroom, and Odoo sit after the click.',
    sources: [
      { id: 'instagram', title: 'Instagram', role: 'Posts are managed on the calendar.', href: '/calendar' },
      { id: 'showroom', title: 'Showroom', role: 'Appointments and walk-ins are not tracked yet.', href: '/connections' },
      { id: 'odoo', title: 'Odoo', role: 'Quotes and paid orders.', href: '/connections' },
    ],
  },
];

export function readSiteSource(id: string, site: DashboardPayload['site']): { state?: string; figure: string } {
  if (id === 'ga4') {
    return {
      state: site.ga4?.state,
      figure: site.ga4?.sessions != null ? `${num(site.ga4.sessions)} sessions` : site.ga4?.detail || 'Sessions unknown',
    };
  }
  if (id === 'search') {
    return {
      state: site.search?.state,
      figure: site.search?.impressions != null ? `${num(site.search.impressions)} impressions` : site.search?.detail || 'Impressions unknown',
    };
  }
  if (id === 'reviews') {
    return {
      state: site.reviews?.state,
      figure: site.reviews?.rating != null ? `${site.reviews.rating} · ${num(site.reviews.count)} reviews` : site.reviews?.detail || 'Rating unknown',
    };
  }
  if (id === 'gtm') return { state: site.gtm?.state, figure: site.gtm?.detail || 'Tag check' };
  if (id === 'cloud') return { state: site.cloud?.state, figure: site.cloud?.detail || 'BigQuery store for GA4 events' };
  if (id === 'odoo') return { state: site.odoo?.state, figure: site.odoo?.detail || 'Quotes and orders' };
  if (id === 'instagram') return { figure: 'Open the content calendar' };
  if (id === 'showroom') return { figure: 'Not tracked yet' };
  return { figure: '—' };
}
