'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '@/lib/api';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActivityLogModal({ isOpen, onClose }: ActivityLogModalProps) {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [skip, setSkip] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState('');

  const limit = 50;

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        skip: String(skip),
        ...(search && { search }),
        ...(actionFilter && { action: actionFilter }),
      });
      const res = await apiFetch(`/admin/activity-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch (e) {
      console.error('Failed to fetch logs', e);
    } finally {
      setLoading(false);
    }
  }, [skip, search, actionFilter]);

  React.useEffect(() => {
    if (isOpen) fetchLogs();
  }, [isOpen, fetchLogs]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex h-full max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-black/10 p-4 dark:border-white/10">
          <h2 className="text-xl font-bold text-black dark:text-white">Activity Logs</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/5">
            <svg className="h-6 w-6 text-black/60 dark:text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.02]">
          <input
            type="text"
            placeholder="Search users, IPs, details..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSkip(0); }}
            className="h-10 flex-1 min-w-[200px] rounded-lg border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-zinc-800"
          />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setSkip(0); }}
            className="h-10 rounded-lg border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-zinc-800"
          >
            <option value="">All Actions</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
            <option value="PRODUCT_EDIT">Product Edit</option>
            <option value="PRODUCT_DOWNLOAD">Download</option>
            <option value="PRODUCT_SHARE">Share</option>
            <option value="USER_UPDATE">Admin: User Update</option>
          </select>
          <div className="text-sm font-medium text-black/40 dark:text-white/40">Total: {total}</div>
        </div>

        <div className="scrollbar-minimal flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-black/[0.03] text-black/60 dark:bg-white/[0.03] dark:text-white/60">
                <tr>
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                  <th className="px-4 py-3 font-semibold">IP / Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-black/50 dark:text-white/50">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-black dark:text-white">{log.username}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        log.action === 'LOGIN' ? 'bg-emerald-500/10 text-emerald-600' :
                        log.action === 'LOGOUT' ? 'bg-orange-500/10 text-orange-600' :
                        log.action === 'PRODUCT_EDIT' ? 'bg-blue-500/10 text-blue-600' :
                        'bg-zinc-500/10 text-zinc-600'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-black/80 dark:text-white/80">{log.details}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-mono text-black/40 dark:text-white/40">{log.ip_address}</div>
                      <div className="mt-0.5 text-[10px] text-black/30 dark:text-white/30">{log.device}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-black/10 p-4 dark:border-white/10">
          <button
            disabled={skip === 0}
            onClick={() => setSkip(Math.max(0, skip - limit))}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-30 dark:border-white/10 dark:hover:bg-white/5"
          >
            Previous
          </button>
          <div className="text-xs text-black/40 dark:text-white/40">
            Showing {skip + 1} to {Math.min(skip + limit, total)} of {total}
          </div>
          <button
            disabled={skip + limit >= total}
            onClick={() => setSkip(skip + limit)}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-30 dark:border-white/10 dark:hover:bg-white/5"
          >
            Next
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
