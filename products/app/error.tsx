'use client';

import * as React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[Products] Uncaught error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-500 ring-8 ring-red-50/50 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/5">
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 15.75h.007v.008H12v-.008Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div>
        <h2 className="text-xl font-bold text-black dark:text-white">Something went wrong</h2>
        <p className="mt-2 max-w-sm text-sm text-black/50 dark:text-white/50">
          An unexpected error occurred while loading the products dashboard. Please try again.
        </p>
        {error.digest && (
          <p className="mt-1 text-xs font-mono text-black/30 dark:text-white/30">
            Error ID: {error.digest}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-emerald-600 px-8 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-emerald-700 active:scale-95"
      >
        Try Again
      </button>
    </div>
  );
}
