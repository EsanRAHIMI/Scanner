'use client';

import { useEffect, useState } from 'react';

import { Icon } from '@/components/os/icons';
import { Drawer, Empty, ErrorBox, FilterSelect, Skeleton, cx } from '@/components/os/ui';
import { api } from '@/lib/os/client';
import { useDamUrl } from '@/lib/os/data';
import type { Asset } from '@/lib/os/model';

type Page = { items: Asset[]; next_skip: number | null; categories: string[] };

type Result = { key: string; items: Asset[]; next: number | null; error: string | null };

export function useAssetSearch(query: string, category: string) {
  const [result, setResult] = useState<Result | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const key = `${query.trim()}|${category}|${attempt}`;

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: '36' });
      if (query.trim()) params.set('q', query.trim());
      if (category) params.set('category', category);
      api<Page>(`assets?${params}`)
        .then((page) => {
          if (!live) return;
          setResult({ key, items: page.items, next: page.next_skip, error: null });
          setCategories(page.categories);
        })
        .catch((err: Error) => live && setResult({ key, items: [], next: null, error: err.message }));
    }, 220);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [query, category, key]);

  const current = result?.key === key ? result : null;

  async function more() {
    if (!current || current.next == null) return;
    const params = new URLSearchParams({ limit: '36', skip: String(current.next) });
    if (query.trim()) params.set('q', query.trim());
    if (category) params.set('category', category);
    try {
      const page = await api<Page>(`assets?${params}`);
      setResult({ ...current, items: [...current.items, ...page.items], next: page.next_skip });
    } catch (err) {
      setResult({ ...current, error: (err as Error).message });
    }
  }

  return {
    items: current?.items ?? result?.items ?? [],
    categories,
    next: current?.next ?? null,
    loading: !current,
    error: current?.error ?? null,
    more,
    retry: () => setAttempt((n) => n + 1),
  };
}

export function ProductImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) {
    return <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-brand-medium-gray">{src ? 'Image missing' : 'No image'}</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" className={className} onError={() => setFailed(src)} />
  );
}

export function AssetGrid({
  items,
  loading,
  selected,
  onToggle,
  query,
}: {
  items: Asset[];
  loading: boolean;
  selected?: Set<string>;
  onToggle: (asset: Asset) => void;
  query?: string;
}) {
  if (loading && !items.length) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, n) => (
          <Skeleton key={n} className="aspect-square" />
        ))}
      </div>
    );
  }
  if (!items.length) {
    return (
      <Empty title={query?.trim() ? 'No products match' : 'No products with images'}>
        {query?.trim() ? 'Try a collection name or product code.' : 'The DAM has no product images the marketing OS can show.'}
      </Empty>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((asset) => {
        const on = selected?.has(asset.id);
        return (
          <button
            key={asset.id}
            type="button"
            onClick={() => onToggle(asset)}
            className={cx(
              'group overflow-hidden rounded-xl border bg-white text-left transition',
              on ? 'border-brand-burgundy ring-2 ring-brand-burgundy/20' : 'border-black/[0.07] hover:border-black/20',
            )}
          >
            <div className="relative aspect-square bg-[#f6f5f3]">
              <ProductImage src={asset.thumb} alt={asset.name} className="h-full w-full object-contain p-2" />
              {on ? <span className="absolute right-2 top-2 rounded-full bg-brand-burgundy px-2 py-0.5 text-[10px] font-semibold text-white">Selected</span> : null}
            </div>
            <div className="px-2.5 py-2">
              <div className="truncate text-[13px] font-medium text-brand-black">{asset.name || asset.title || 'Unnamed'}</div>
              <div className="truncate text-[11px] text-brand-dark-gray">{[asset.code, asset.category].filter(Boolean).join(' · ') || '—'}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

type PickerProps = { open: boolean; onClose: () => void; onPick: (assets: Asset[]) => void };

export function AssetPicker(props: PickerProps) {
  return props.open ? <Picker {...props} /> : null;
}

function Picker({ onClose, onPick }: PickerProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [picked, setPicked] = useState<Map<string, Asset>>(new Map());
  const search = useAssetSearch(query, category);
  const dam = useDamUrl();
  const close = onClose;

  return (
    <Drawer
      open
      onClose={close}
      wide
      title="Pick from DAM"
      subtitle="Product images stay in the DAM. Content keeps a link to them."
      footer={
        <>
          {dam ? (
            <a href={dam} target="_blank" rel="noreferrer" className="btn-ghost">
              Open DAM <Icon.external className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={!picked.size}
            onClick={() => {
              onPick([...picked.values()]);
              close();
            }}
          >
            {picked.size ? `Add ${picked.size}` : 'Select products'}
          </button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="os-input min-w-0 flex-1" placeholder="Search collection or code" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        <FilterSelect label="All categories" value={category} options={search.categories} onChange={setCategory} />
      </div>
      {search.error ? <ErrorBox message={search.error} onRetry={search.retry} /> : null}
      <AssetGrid
        items={search.items}
        loading={search.loading}
        selected={new Set(picked.keys())}
        onToggle={(asset) =>
          setPicked((current) => {
            const next = new Map(current);
            if (next.has(asset.id)) next.delete(asset.id);
            else next.set(asset.id, asset);
            return next;
          })
        }
      />
      {search.next != null ? (
        <div className="mt-4 text-center">
          <button type="button" className="btn-outline" onClick={() => void search.more()}>
            Load more
          </button>
        </div>
      ) : null}
    </Drawer>
  );
}
