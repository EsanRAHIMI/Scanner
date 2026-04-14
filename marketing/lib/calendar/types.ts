export type CalendarColumn = 
  | 'Title'
  | 'Publish Date'
  | 'Day of Week'
  | 'Content Pillar'
  | 'Format'
  | 'Status'
  | 'Content Link'
  | 'Caption Idea'
  | 'CTA'
  | 'Tone of Voice'
  | 'Target Audience'
  | 'Week Number'
  | '# Hashtag'
  | 'Product'
  | 'Product Image'
  | 'Assets';

export interface ContentItem {
  id: string;
  fields: Record<string, any>;
  publish_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type ContentCalendarListResponse = {
  items: ContentItem[];
  limit: number;
  skip: number;
};

export type TrainerMe = {
  id: string;
  email: string;
  username: string;
};

export interface CalendarStats {
  total: number;
  published: number;
  scheduled: number;
  inProgress: number;
  draft: number;
  totalReach: number;
  actualReach: number;
}
