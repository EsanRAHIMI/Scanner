import { STATUS_OPTIONS_DEFAULT } from './constants';

export const CALENDAR_SELECTABLE_FIELDS = {
  'Target Audience': { multi: true },
  'Content Pillar': { multi: false },
  'Tone of Voice': { multi: false },
  Status: { multi: false },
  '# Hashtag': { multi: true },
  Format: { multi: false },
} as const;

export type CalendarSelectableField = keyof typeof CALENDAR_SELECTABLE_FIELDS;

export const CALENDAR_SELECTABLE_FIELD_NAMES = Object.keys(
  CALENDAR_SELECTABLE_FIELDS,
) as CalendarSelectableField[];

export const DEFAULT_CALENDAR_FIELD_OPTIONS: Partial<Record<CalendarSelectableField, string[]>> = {
  Status: STATUS_OPTIONS_DEFAULT,
};

export function isCalendarSelectableField(column: string): column is CalendarSelectableField {
  return column in CALENDAR_SELECTABLE_FIELDS;
}

export function isMultiValueCalendarField(column: string): boolean {
  return isCalendarSelectableField(column) && CALENDAR_SELECTABLE_FIELDS[column].multi;
}

export function getCalendarFieldSelectMode(column: string): 'single' | 'multi' {
  return isMultiValueCalendarField(column) ? 'multi' : 'single';
}

export type CalendarFieldOptionsMap = Record<CalendarSelectableField, string[]>;

export function emptyCalendarFieldOptionsMap(): CalendarFieldOptionsMap {
  return CALENDAR_SELECTABLE_FIELD_NAMES.reduce((acc, field) => {
    acc[field] = [];
    return acc;
  }, {} as CalendarFieldOptionsMap);
}

export function normalizeCalendarFieldOptionsResponse(raw: unknown): CalendarFieldOptionsMap {
  const base = emptyCalendarFieldOptionsMap();
  if (!raw || typeof raw !== 'object') return base;

  const options = (raw as { options?: unknown }).options;
  if (!options || typeof options !== 'object') return base;

  for (const field of CALENDAR_SELECTABLE_FIELD_NAMES) {
    const values = (options as Record<string, unknown>)[field];
    if (Array.isArray(values)) {
      base[field] = values.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    }
  }

  return base;
}
