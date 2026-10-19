export const CONTENT_STAGES = ['Idea', 'Brief', 'Production', 'Review', 'Approved', 'Scheduled', 'Published'] as const;
export type ContentStage = (typeof CONTENT_STAGES)[number];

export const CONTENT_CHANNELS = ['Instagram', 'Facebook', 'LinkedIn', 'Pinterest', 'TikTok', 'YouTube', 'Snapchat', 'Website'] as const;
export type ContentChannel = (typeof CONTENT_CHANNELS)[number];

export const CHANNEL_SHORT: Record<string, string> = {
  Instagram: 'IG',
  Facebook: 'FB',
  LinkedIn: 'IN',
  Pinterest: 'PI',
  TikTok: 'TT',
  YouTube: 'YT',
  Snapchat: 'SC',
  Website: 'WEB',
};

export const MODES = ['Organic', 'Paid', 'Both'] as const;
export type Mode = (typeof MODES)[number];

export const PRIORITIES = ['High', 'Medium', 'Low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TASK_STAGES = ['Queued', 'Doing', 'Blocked', 'Review', 'Done'] as const;
export type TaskStage = (typeof TASK_STAGES)[number];

export const INITIATIVE_STATUSES = ['Not started', 'Active', 'Blocked', 'On hold', 'Done'] as const;
export type InitiativeStatus = (typeof INITIATIVE_STATUSES)[number];

export const CAMPAIGN_STATES = ['Active', 'Paused', 'Cancelled'] as const;

export type Kpi = {
  views: number | null;
  likes: number | null;
  comments: number | null;
  clicks: number | null;
  leads: number | null;
};

export type Content = {
  id: string;
  title: string;
  status: ContentStage;
  publish_date: string | null;
  due_date: string | null;
  channels: ContentChannel[];
  format: string;
  pillar: string;
  hero_product: string;
  owner: string;
  campaign_id: string | null;
  campaign_name: string | null;
  mode: Mode | null;
  caption: string;
  brief: string;
  assets: string[];
  content_link: string;
  kpi: Kpi;
  updated_at?: string;
};

export type Campaign = {
  id: string;
  name: string;
  objective: string;
  start_date: string;
  end_date: string | null;
  color: string;
  channels: string[];
  is_critical: boolean;
  mode: Mode | null;
  budget_aed: number | null;
  owner: string;
  state: (typeof CAMPAIGN_STATES)[number];
  status: 'Planned' | 'Live' | 'Done' | 'Paused' | 'Cancelled';
  landing_url: string;
  creatives: string[];
  kpi_target: string;
  results: string;
  content?: { total: number; published: number; views?: number | null };
  open_tasks?: number;
};

export type InitiativeFile = { label: string; url: string };

export type Initiative = {
  id: string;
  name: string;
  owner: string;
  priority: Priority;
  deadline: string | null;
  status: InitiativeStatus;
  budget_aed: number | null;
  spent_aed: number | null;
  blockers: string;
  files: InitiativeFile[];
  notes: string;
  open_tasks?: number;
};

export type LinkType = 'campaign' | 'content' | 'initiative';

export type Task = {
  id: string;
  title: string;
  kind: 'task' | 'project' | 'campaign';
  repeat: 'once' | 'daily' | 'weekly';
  owner: string;
  stage: TaskStage;
  started_on: string;
  stage_on?: string;
  deadline: string | null;
  hours: number | null;
  cost_aed: number | null;
  note: string;
  priority: Priority;
  blocker: string;
  link_type: LinkType | null;
  link_id: string | null;
  closed_on?: string;
  reason?: string;
  work_id?: string;
};

export type Asset = {
  id: string;
  name: string;
  title: string;
  code: string;
  category: string;
  price: number | null;
  image: string | null;
  thumb: string | null;
  images: string[];
};

export type SearchHit = {
  type: 'content' | 'campaign' | 'initiative' | 'task' | 'asset';
  id: string;
  title: string;
  meta: string;
  image?: string | null;
};

export type Me = { id: string; email: string; username: string; is_admin?: boolean };

// ─── dates ────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function isoDay(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function today(): string {
  return isoDay(new Date());
}

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, days: number): string {
  const next = parseDay(iso);
  next.setDate(next.getDate() + days);
  return isoDay(next);
}

export function startOfWeek(iso: string): string {
  const day = parseDay(iso);
  const offset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - offset);
  return isoDay(day);
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: string): string {
  const day = parseDay(startOfMonth(iso));
  return isoDay(new Date(day.getFullYear(), day.getMonth() + 1, 0));
}

export function shortDate(iso?: string | null): string {
  if (!iso) return '—';
  const day = parseDay(iso);
  return `${day.getDate()} ${MONTHS[day.getMonth()]}`;
}

export function longDate(iso?: string | null): string {
  if (!iso) return '—';
  const day = parseDay(iso);
  return `${WEEKDAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}`;
}

export function monthTitle(iso: string): string {
  const day = parseDay(iso);
  return `${MONTHS[day.getMonth()]} ${day.getFullYear()}`;
}

export function rangeLabel(from: string, to: string): string {
  if (from === to) return shortDate(from);
  return `${shortDate(from)} – ${shortDate(to)}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

export function dueLabel(iso: string | null | undefined, ref = today()): { text: string; late: boolean; soon: boolean } {
  if (!iso) return { text: 'No date', late: false, soon: false };
  const diff = daysBetween(ref, iso);
  if (diff === 0) return { text: 'Today', late: false, soon: true };
  if (diff === 1) return { text: 'Tomorrow', late: false, soon: true };
  if (diff === -1) return { text: 'Yesterday', late: true, soon: false };
  if (diff < 0) return { text: `${-diff}d late`, late: true, soon: false };
  if (diff < 7) return { text: `In ${diff}d`, late: false, soon: true };
  return { text: shortDate(iso), late: false, soon: false };
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS[parseDay(iso).getDay()];
}

// ─── numbers ──────────────────────────────────────────────────────────────

export function compact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 10_000) return `${Math.round(value / 1000)}k`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function money(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `AED ${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function delta(current: number | null | undefined, prior: number | null | undefined): number | null {
  if (current == null || prior == null || prior === 0) return null;
  return (current - prior) / prior;
}

export function initials(name: string): string {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return '·';
  return parts.slice(0, 2).map((part) => part[0]!.toUpperCase()).join('');
}

export function isMine(owner: string, me: Me | null): boolean {
  if (!me || !owner) return false;
  const value = owner.trim().toLowerCase();
  const local = me.email?.split('@')[0]?.toLowerCase();
  return value === me.username?.toLowerCase() || value === me.email?.toLowerCase() || (!!local && value === local);
}

export function meLabel(me: Me | null): string {
  return me?.username || me?.email?.split('@')[0] || '';
}
