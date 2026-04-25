'use client';

import * as React from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { StatCard } from './components/stat-card';
import { CategoryCharts } from './components/category-charts';
import { ActivityTimeline } from './components/activity-timeline';
import { BackupManager } from './components/backup-manager';
import Link from 'next/link';

const fetcher = (url: string) => apiFetch(url).then(res => res.json());

export function DashboardView() {
  const { data: stats, error: statsError, isLoading: statsLoading } = useSWR('/admin/dashboard/stats', fetcher, {
    refreshInterval: 10000, // Refresh every 10s
  });

  const { data: backupData, isLoading: backupsLoading } = useSWR('/admin/backups', fetcher);

  const error = statsError ? 'Failed to connect to backend' : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scrollbar-minimal pr-1 pb-10 animate-fade-in">
      <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-black dark:text-white">
            System Dashboard
          </h1>
          <p className="text-sm font-medium text-black/40 dark:text-white/40">
            Monitor products, database status, and manage backups.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-black/5 bg-white/50 px-3 py-1.5 shadow-sm backdrop-blur-md dark:border-white/5 dark:bg-black/40">
            <div className={`h-2 w-2 rounded-full ${stats?.db_status === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-[11px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">
              Database: {stats?.db_status || 'Checking...'}
            </span>
          </div>
          <Link 
            href="/products"
            className="flex h-10 items-center justify-center rounded-full bg-black px-6 text-xs font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-emerald-600 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-emerald-400"
          >
            Go to Products
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-bold text-red-500 dark:border-red-500/10">
          Error: {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          title="Total Products"
          value={stats?.products_count ?? 0}
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
          color="emerald"
          loading={statsLoading}
        />
        <StatCard
          title="DAM Assets"
          value={stats?.dam_count ?? 0}
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          color="blue"
          loading={statsLoading}
        />
        <StatCard
          title="Active Users"
          value={stats?.users_count ?? 0}
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
          color="purple"
          loading={statsLoading}
        />
        <StatCard
          title="Activity Logs"
          value={stats?.logs_count ?? 0}
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
          color="orange"
          loading={statsLoading}
        />
        <StatCard
          title="Calendar Items"
          value={stats?.calendar_count ?? 0}
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>}
          color="zinc"
          loading={statsLoading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Charts & Backups */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CategoryCharts 
              title="Products by Category" 
              data={stats?.category_counts || {}} 
              color="emerald"
              loading={statsLoading}
            />
            <CategoryCharts 
              title="Products by Color" 
              data={stats?.color_counts || {}} 
              color="blue"
              loading={statsLoading}
            />
            <CategoryCharts 
              title="Products by Space" 
              data={stats?.space_counts || {}} 
              color="purple"
              loading={statsLoading}
            />
            <CategoryCharts 
              title="Products by Material" 
              data={stats?.material_counts || {}} 
              color="orange"
              loading={statsLoading}
            />
          </div>

          <BackupManager 
            backupableCollections={stats?.backupable_collections || []} 
            initialBackups={backupData?.backups || []}
            loading={backupsLoading}
          />
        </div>

        {/* Right Column: Timeline */}
        <div className="lg:col-span-4">
          <ActivityTimeline 
            logs={stats?.recent_logs || []} 
            loading={statsLoading}
          />
        </div>
      </div>
      </div>
    </div>
  );
}
