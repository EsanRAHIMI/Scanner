export const ORDERED_COLUMNS = [
  'Title',
  'Publish Date',
  'Day of Week',
  'Product Image',
  'Format',
  'Content Link',
  'Caption Idea',
  'CTA',
  '# Hashtag',
  'Content Pillar',
  'Target Audience',
  'Tone of Voice',
  'Product',
  'Assets',
  'Status',
];

/** Columns removed from the matrix (legacy data may still exist in DB). */
export const EXCLUDED_CALENDAR_COLUMNS = ['Week Number', '_campaign_planning_id'] as const;

/** Auto-created placeholder rows for campaigns without scheduled content. */
export const CAMPAIGN_PLANNING_STATUS = 'Needs plan';

export const CAMPAIGN_PLANNING_DRAFT_FIELD = '_campaign_planning_id';

export const STATUS_OPTIONS_DEFAULT = [
  'Published',
  'Scheduled',
  'In Progress',
  'Drafts',
  CAMPAIGN_PLANNING_STATUS,
];

/** Shared marketing channel options (calendar, campaigns, etc.). */
export const MARKETING_CHANNEL_OPTIONS = [
  'Instagram',
  'TikTok',
  'Facebook',
  'LinkedIn',
  'YouTube',
  'Email',
  'Blog',
  'Twitter/X',
  'Pinterest',
];

export const STATUS_COLORS: Record<string, string> = {
  Published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  Scheduled: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  'In Progress': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  Drafts: 'bg-muted text-muted-foreground border border-transparent',
  [CAMPAIGN_PLANNING_STATUS]:
    'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25',
};


export const PRIORITY_COLORS: Record<string, string> = {
  High: 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100',
  Medium: 'bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-100',
  Low: 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100',
};

export const PLATFORM_ICONS: Record<string, string> = {
  linkedin: '🔗',
  twitter: '🐦',
  instagram: '📷',
  facebook: '📘',
  blog: '📝',
  youtube: '📺',
  tiktok: '🎵',
};

export const COLUMN_WIDTHS_STORAGE_KEY = 'contentCalendar.columnWidths.v1';
export const INSIGHTS_PANEL_STORAGE_KEY = 'contentCalendar.insightsPanel.expanded.v1';
/** Viewport offset when insights panel is expanded inside sticky header. */
export const CALENDAR_GRID_MAX_H_EXPANDED = 'calc(100dvh - 20rem)';
/** Compact sticky header only — insights collapsed. */
export const CALENDAR_GRID_MAX_H_COLLAPSED = 'calc(100dvh - 7rem)';
export const MIN_COL_PX = 120;
export const MAX_COL_PX = 420;
