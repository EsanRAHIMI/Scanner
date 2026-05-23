'use client';

import React, { useEffect, useState } from 'react';
import { ToastProvider } from '../../components/ui/toast-provider';
import { useCalendarLogic } from '../../hooks/use-calendar-logic';
import { CalendarHeader } from '../../components/calendar/CalendarHeader';
import { StatsSection } from '../../components/calendar/StatsSection';
import { FilterControls } from '../../components/calendar/FilterControls';
import { CalendarGrid } from '../../components/calendar/CalendarGrid';
import { useInsightsPanel } from '../../hooks/use-insights-panel';
import {
  CALENDAR_GRID_MAX_H_COLLAPSED,
  CALENDAR_GRID_MAX_H_EXPANDED,
} from '../../lib/calendar/constants';
import { AuthGuard } from '../../components/calendar/AuthGuard';
import { AssetsPickerModal } from '../../components/calendar/AssetsPickerModal';
import { CampaignsModal } from '../../components/calendar/CampaignsModal';
import { ContentItem } from '../../lib/calendar/types';
import { useProductsAssets } from '../../hooks/use-products-assets';
import { useCampaignsData } from '../../hooks/use-campaigns-data';
import { useCampaignsActions } from '../../hooks/use-campaigns-actions';

function CalendarContent() {
  const logic = useCalendarLogic();
  const products = useProductsAssets();
  const campaignsData = useCampaignsData({ enabled: logic.dataEnabled });
  const campaignsActions = useCampaignsActions({
    setCampaigns: campaignsData.setCampaigns,
    refresh: campaignsData.refresh,
  });
  const insightsPanel = useInsightsPanel(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: ContentItem } | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [assetsModalItem, setAssetsModalItem] = useState<ContentItem | null>(null);
  const [campaignsModalOpen, setCampaignsModalOpen] = useState(false);

  useEffect(() => {
    if (!logic.dataEnabled || logic.loading || campaignsData.loading) return;
    void logic.syncCampaignPlanningDrafts(campaignsData.campaigns, logic.contentItems);
  }, [
    logic.dataEnabled,
    logic.loading,
    logic.contentItems,
    logic.syncCampaignPlanningDrafts,
    campaignsData.campaigns,
    campaignsData.loading,
  ]);

  const openContextMenu = (e: React.MouseEvent, item: ContentItem) => {
    e.preventDefault();
    const menuWidth = 208;
    const menuHeight = 170;
    const padding = 12;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - padding);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - padding);
    setContextMenu({ x: Math.max(padding, x), y: Math.max(padding, y), item });
  };

  if (logic.loading && logic.contentItems.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col bg-background">
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/50 px-6 backdrop-blur-md">
          <div className="h-8 w-36 rounded-lg bg-muted animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-9 w-28 rounded-xl bg-muted animate-pulse" />
            <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
            <div className="h-9 w-32 rounded-xl bg-muted animate-pulse" />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1700px] flex-1 space-y-6 p-6">
          <div className="flex gap-3">
            <div className="h-[82px] min-w-[200px] rounded-xl bg-card border border-border animate-pulse" />
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-[82px] flex-1 min-w-[110px] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
          <div className="h-10 rounded-lg bg-muted animate-pulse" />
          <div className="rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="h-11 bg-muted/50 border-b border-border animate-pulse" />
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="h-[58px] border-t border-border px-6 flex items-center gap-8 animate-pulse"
                style={{ opacity: 1 - i * 0.08 }}
              >
                <div className="h-3 w-28 rounded-full bg-muted" />
                <div className="h-3 w-20 rounded-full bg-muted" />
                <div className="h-5 w-20 rounded-full bg-muted" />
                <div className="h-3 w-14 rounded-full bg-muted" />
                <div className="h-3 flex-1 max-w-[220px] rounded-full bg-muted" />
                <div className="h-3 w-24 rounded-full bg-muted ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (logic.error) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background px-6">
        <div className="max-w-md w-full text-center p-8 bg-card rounded-3xl shadow-2xl border border-border">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-8">{logic.error}</p>
          <button 
            onClick={() => logic.refresh()}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/10"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background selection:bg-primary/10 selection:text-primary">
      <div className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(circle_at_top_right,rgba(0,0,0,0.03),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(0,0,0,0.03),transparent_35%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent_35%)]" />

      <CalendarHeader
        onNew={() => {
          void logic.createNew();
        }}
        onOpenCampaigns={() => setCampaignsModalOpen(true)}
        campaignCount={campaignsData.campaigns.length}
        onHome={() => window.location.href = '/marketing'}
        onToggleAccount={() => setAccountOpen(v => !v)}
        username={logic.me?.username || ''}
        isSaving={logic.isSaving}
        onLogout={logic.logout}
        accountOpen={accountOpen}
        onCloseAccount={() => setAccountOpen(false)}
        insightsExpanded={insightsPanel.expanded}
        onToggleInsights={insightsPanel.toggle}
        insightsSummary={{
          totalCount: logic.contentItems.length,
          filteredCount: logic.filteredItems.length,
          selectedStatus: logic.selectedStatus,
          hasSearch: logic.searchTerm.trim().length > 0,
          published: logic.stats.published,
          scheduled: logic.stats.scheduled,
        }}
        insightsContent={
          <>
            <StatsSection stats={logic.stats} />
            <FilterControls
              searchTerm={logic.searchTerm}
              onSearchChange={logic.setSearchTerm}
              selectedStatus={logic.selectedStatus}
              onStatusChange={logic.setSelectedStatus}
              statusOptions={logic.statusOptions}
              filteredCount={logic.filteredItems.length}
              totalCount={logic.contentItems.length}
            />
          </>
        }
      />

      <main
        className="relative z-10 mx-auto flex w-full max-w-[1700px] flex-1 flex-col min-h-0 p-3 sm:p-4 md:p-6"
        style={
          {
            '--calendar-grid-max-h': insightsPanel.expanded
              ? CALENDAR_GRID_MAX_H_EXPANDED
              : CALENDAR_GRID_MAX_H_COLLAPSED,
          } as React.CSSProperties
        }
      >
        <CalendarGrid
          items={logic.filteredItems}
          campaigns={campaignsData.campaigns}
          allColumns={logic.allColumns}
          onContextMenu={openContextMenu}
          onCommitCell={logic.commitCellEdit}
          fieldOptions={logic.fieldOptions}
          canManageFieldOptions={Boolean(logic.me?.is_admin)}
          onDeleteFieldOption={logic.deleteFieldOption}
          onRegisterFieldOption={logic.registerFieldOption}
          onPickAssets={(item) => {
            setAssetsModalItem(item);
            void products.fetchAssets();
          }}
          className="min-h-0 flex-1"
        />
      </main>

      <AuthGuard
        authRequired={logic.authRequired}
        me={logic.me}
        onLogin={logic.login}
        onLogout={logic.logout}
        onCloseAuth={() => logic.setAuthRequired(false)}
        isSaving={logic.isSaving}
        loginError={logic.loginError}
      />

      <AssetsPickerModal
        open={Boolean(assetsModalItem)}
        item={assetsModalItem}
        productsData={products.data}
        productsLoading={products.loading}
        productsError={products.error}
        onClose={() => setAssetsModalItem(null)}
        onSave={async ({ productLabel, selectedUrls }: { productLabel: string; selectedUrls: string[] }) => {
          if (!assetsModalItem) return;
          const assetsValue = selectedUrls.join('\n');
          await logic.commitCellEdit(assetsModalItem.id, 'Assets', assetsValue);
          if (selectedUrls.length > 0) {
            await logic.commitCellEdit(assetsModalItem.id, 'Product', productLabel);
          }
          setAssetsModalItem(null);
        }}
      />

      <CampaignsModal
        open={campaignsModalOpen}
        campaigns={campaignsData.campaigns}
        contentItems={logic.contentItems}
        loading={campaignsData.loading}
        isSaving={campaignsActions.isSaving}
        onClose={() => setCampaignsModalOpen(false)}
        onCreate={campaignsActions.createCampaign}
        onUpdate={campaignsActions.updateCampaign}
        onDelete={campaignsActions.deleteCampaign}
      />

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div 
            className="fixed z-[101] w-52 rounded-2xl border border-border bg-popover/90 py-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-4 py-2 border-b border-border mb-1">
              <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60">Quick Actions</div>
            </div>
            <button 
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted font-bold flex items-center gap-3 transition-colors"
              onClick={() => { void logic.duplicateItem(contextMenu.item); setContextMenu(null); }}
            >
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
              Duplicate
            </button>
            <div className="my-1 border-t border-border" />
            <button 
              className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 font-bold flex items-center gap-3 transition-colors"
              onClick={() => { void logic.deleteItem(contextMenu.item.id); setContextMenu(null); }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ContentCalendarPage() {
  return (
    <ToastProvider>
      <CalendarContent />
    </ToastProvider>
  );
}
