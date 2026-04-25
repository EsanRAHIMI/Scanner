'use client';

import * as React from 'react';

interface ActivityLog {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  details: string;
  ip_address: string;
}

interface ActivityTimelineProps {
  logs: ActivityLog[];
  loading?: boolean;
}

export function ActivityTimeline({ logs, loading = false }: ActivityTimelineProps) {
  const getActionStyles = (action: string) => {
    const a = action.toUpperCase();
    if (a.includes('EDIT')) return 'bg-blue-500 text-white dark:bg-blue-600';
    if (a.includes('CREATE')) return 'bg-emerald-500 text-white dark:bg-emerald-600';
    if (a.includes('DELETE')) return 'bg-red-500 text-white dark:bg-red-600';
    if (a.includes('LOGIN')) return 'bg-amber-500 text-white dark:bg-amber-600';
    if (a.includes('BACKUP')) return 'bg-purple-500 text-white dark:bg-purple-600';
    return 'bg-zinc-500 text-white dark:bg-zinc-600';
  };

  const getActionIcon = (action: string) => {
    const a = action.toUpperCase();
    if (a.includes('EDIT')) return <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
    if (a.includes('CREATE')) return <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>;
    if (a.includes('DELETE')) return <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
    if (a.includes('LOGIN')) return <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>;
    if (a.includes('BACKUP')) return <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>;
    return <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  };

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-black/25">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black uppercase tracking-widest text-black/60 dark:text-white/60">
          Recent Activity
        </h4>
        <button className="text-[10px] font-bold uppercase tracking-tight text-emerald-600 hover:underline dark:text-emerald-400">
          View All
        </button>
      </div>

      <div className="relative flex flex-col gap-8 pl-4">
        {/* Timeline Line */}
        <div className="absolute left-6 top-1 bottom-1 w-px bg-black/5 dark:bg-white/5" />

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="relative flex gap-6 animate-pulse">
               <div className="z-10 flex h-4 w-4 items-center justify-center rounded-full bg-black/5 dark:bg-white/5" />
               <div className="flex-1 space-y-2">
                 <div className="h-3 w-24 rounded bg-black/5 dark:bg-white/5" />
                 <div className="h-3 w-full rounded bg-black/5 dark:bg-white/5" />
               </div>
            </div>
          ))
        ) : logs.length === 0 ? (
          <div className="py-10 text-center text-xs italic text-black/30 dark:text-white/30">
            No activity logs found
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={log.id} className="group relative flex gap-6">
              {/* Dot */}
              <div className={`z-10 mt-1 flex h-4 w-4 flex-none items-center justify-center rounded-full shadow-sm ring-4 ring-white dark:ring-[#121212] transition-transform group-hover:scale-125 ${getActionStyles(log.action)}`}>
                {getActionIcon(log.action)}
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-black/80 dark:text-white/80 uppercase tracking-tight">
                    {log.action.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] font-medium text-black/30 dark:text-white/30">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs font-medium text-black/60 dark:text-white/60">
                  <span className="font-bold text-black dark:text-white">{log.username}</span> {log.details}
                </p>
                {log.ip_address && (
                  <span className="mt-1 text-[9px] font-mono text-black/20 dark:text-white/20">
                    IP: {log.ip_address}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
