import { format, isValid, parseISO } from 'date-fns';

/** Canonical storage/display format across marketing calendar (yyyy-MM-dd). */
export const MARKETING_DATE_FORMAT = 'yyyy-MM-dd';

export function normalizeIsoDateInput(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parseISO(s);
  return isValid(d) ? s : null;
}

export function formatMarketingDate(value: string): string {
  const normalized = normalizeIsoDateInput(value);
  if (normalized) return normalized;
  return value.trim();
}

export function todayIsoDate(): string {
  return format(new Date(), MARKETING_DATE_FORMAT);
}

export function parseMarketingDate(value: string): Date | null {
  const normalized = normalizeIsoDateInput(value);
  if (!normalized) return null;
  const d = parseISO(normalized);
  return isValid(d) ? d : null;
}
