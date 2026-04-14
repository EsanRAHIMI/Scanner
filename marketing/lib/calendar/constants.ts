export const ORDERED_COLUMNS = [
  'Title',
  'Publish Date',
  'Day of Week',
  'Content Pillar',
  'Format',
  'Status',
  'Content Link',
  'Caption Idea',
  'CTA',
  'Tone of Voice',
  'Target Audience',
  'Week Number',
  '# Hashtag',
  'Product',
  'Product Image',
  'Assets',
];

export const STATUS_OPTIONS_DEFAULT = [
  'Published',
  'Scheduled',
  'In Progress',
  'Drafts',
];

export const STATUS_COLORS: Record<string, string> = {
  Published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  Scheduled: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  'In Progress': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  Drafts: 'bg-muted text-muted-foreground border border-transparent',
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
export const MIN_COL_PX = 120;
export const MAX_COL_PX = 420;
