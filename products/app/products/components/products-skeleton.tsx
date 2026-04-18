'use client';

import * as React from 'react';

interface ProductsSkeletonProps {
  viewMode: 'gallery' | 'list';
  rowsOnly?: boolean;
}

export function ProductsSkeleton({ viewMode, rowsOnly }: ProductsSkeletonProps) {
  if (viewMode === 'list') {
    const rows = [...Array(10)].map((_, i) => (
      <tr key={i} className="animate-pulse border-t border-black/10 dark:border-white/10">
        {[...Array(6)].map((_, j) => (
          <td key={j} className="px-4 py-3">
            <div className="h-4 w-full rounded bg-black/5 dark:bg-white/5" />
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
    <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="animate-pulse space-y-3 overflow-hidden rounded-xl bg-black/[0.03] pb-3 dark:bg-white/[0.03]">
          <div className="aspect-square bg-black/5 dark:bg-white/5" />
          <div className="space-y-2 px-3">
            <div className="h-4 w-3/4 rounded bg-black/5 dark:bg-white/5" />
            <div className="h-3 w-1/2 rounded bg-black/5 dark:bg-white/5" />
            <div className="flex justify-between pt-1">
              <div className="h-3 w-1/4 rounded bg-black/5 dark:bg-white/5" />
              <div className="h-3 w-1/4 rounded bg-black/5 dark:bg-white/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
