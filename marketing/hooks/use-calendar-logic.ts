'use client';

import { useState, useEffect, useCallback, useDeferredValue, useMemo } from 'react';
import { 
  ContentItem, 
  TrainerMe 
} from '../lib/calendar/types';
import { 
  ORDERED_COLUMNS, 
  STATUS_OPTIONS_DEFAULT 
} from '../lib/calendar/constants';
import { useToast } from '../components/ui/toast-provider';
import { useCalendarData } from './use-calendar-data';
import { useCalendarActions } from './use-calendar-actions';

const normalizeStatusValue = (value: unknown): string => {
  const status = typeof value === 'string' ? value.trim() : '';
  if (!status) return '';
  return status === 'Draft' ? 'Drafts' : status;
};

export function useCalendarLogic() {
  const { success } = useToast();
  
  const { 
    items: contentItems, 
    setItems: setContentItems, 
    loading, 
    error, 
    authRequired, 
    setAuthRequired, 
    refresh 
  } = useCalendarData();

  const {
    isSaving,
    createNew,
    deleteItem,
    duplicateItem,
    commitCellEdit,
  } = useCalendarActions({ setItems: setContentItems, refresh });

  const [allColumns, setAllColumns] = useState<string[]>(ORDERED_COLUMNS);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [statusOptions, setStatusOptions] = useState<string[]>(STATUS_OPTIONS_DEFAULT);
  const [contentPillarOptions, setContentPillarOptions] = useState<string[]>([]);
  const [formatOptions, setFormatOptions] = useState<string[]>([]);
  const [toneOfVoiceOptions, setToneOfVoiceOptions] = useState<string[]>([]);
  const [targetAudienceOptions, setTargetAudienceOptions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  
  const [loginError, setLoginError] = useState<string | null>(null);
  const [me, setMe] = useState<TrainerMe | null>(null);

  // Update dynamic columns and statuses when items change
  useEffect(() => {
    if (contentItems.length > 0) {
      const columnsSet = new Set<string>();
      contentItems.forEach(it => {
        Object.keys(it.fields || {}).forEach(key => columnsSet.add(key));
      });
      const finalColumns = [...ORDERED_COLUMNS];
      Array.from(columnsSet).forEach(col => {
        if (!ORDERED_COLUMNS.includes(col)) finalColumns.push(col);
      });
      setAllColumns(finalColumns);

      const statusSet = new Set<string>();
      contentItems.forEach((it) => {
        const normalizedStatus = normalizeStatusValue(it.fields?.['Status']);
        if (normalizedStatus) statusSet.add(normalizedStatus);
      });
      const discoveredStatuses = Array.from(statusSet);
      const orderedStatuses = [
        ...STATUS_OPTIONS_DEFAULT.filter((s) => discoveredStatuses.includes(s)),
        ...discoveredStatuses.filter((s) => !STATUS_OPTIONS_DEFAULT.includes(s)),
      ];
      setStatusOptions(orderedStatuses.length ? orderedStatuses : STATUS_OPTIONS_DEFAULT);
      
      // Extract other dynamic options
      const pillarSet = new Set<string>();
      const formatSet = new Set<string>();
      const toneSet = new Set<string>();
      
      contentItems.forEach(it => {
        const pillar = String(it.fields?.['Content Pillar'] ?? '').trim();
        const format = String(it.fields?.['Format'] ?? '').trim();
        const tone = String(it.fields?.['Tone of Voice'] ?? '').trim();
        
        if (pillar) pillarSet.add(pillar);
        if (format) formatSet.add(format);
        if (tone) toneSet.add(tone);
      });
      
      setContentPillarOptions(Array.from(pillarSet).sort());
      setFormatOptions(Array.from(formatSet).sort());
      setToneOfVoiceOptions(Array.from(toneSet).sort());

      // Extract Target Audience options (multi-select)
      const audienceSet = new Set<string>();
      contentItems.forEach(it => {
        const val = String(it.fields?.['Target Audience'] ?? '').trim();
        if (val) {
          // Split by common delimiters: comma, newline, or semicolon
          const parts = val.split(/[,\n;]+/).map(p => p.trim()).filter(Boolean);
          parts.forEach(p => audienceSet.add(p));
        }
      });
      setTargetAudienceOptions(Array.from(audienceSet).sort());
    }
  }, [contentItems]);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/trainer/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setMe(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const filteredItems = useMemo(() => {
    const filtered = contentItems.filter((item) => {
      const status = normalizeStatusValue(item.fields?.['Status']);
      const title = String(item.fields?.['Title'] ?? '').toLowerCase();
      const captionIdea = String(item.fields?.['Caption Idea'] ?? '').toLowerCase();
      const targetAudience = String(item.fields?.['Target Audience'] ?? '').toLowerCase();
      const contentPillar = String(item.fields?.['Content Pillar'] ?? '').toLowerCase();
      const format = String(item.fields?.['Format'] ?? '').toLowerCase();
      const cta = String(item.fields?.['CTA'] ?? '').toLowerCase();

      const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
      const q = deferredSearchTerm.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        title.includes(q) ||
        captionIdea.includes(q) ||
        targetAudience.includes(q) ||
        contentPillar.includes(q) ||
        format.includes(q) ||
        cta.includes(q);

      return matchesStatus && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      const dateA = a.fields?.['Publish Date'] ? new Date(String(a.fields['Publish Date'])).getTime() : 0;
      const dateB = b.fields?.['Publish Date'] ? new Date(String(b.fields['Publish Date'])).getTime() : 0;
      const timeA = isNaN(dateA) ? 0 : dateA;
      const timeB = isNaN(dateB) ? 0 : dateB;
      
      // Items without a date should always be at the top
      if (timeA === 0 && timeB !== 0) return -1;
      if (timeB === 0 && timeA !== 0) return 1;
      
      // If both have dates, sort by date descending (newest first)
      if (timeA !== timeB) return timeB - timeA;
      
      // Tie-breaker: sort by ID descending (newest items usually have "larger" IDs)
      return b.id.localeCompare(a.id);
    });
  }, [contentItems, selectedStatus, deferredSearchTerm]);

  const stats = useMemo(() => {
    const total = contentItems.length;
    const published = contentItems.filter(it => normalizeStatusValue(it.fields?.['Status']) === 'Published').length;
    const scheduled = contentItems.filter(it => normalizeStatusValue(it.fields?.['Status']) === 'Scheduled').length;
    const inProgress = contentItems.filter(it => normalizeStatusValue(it.fields?.['Status']) === 'In Progress').length;
    const draft = contentItems.filter(it => normalizeStatusValue(it.fields?.['Status']) === 'Drafts').length;
    return { 
      total, published, scheduled, inProgress, draft, 
      totalReach: 0, actualReach: 0 
    };
  }, [contentItems]);

  const login = async (email: string, pass: string) => {
    try {
      setLoginError(null);
      const res = await fetch('/api/trainer/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      if (!res.ok) throw new Error('Login failed');
      setAuthRequired(false);
      await loadMe();
      await refresh();
      success('Signed in successfully');
    } catch {
      setLoginError('Invalid credentials');
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/trainer/auth/logout', { method: 'POST' });
      setMe(null);
      setAuthRequired(true);
      success('Signed out');
    } catch {}
  };

  return {
    contentItems,
    filteredItems,
    allColumns,
    stats,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    deferredSearchTerm,
    selectedStatus,
    setSelectedStatus,
    statusOptions,
    contentPillarOptions,
    formatOptions,
    toneOfVoiceOptions,
    targetAudienceOptions,
    isSaving,
    authRequired,
    setAuthRequired,
    loginError,
    me,
    createNew,
    duplicateItem,
    deleteItem,
    commitCellEdit,
    login,
    logout,
    refresh,
  };
}
