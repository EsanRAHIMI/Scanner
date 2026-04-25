'use client';

import * as React from 'react';

interface CategoryChartsProps {
  title: string;
  data: Record<string, number>;
  color?: string;
  loading?: boolean;
}

export function CategoryCharts({ title, data, color = 'emerald', loading = false }: CategoryChartsProps) {
  const sortedData = React.useMemo(() => {
    return Object.entries(data)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [data]);

  const maxVal = Math.max(...Object.values(data), 1);

  const barColors: Record<string, string> = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    zinc: 'bg-zinc-500',
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-black/25">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black uppercase tracking-widest text-black/60 dark:text-white/60">
          {title}
        </h4>
        <span className="text-[10px] font-bold text-black/30 dark:text-white/30">Top 8</span>
      </div>

      <div className="flex flex-col gap-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex justify-between">
                <div className="h-3 w-20 animate-pulse rounded bg-black/5 dark:bg-white/5" />
                <div className="h-3 w-6 animate-pulse rounded bg-black/5 dark:bg-white/5" />
              </div>
              <div className="h-2 w-full animate-pulse rounded-full bg-black/5 dark:bg-white/5" />
            </div>
          ))
        ) : sortedData.length === 0 ? (
          <div className="py-10 text-center text-xs italic text-black/30 dark:text-white/30">
            No data available
          </div>
        ) : (
          sortedData.map(([name, count]) => (
            <div key={name} className="group flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="truncate text-black/70 dark:text-white/70 group-hover:text-black dark:group-hover:text-white transition-colors">
                  {name}
                </span>
                <span className="text-black/40 dark:text-white/40">{count}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${barColors[color] || barColors.emerald}`}
                  style={{ width: `${(count / maxVal) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
