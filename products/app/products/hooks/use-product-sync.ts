import * as React from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

interface UseProductSyncProps {
  debouncedSearch: string;
  setSearch: (s: string) => void;
  setShowCommandPalette: (v: boolean | ((prev: boolean) => boolean)) => void;
}

export function useProductSync({
  debouncedSearch,
  setSearch,
  setShowCommandPalette,
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

  // Recent Searches
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  React.useEffect(() => {
    const saved = localStorage.getItem('recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load recent searches', e);
      }
    }
  }, []);

  const addToRecent = React.useCallback((q: string) => {
    const val = q.trim();
    if (!val) return;
    setRecentSearches(prev => {
      const next = [val, ...prev.filter(x => x !== val)].slice(0, 5);
      localStorage.setItem('recent_searches', JSON.stringify(next));
      return next;
    });
  }, []);

  // Global Shortcuts
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || 
                      e.target instanceof HTMLTextAreaElement || 
                      (e.target as HTMLElement).isContentEditable;
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(v => !v);
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        setShowCommandPalette(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setShowCommandPalette]);

  return {
    recentSearches,
    addToRecent
  };
}
