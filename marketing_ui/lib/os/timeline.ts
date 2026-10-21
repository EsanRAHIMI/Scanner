export const ACTIVITY_STATUSES = ['Planned', 'Live', 'Blocked', 'Review', 'Done', 'Paused', 'Cancelled'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];
export type Zoom = 'day' | 'week' | 'month';

export type Contributor = { person: string; start: string | null; end: string | null; active: boolean };

export type TimelineLane = {
  id: string;
  key: string;
  name: string;
  group: 'paid' | 'work';
  platform?: string | null;
  owner: string;
  color: string;
  locked: boolean;
  order: number;
};

export type PaidSlice = {
  platform: string;
  campaign_id: string | null;
  spend: number | null;
  budget: number | null;
  impressions: number | null;
  clicks: number | null;
  leads: number | null;
  status: string | null;
  confirmed: boolean;
};

export type TimelineActivity = {
  id: string;
  lane_id: string;
  title: string;
  link_type: 'campaign' | 'content' | 'initiative' | 'paid' | null;
  link_id: string | null;
  source: 'manual' | 'record' | 'paid_api';
  confirmed: boolean;
  start: string | null;
  end: string | null;
  deadline: string | null;
  status: ActivityStatus;
  priority: 'High' | 'Medium' | 'Low';
  progress: number | null;
  owner: string;
  reviewer: string;
  contributors: Contributor[];
  people: string[];
  hours: number | null;
  running: { id: string; person: string; started_at: string } | null;
  color: string;
  href: string | null;
  paid: PaidSlice | null;
  tasks: Array<{ id: string; title: string; owner: string; stage: string; deadline: string | null; priority: string }>;
  overdue: boolean;
  updated_at?: string | null;
  logs?: TimeLog[];
};

export type TimeLog = {
  id: string;
  activity_id: string;
  person: string;
  started_at: string;
  ended_at: string | null;
  minutes: number | null;
  note: string;
  source: 'timer' | 'manual';
  running: boolean;
  history: Array<{ at: string; by: string; action: string; previous?: unknown; minutes?: number }>;
};

export type TimelinePayload = {
  today: string;
  lanes: TimelineLane[];
  activities: TimelineActivity[];
  unscheduled: TimelineActivity[];
  people: string[];
  campaigns: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string; kind: string }>;
  paid_errors: Array<{ platform: string; detail: string }>;
  groups: Array<{ id: string; name: string }>;
};

export type TimelineFocus = {
  people: string[];
  team: string;
  lane: string;
  campaign: string;
  project: string;
  status: string;
  priority: string;
  from: string;
  to: string;
};

export const EMPTY_FOCUS: TimelineFocus = {
  people: [],
  team: '',
  lane: '',
  campaign: '',
  project: '',
  status: '',
  priority: '',
  from: '',
  to: '',
};

const COL: Record<Zoom, number> = { day: 96, week: 196, month: 188 };
const DAY_COUNT = 28;
const WEEK_COUNT = 16;
const MONTH_COUNT = 12;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type ScaleTick = {
  start: string;
  end: string;
  left: number;
  width: number;
  label: string;
  sublabel: string;
};

export type TimelineScale = {
  start: string;
  end: string;
  width: number;
  ticks: ScaleTick[];
  pxPerDay: number;
};

export function parseLocal(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function localYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function localToday(now = new Date()): string {
  return localYmd(now);
}

export function dayFraction(now = new Date()): number {
  return (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86_400;
}

export function localClock(now = new Date()): string {
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseLocal(iso);
  date.setDate(date.getDate() + days);
  return localYmd(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseLocal(to).getTime() - parseLocal(from).getTime()) / 86_400_000);
}

export function startOfWeek(iso: string): string {
  const date = parseLocal(iso);
  const weekday = date.getDay();
  date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return localYmd(date);
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: string, count: number): string {
  const date = parseLocal(startOfMonth(iso));
  date.setMonth(date.getMonth() + count);
  return localYmd(date);
}

export function daysInMonth(iso: string): number {
  const date = parseLocal(startOfMonth(iso));
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function buildScale(anchor: string, zoom: Zoom): TimelineScale {
  const ticks: ScaleTick[] = [];
  if (zoom === 'day') {
    const start = addDays(anchor, -10);
    for (let i = 0; i < DAY_COUNT; i += 1) {
      const day = addDays(start, i);
      const date = parseLocal(day);
      ticks.push({
        start: day,
        end: day,
        left: i * COL.day,
        width: COL.day,
        label: WEEKDAYS[date.getDay()],
        sublabel: `${date.getDate()} ${MONTHS[date.getMonth()]}`,
      });
    }
  } else if (zoom === 'week') {
    const start = addDays(startOfWeek(anchor), -7 * 6);
    for (let i = 0; i < WEEK_COUNT; i += 1) {
      const weekStart = addDays(start, i * 7);
      const weekEnd = addDays(weekStart, 6);
      const from = parseLocal(weekStart);
      const to = parseLocal(weekEnd);
      const sameMonth = from.getMonth() === to.getMonth();
      ticks.push({
        start: weekStart,
        end: weekEnd,
        left: i * COL.week,
        width: COL.week,
        label: sameMonth
          ? `${from.getDate()}–${to.getDate()} ${MONTHS[from.getMonth()]}`
          : `${from.getDate()} ${MONTHS[from.getMonth()]}–${to.getDate()} ${MONTHS[to.getMonth()]}`,
        sublabel: String(from.getFullYear() === to.getFullYear() ? from.getFullYear() : `${from.getFullYear()}–${to.getFullYear()}`),
      });
    }
  } else {
    const start = addMonths(startOfMonth(anchor), -4);
    for (let i = 0; i < MONTH_COUNT; i += 1) {
      const monthStart = addMonths(start, i);
      const monthEnd = addDays(addMonths(monthStart, 1), -1);
      const date = parseLocal(monthStart);
      ticks.push({
        start: monthStart,
        end: monthEnd,
        left: i * COL.month,
        width: COL.month,
        label: MONTHS[date.getMonth()],
        sublabel: String(date.getFullYear()),
      });
    }
  }
  const start = ticks[0]!.start;
  const end = ticks[ticks.length - 1]!.end;
  const width = ticks[ticks.length - 1]!.left + ticks[ticks.length - 1]!.width;
  return { start, end, width, ticks, pxPerDay: width / (daysBetween(start, end) + 1) };
}

export function subTicks(scale: TimelineScale, zoom: Zoom): Array<{ left: number; major: boolean }> {
  const marks: Array<{ left: number; major: boolean }> = [];
  for (const tick of scale.ticks) {
    if (zoom === 'day') {
      for (const hour of [6, 12, 18]) {
        marks.push({ left: tick.left + (hour / 24) * tick.width, major: hour === 12 });
      }
    } else if (zoom === 'week') {
      for (let day = 1; day < 7; day += 1) {
        marks.push({ left: tick.left + (day / 7) * tick.width, major: false });
      }
    } else {
      const days = daysBetween(tick.start, tick.end) + 1;
      for (let day = 1; day < days; day += 1) {
        marks.push({ left: tick.left + (day / days) * tick.width, major: day % 7 === 0 });
      }
    }
  }
  return marks;
}

export function xAt(scale: TimelineScale, iso: string, fraction = 0): number {
  if (iso < scale.start) return 0;
  if (iso > scale.end) return scale.width;
  const tick = scale.ticks.find((item) => iso >= item.start && iso <= item.end) ?? scale.ticks[scale.ticks.length - 1]!;
  const span = Math.max(1, daysBetween(tick.start, tick.end) + 1);
  const intraDay = Math.min(0.999, Math.max(0, fraction));
  const offset = daysBetween(tick.start, iso) + intraDay;
  return tick.left + (offset / span) * tick.width;
}

export function barBox(item: Pick<TimelineActivity, 'start' | 'end'>, scale: TimelineScale): { left: number; width: number } | null {
  if (!item.start) return null;
  const end = item.end && item.end >= item.start ? item.end : item.start;
  const left = xAt(scale, item.start, 0);
  const right = xAt(scale, end, 1);
  return { left, width: Math.max(8, right - left) };
}

export function nowX(scale: TimelineScale, now: Date): number | null {
  const day = localYmd(now);
  if (day < scale.start || day > scale.end) return null;
  return xAt(scale, day, dayFraction(now));
}

export function stackRows(items: Array<Pick<TimelineActivity, 'id' | 'start' | 'end' | 'lane_id'>>): Map<string, number> {
  const rows = new Map<string, number>();
  const ends: string[] = [];
  const ordered = [...items].filter((item) => item.start).sort((a, b) => {
    const start = (a.start || '').localeCompare(b.start || '');
    if (start) return start;
    return (a.end || a.start || '').localeCompare(b.end || b.start || '');
  });
  for (const item of ordered) {
    const start = item.start as string;
    const end = item.end || start;
    let row = ends.findIndex((last) => start > last);
    if (row < 0) {
      row = ends.length;
      ends.push(end);
    } else {
      ends[row] = end;
    }
    rows.set(`${item.lane_id}:${item.id}`, row);
  }
  return rows;
}

export function focusActive(focus: TimelineFocus): boolean {
  return Boolean(focus.people.length || focus.team || focus.lane || focus.campaign || focus.project || focus.status || focus.priority || focus.from || focus.to);
}

export function activityMatches(item: TimelineActivity, focus: TimelineFocus, laneGroup: string): boolean {
  if (focus.lane && item.lane_id !== focus.lane) return false;
  if (focus.team && laneGroup !== focus.team) return false;
  if (focus.status && item.status !== focus.status) return false;
  if (focus.priority && item.priority !== focus.priority) return false;
  if (focus.campaign && !(item.link_type === 'campaign' && item.link_id === focus.campaign)) return false;
  if (focus.project && !(item.link_type === 'initiative' && item.link_id === focus.project)) return false;
  if (focus.from || focus.to) {
    const start = item.start || item.deadline;
    const end = item.end || item.start || item.deadline;
    if (!start) return false;
    if (focus.from && (end || start) < focus.from) return false;
    if (focus.to && start > focus.to) return false;
  }
  if (focus.people.length) {
    const names = new Set(item.people.map((name) => name.toLowerCase()));
    if (!focus.people.some((name) => names.has(name.toLowerCase()))) return false;
  }
  return true;
}

export function participation(item: TimelineActivity, people: string[]): Contributor[] {
  if (!people.length) return [];
  const wanted = new Set(people.map((name) => name.toLowerCase()));
  const hits = item.contributors.filter((row) => wanted.has(row.person.toLowerCase()));
  if (hits.length) return hits;
  if (item.owner && wanted.has(item.owner.toLowerCase())) {
    return [{ person: item.owner, start: item.start, end: item.end, active: true }];
  }
  return [];
}

export function barTone(item: TimelineActivity): string {
  if (item.status === 'Blocked' || item.overdue) return 'ring-red-600/40 bg-red-50 text-red-950';
  if (item.status === 'Done') return 'ring-emerald-600/25 bg-emerald-50 text-emerald-950';
  if (item.status === 'Paused' || item.status === 'Cancelled') return 'ring-black/10 bg-black/[0.04] text-brand-dark-gray';
  if (item.status === 'Live') return 'ring-brand-burgundy/30 bg-white text-brand-black';
  return 'ring-black/10 bg-white text-brand-black';
}

export function hoursLabel(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value === 0) return '0h';
  return Number.isInteger(value) ? `${value}h` : `${value.toFixed(1)}h`;
}
