'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  type CalendarFieldOptionsMap,
  type CalendarSelectableField,
  normalizeCalendarFieldOptionsResponse,
} from '../lib/calendar/field-options';

export function useCalendarFieldOptions() {
  const [options, setOptions] = useState<CalendarFieldOptionsMap>(() =>
    normalizeCalendarFieldOptionsResponse(null),
  );
  const [loading, setLoading] = useState(true);

  const fetchOptions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/content-calendar/field-options', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setOptions(normalizeCalendarFieldOptionsResponse(data));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOptions();
  }, [fetchOptions]);

  const registerOption = useCallback(async (field: CalendarSelectableField, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const res = await fetch('/api/content-calendar/field-options', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ field, value: trimmed }),
    });

    if (!res.ok) return;

    const data = await res.json();
    if (data?.all_options) {
      setOptions(normalizeCalendarFieldOptionsResponse({ options: data.all_options }));
    } else if (Array.isArray(data?.options)) {
      setOptions((prev) => ({ ...prev, [field]: data.options }));
    }
  }, []);

  const registerOptions = useCallback(
    async (field: CalendarSelectableField, values: string[]) => {
      for (const value of values) {
        await registerOption(field, value);
      }
    },
    [registerOption],
  );

  return {
    options,
    setOptions,
    loading,
    fetchOptions,
    registerOption,
    registerOptions,
  };
}
