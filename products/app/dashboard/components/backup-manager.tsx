'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';

interface Backup {
  name: string;
  original_collection: string;
  timestamp: string;
  record_count: number;
}

interface BackupManagerProps {
  backupableCollections: string[];
  initialBackups: Backup[];
  loading?: boolean;
}

export function BackupManager({ backupableCollections, initialBackups, loading = false }: BackupManagerProps) {
  const [backups, setBackups] = React.useState<Backup[]>(initialBackups);
  const [isOperating, setIsOperating] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setBackups(initialBackups);
  }, [initialBackups]);

  const fetchBackups = async () => {
    try {
      const res = await apiFetch('/admin/backups');
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups);
      }
    } catch (err) {
      console.error('Failed to fetch backups', err);
    }
  };

  const handleCreateBackup = async (col: string) => {
    if (isOperating) return;
    setIsOperating(`creating-${col}`);
    setError(null);
    try {
      const res = await apiFetch(`/admin/backup/${col}`, { method: 'POST' });
      if (res.ok) {
        await fetchBackups();
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to create backup');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsOperating(null);
    }
  };

  const handleDeleteBackup = async (name: string) => {
    if (isOperating || !confirm(`Are you sure you want to delete backup "${name}"?`)) return;
    setIsOperating(`deleting-${name}`);
    setError(null);
    try {
      const res = await apiFetch(`/admin/backup/${name}`, { method: 'DELETE' });
      if (res.ok) {
        setBackups(prev => prev.filter(b => b.name !== name));
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to delete backup');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsOperating(null);
    }
  };

  const handleRestoreBackup = async (name: string) => {
    if (isOperating || !confirm(`CRITICAL: Are you sure you want to restore "${name}"? This will OVERWRITE the current data.`)) return;
    setIsOperating(`restoring-${name}`);
    setError(null);
    try {
      const res = await apiFetch(`/admin/restore/${name}`, { method: 'POST' });
      if (res.ok) {
        alert('Restore successful!');
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to restore backup');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsOperating(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-black/25">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black uppercase tracking-widest text-black/60 dark:text-white/60">
          Database Backups
        </h4>
        <div className="flex gap-2">
          {error && (
            <span className="text-[10px] font-bold text-red-500 animate-fade-in">
              {error}
            </span>
          )}
        </div>
      </div>

      {/* Create Backup Buttons */}
      <div className="flex flex-wrap gap-2">
        {backupableCollections.map(col => (
          <button
            key={col}
            disabled={!!isOperating}
            onClick={() => handleCreateBackup(col)}
            className="flex items-center gap-2 rounded-lg border border-black/5 bg-black/[0.02] px-3 py-1.5 text-[11px] font-bold text-black/60 transition-all hover:bg-black/5 hover:text-black disabled:opacity-50 dark:border-white/5 dark:bg-white/[0.02] dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
          >
            {isOperating === `creating-${col}` ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            ) : (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            )}
            Backup {col}
          </button>
        ))}
      </div>

      {/* Backup List */}
      <div className="scrollbar-minimal max-h-[300px] overflow-y-auto rounded-xl border border-black/5 bg-black/[0.01] dark:border-white/5 dark:bg-white/[0.01]">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 bg-white dark:bg-[#121212] border-b border-black/5 dark:border-white/5 font-black uppercase tracking-wider text-black/30 dark:text-white/30">
            <tr>
              <th className="px-4 py-2.5">Target</th>
              <th className="px-4 py-2.5">Date & Time</th>
              <th className="px-4 py-2.5 text-center">Records</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={4} className="h-10 px-4"><div className="h-3 w-full rounded bg-black/5 dark:bg-white/5" /></td>
                </tr>
              ))
            ) : backups.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center italic text-black/30 dark:text-white/30">
                  No backups available
                </td>
              </tr>
            ) : (
              backups.map((b) => (
                <tr key={b.name} className="group hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-black text-black/70 dark:text-white/70 uppercase">
                    {b.original_collection}
                  </td>
                  <td className="px-4 py-3 font-medium text-black/50 dark:text-white/50">
                    {b.timestamp.replace(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/, '$1-$2-$3 $4:$5:$6')}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-black/40 dark:text-white/40">
                    {b.record_count}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        disabled={!!isOperating}
                        onClick={() => handleRestoreBackup(b.name)}
                        className="rounded bg-emerald-500/10 px-2 py-1 font-black text-emerald-600 hover:bg-emerald-500 hover:text-white disabled:opacity-30 dark:text-emerald-400"
                        title="Restore this backup"
                      >
                        {isOperating === `restoring-${b.name}` ? '...' : 'RESTORE'}
                      </button>
                      <button
                        disabled={!!isOperating}
                        onClick={() => handleDeleteBackup(b.name)}
                        className="rounded bg-red-500/10 px-2 py-1 font-black text-red-600 hover:bg-red-500 hover:text-white disabled:opacity-30 dark:text-red-400"
                        title="Delete backup"
                      >
                        {isOperating === `deleting-${b.name}` ? '...' : 'DELETE'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
