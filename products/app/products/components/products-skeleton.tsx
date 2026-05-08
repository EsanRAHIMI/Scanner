'use client';

import * as React from 'react';

interface ProductsSkeletonProps {
  viewMode: 'gallery' | 'list';
  rowsOnly?: boolean;
  columnCount?: number;
}

export function ProductsSkeleton({ viewMode, rowsOnly, columnCount = 6 }: ProductsSkeletonProps) {
  if (viewMode === 'list') {
    const cols = Math.max(1, columnCount);
    const rows = [...Array(10)].map((_, i) => (
      <tr key={i} className="animate-pulse border-t border-black/10 dark:border-white/10">
        {[...Array(cols)].map((_, j) => (
          <td key={j} className={j === 0 ? 'px-4 py-2.5' : 'px-4 py-3'}>
            {j === 0 ? (
              <div className="space-y-1.5">
                <div className="h-3.5 w-4/5 rounded bg-black/[0.08] dark:bg-white/[0.11]" />
                <div className="h-3 w-2/5 rounded bg-black/[0.06] dark:bg-white/[0.08]" />
              </div>
            ) : j === 1 ? (
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-md bg-black/[0.08] dark:bg-white/[0.11]" />
                <div className="h-3.5 w-3/5 rounded bg-black/[0.06] dark:bg-white/[0.08]" />
              </div>
            ) : (
              <div className="h-3.5 w-[85%] rounded bg-black/[0.06] dark:bg-white/[0.08]" />
            )}
          </td>
        ))}
      </tr>
    ));

    if (rowsOnly) return <>{rows}</>;

    return (
      <div className="w-full space-y-4 p-4">
        <table className="w-full">
          <tbody>{rows}</tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {[...Array(15)].map((_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-black/20"
        >
          <div className="relative aspect-square w-full bg-black/[0.06] dark:bg-white/[0.08]">
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-black/[0.02] to-transparent dark:via-white/[0.03]" />
          </div>
          <div className="space-y-2 p-2">
            <div className="h-3.5 w-4/5 rounded bg-black/[0.07] dark:bg-white/[0.09]" />
            <div className="h-3 w-2/5 rounded bg-black/[0.06] dark:bg-white/[0.08]" />
            <div className="flex items-center justify-between pt-0.5">
              <div className="h-3 w-1/3 rounded bg-black/[0.06] dark:bg-white/[0.08]" />
              <div className="h-3 w-1/4 rounded bg-black/[0.06] dark:bg-white/[0.08]" />
            </div>
            <div className="h-3 w-3/5 rounded bg-black/[0.06] dark:bg-white/[0.08]" />
          </div>
        </div>
      ))}
    </div>
  );
}
