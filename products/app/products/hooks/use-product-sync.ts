import * as React from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

interface UseProductSyncProps {
  debouncedSearch: string;
  setSearch: (s: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useProductSync({
  debouncedSearch,
  setSearch,
  searchInputRef,
}: UseProductSyncProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Sync debounced search to URL
  React.useEffect(() => {
    const currentQ = searchParams?.get('q') || '';
    if (debouncedSearch !== currentQ) {
      const params = new URLSearchParams(searchParams?.toString());
      if (debouncedSearch) params.set('q', debouncedSearch);
      else params.delete('q');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [debouncedSearch, pathname, router, searchParams]);

  // Sync URL search back to state on initial load
  React.useEffect(() => {
    const q = searchParams?.get('q');
    if (q) setSearch(q);
  }, []);

  const focusSearchInput = React.useCallback(() => {
    const el = searchInputRef.current;
    if (!el) return;
    el.focus();
    try {
      el.select();
    } catch {
      // ignore
    }
  }, [searchInputRef]);

  // Global shortcuts: focus inline search (no modal)
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement).isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        focusSearchInput();
        return;
      }
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        focusSearchInput();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusSearchInput]);

  return {};
}
