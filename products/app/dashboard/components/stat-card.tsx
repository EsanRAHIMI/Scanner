'use client';

import * as React from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description?: string;
  color?: 'emerald' | 'blue' | 'purple' | 'orange' | 'zinc';
  loading?: boolean;
}

export function StatCard({ 
  title, 
  value, 
  icon, 
  description, 
  color = 'zinc',
  loading = false 
}: StatCardProps) {
  const colorStyles = {
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20',
    orange: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20',
    zinc: 'text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-500/10 border-zinc-100 dark:border-zinc-500/20',
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-black/10 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-white/10 dark:bg-black/25">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-black/40 dark:text-white/35">
            {title}
          </p>
          <h3 className="mt-1 text-3xl font-black tracking-tight text-black dark:text-white">
            {loading ? (
              <div className="h-9 w-20 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
            ) : (
              value
            )}
          </h3>
          {description && (
            <p className="mt-1 text-xs font-medium text-black/40 dark:text-white/40">
              {description}
            </p>
          )}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-transform group-hover:scale-110 ${colorStyles[color]}`}>
          {icon}
        </div>
      </div>
      
      {/* Subtle Background Glow */}
      <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-20 ${
        color === 'emerald' ? 'bg-emerald-500' :
        color === 'blue' ? 'bg-blue-500' :
        color === 'purple' ? 'bg-purple-500' :
        color === 'orange' ? 'bg-orange-500' : 'bg-zinc-500'
      }`} />
    </div>
  );
}
