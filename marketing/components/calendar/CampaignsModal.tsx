'use client';

import React, { useEffect, useMemo, useState } from 'react';

import type { ContentItem } from '../../lib/calendar/types';
import {
  CAMPAIGN_COLOR_PRESETS,
  DEFAULT_CAMPAIGN_FORM,
} from '../../lib/calendar/campaigns/constants';
import { MARKETING_CHANNEL_OPTIONS } from '../../lib/calendar/constants';
import type { CampaignFormValues, MarketingCampaign } from '../../lib/calendar/campaigns/types';
import {
  formatCampaignDateRange,
  getLinkedPostsForCampaign,
  parseChannelsList,
  sortCampaignsByStartDate,
} from '../../lib/calendar/campaigns/utils';
import { FormDateField } from './FormDateField';
import { FormMultiSelectField } from './FormMultiSelectField';

type MobilePanel = 'list' | 'detail';

interface CampaignsModalProps {
  open: boolean;
  campaigns: MarketingCampaign[];
  contentItems: ContentItem[];
  loading: boolean;
  isSaving: boolean;
  onClose: () => void;
  onCreate: (values: CampaignFormValues) => Promise<MarketingCampaign | void>;
  onUpdate: (id: string, values: CampaignFormValues) => Promise<MarketingCampaign | void>;
  onDelete: (id: string) => Promise<void>;
}

function campaignToForm(campaign: MarketingCampaign): CampaignFormValues {
  return {
    name: campaign.name,
    start_date: campaign.start_date,
    end_date: campaign.end_date ?? '',
    color: campaign.color,
    goal: campaign.goal,
    channels: campaign.channels,
    is_critical: campaign.is_critical,
  };
}

function CampaignFormFields({
  form,
  setForm,
  disabled,
  channelOptions,
}: {
  form: CampaignFormValues;
  setForm: React.Dispatch<React.SetStateAction<CampaignFormValues>>;
  disabled: boolean;
  channelOptions: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="campaign-name" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
          Campaign name
        </label>
        <input
          id="campaign-name"
          value={form.name}
          disabled={disabled}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/20 transition-all placeholder:text-muted-foreground/40 focus:ring-2"
          placeholder="e.g. Summer Launch 2026"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/80 bg-muted/20 px-3 py-3 transition-colors hover:bg-muted/40 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
        <input
          type="checkbox"
          checked={form.is_critical}
          disabled={disabled}
          onChange={(e) => setForm((prev) => ({ ...prev, is_critical: e.target.checked }))}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-rose-600 focus:ring-rose-500/30"
        />
        <span className="min-w-0">
          <span className="block text-sm font-bold text-foreground">Critical campaign</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
            Mark as high priority — highlighted in the calendar matrix
          </span>
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="campaign-start" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Start date
          </label>
          <FormDateField
            id="campaign-start"
            value={form.start_date}
            disabled={disabled}
            onChange={(start_date) => setForm((prev) => ({ ...prev, start_date }))}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="campaign-end" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            End date <span className="normal-case tracking-normal text-muted-foreground/50">(optional)</span>
          </label>
          <FormDateField
            id="campaign-end"
            value={form.end_date}
            disabled={disabled}
            onChange={(end_date) => setForm((prev) => ({ ...prev, end_date }))}
          />
          <p className="text-[10px] text-muted-foreground/60">Leave empty for a single-day campaign. Format: yyyy-mm-dd</p>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Color</span>
        <div className="flex flex-wrap gap-2">
          {CAMPAIGN_COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              disabled={disabled}
              title={color}
              aria-label={`Color ${color}`}
              onClick={() => setForm((prev) => ({ ...prev, color }))}
              className={
                'h-8 w-8 rounded-full border-2 transition-transform hover:scale-105 disabled:opacity-50 ' +
                (form.color === color ? 'border-foreground scale-110 shadow-md' : 'border-transparent')
              }
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="campaign-goal" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
          Goal
        </label>
        <textarea
          id="campaign-goal"
          value={form.goal}
          disabled={disabled}
          rows={2}
          onChange={(e) => setForm((prev) => ({ ...prev, goal: e.target.value }))}
          className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/20 transition-all placeholder:text-muted-foreground/40 focus:ring-2"
          placeholder="What should this campaign achieve?"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="campaign-channels" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
          Channels
        </label>
        <FormMultiSelectField
          id="campaign-channels"
          value={form.channels}
          options={channelOptions}
          disabled={disabled}
          placeholder="Select channels…"
          onChange={(channels) => setForm((prev) => ({ ...prev, channels }))}
        />
      </div>
    </div>
  );
}

export function CampaignsModal({
  open,
  campaigns,
  contentItems,
  loading,
  isSaving,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: CampaignsModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'create'>('view');
  const [form, setForm] = useState<CampaignFormValues>(DEFAULT_CAMPAIGN_FORM);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('list');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sortedCampaigns = useMemo(
    () => sortCampaignsByStartDate(campaigns),
    [campaigns],
  );

  const selectedCampaign = useMemo(
    () => sortedCampaigns.find((c) => c.id === selectedId) ?? null,
    [sortedCampaigns, selectedId],
  );

  const linkedPosts = useMemo(
    () => (selectedCampaign ? getLinkedPostsForCampaign(selectedCampaign, contentItems) : []),
    [selectedCampaign, contentItems],
  );

  const channelOptions = useMemo(() => {
    const merged = new Set(MARKETING_CHANNEL_OPTIONS);
    campaigns.forEach((campaign) => {
      parseChannelsList(campaign.channels).forEach((channel) => merged.add(channel));
    });
    return Array.from(merged);
  }, [campaigns]);

  useEffect(() => {
    if (!open) return;
    if (sortedCampaigns.length > 0 && !selectedId && mode !== 'create') {
      setSelectedId(sortedCampaigns[0].id);
      setForm(campaignToForm(sortedCampaigns[0]));
    }
  }, [open, sortedCampaigns, selectedId, mode]);

  useEffect(() => {
    if (!open) {
      setMode('view');
      setSelectedId(null);
      setForm(DEFAULT_CAMPAIGN_FORM);
      setMobilePanel('list');
      setConfirmDelete(false);
    }
  }, [open]);

  const selectCampaign = (campaign: MarketingCampaign) => {
    setMode('view');
    setSelectedId(campaign.id);
    setForm(campaignToForm(campaign));
    setConfirmDelete(false);
    setMobilePanel('detail');
  };

  const startCreate = () => {
    setMode('create');
    setSelectedId(null);
    setForm(DEFAULT_CAMPAIGN_FORM);
    setConfirmDelete(false);
    setMobilePanel('detail');
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.start_date) return;

    if (mode === 'create') {
      const created = await onCreate(form);
      if (created?.id) {
        setMode('view');
        setSelectedId(created.id);
        setForm(campaignToForm(created));
      }
      return;
    }

    if (selectedId) {
      await onUpdate(selectedId, form);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    await onDelete(selectedId);
    setConfirmDelete(false);
    setSelectedId(campaigns.find((c) => c.id !== selectedId)?.id ?? null);
    setMode('view');
    setMobilePanel('list');
  };

  if (!open) return null;

  const panelClass = (panel: MobilePanel) =>
    mobilePanel === panel ? 'flex min-h-0 flex-1 flex-col' : 'hidden min-h-0 flex-1 flex-col lg:flex';

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaigns-modal-title"
        className="relative flex h-[min(92dvh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Marketing</p>
            <h2 id="campaigns-modal-title" className="truncate text-lg font-bold tracking-tight sm:text-xl">
              Campaigns
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Manage date ranges, goals, and linked content (auto-matched by publish date).
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-xl border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex shrink-0 gap-1 border-b border-border bg-muted/30 p-1.5 lg:hidden">
          <button
            type="button"
            className={
              'flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ' +
              (mobilePanel === 'list'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground')
            }
            onClick={() => setMobilePanel('list')}
          >
            All ({campaigns.length})
          </button>
          <button
            type="button"
            className={
              'flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ' +
              (mobilePanel === 'detail'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground')
            }
            onClick={() => setMobilePanel('detail')}
          >
            {mode === 'create' ? 'New' : 'Details'}
          </button>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(240px,34%)_1fr]">
          <section className={panelClass('list') + ' border-border lg:border-r'}>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-4">
              <span className="text-xs font-bold text-muted-foreground">{campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}</span>
              <button
                type="button"
                onClick={startCreate}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                New
              </button>
            </div>

            <div className="cc-scroll min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
              {loading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : sortedCampaigns.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                    <svg className="h-6 w-6 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">No campaigns yet</p>
                  <button
                    type="button"
                    onClick={startCreate}
                    className="mt-1 text-xs font-bold text-primary hover:underline"
                  >
                    Create your first campaign
                  </button>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {sortedCampaigns.map((campaign) => {
                    const active = selectedId === campaign.id && mode !== 'create';
                    const postCount = getLinkedPostsForCampaign(campaign, contentItems).length;
                    return (
                      <li key={campaign.id}>
                        <button
                          type="button"
                          onClick={() => selectCampaign(campaign)}
                          className={
                            'flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ' +
                            (active
                              ? 'border-primary/30 bg-primary/10 shadow-sm ring-1 ring-primary/20'
                              : 'border-transparent hover:border-border hover:bg-muted/40')
                          }
                        >
                          <span
                            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background"
                            style={{ backgroundColor: campaign.color }}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-bold">{campaign.name}</span>
                              {campaign.is_critical ? (
                                <span
                                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300"
                                  title="Critical campaign"
                                >
                                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                    <path d="M12 2l2.4 7.4h7.8l-6.3 4.6 2.4 7.4L12 17.2l-6.3 4.6 2.4-7.4L1.8 9.4h7.8z" />
                                  </svg>
                                  Critical
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {formatCampaignDateRange(campaign)}
                            </span>
                            <span className="mt-1 inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                              {postCount} linked post{postCount === 1 ? '' : 's'}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className={panelClass('detail') + ' min-h-0'}>
            {mode === 'create' || selectedCampaign ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="cc-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                  <CampaignFormFields
                    form={form}
                    setForm={setForm}
                    disabled={isSaving}
                    channelOptions={channelOptions}
                  />

                  {mode === 'view' && selectedCampaign && (
                    <div className="mt-6 space-y-3 border-t border-border pt-5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Linked posts
                        </h3>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          Auto · by publish date
                        </span>
                      </div>

                      {selectedCampaign.channels && (
                        <div className="flex flex-wrap gap-1.5">
                          {parseChannelsList(selectedCampaign.channels).map((ch) => (
                            <span
                              key={ch}
                              className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                            >
                              {ch}
                            </span>
                          ))}
                        </div>
                      )}

                      {linkedPosts.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
                          No content with a publish date in this campaign range.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {linkedPosts.map((post) => (
                            <li
                              key={post.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-3 py-2.5"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{post.title}</p>
                                <p className="text-[11px] text-muted-foreground">{post.publishDate}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                {post.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/20 px-4 py-3 sm:px-6">
                  <div className="flex items-center gap-2">
                    {mode === 'view' && selectedId && (
                      confirmDelete ? (
                        <>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => void handleDelete()}
                            className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            Confirm delete
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => setConfirmDelete(false)}
                            className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => setConfirmDelete(true)}
                          className="rounded-xl border border-destructive/30 px-3 py-2 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )
                    )}
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    {mode === 'create' && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          if (campaigns.length > 0 && selectedId) {
                            setMode('view');
                            const c = campaigns.find((x) => x.id === selectedId);
                            if (c) setForm(campaignToForm(c));
                          } else {
                            setMobilePanel('list');
                          }
                        }}
                        className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isSaving || !form.name.trim() || !form.start_date}
                      onClick={() => void handleSave()}
                      className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/15 transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving…' : mode === 'create' ? 'Create campaign' : 'Save changes'}
                    </button>
                  </div>
                </footer>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <p className="text-sm font-semibold text-muted-foreground">Select a campaign or create a new one</p>
                <button
                  type="button"
                  onClick={startCreate}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  New campaign
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
