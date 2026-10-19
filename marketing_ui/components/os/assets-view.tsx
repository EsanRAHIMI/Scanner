'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { AssetGrid, ProductImage, useAssetSearch } from '@/components/os/asset-picker';
import { Icon } from '@/components/os/icons';
import { Drawer, ErrorBox, FilterSelect, MissingOpen, PageHeader, Skeleton, Toast } from '@/components/os/ui';
import { api, useApi, usePersisted } from '@/lib/os/client';
import { refreshAfterWrite, useDamUrl } from '@/lib/os/data';
import { money, type Asset, type Content } from '@/lib/os/model';
import { useUrlState } from '@/lib/os/url';

export function AssetsView() {
  const { params, update } = useUrlState();
  const router = useRouter();
  const urlQ = params.get('q') ?? '';
  const [draft, setDraft] = useState(urlQ);
  const [seenUrl, setSeenUrl] = useState(urlQ);
  if (urlQ !== seenUrl) {
    setSeenUrl(urlQ);
    setDraft(urlQ);
  }
  const timer = useRef<number>(0);
  const [category, setCategory] = usePersisted('assets.category', '');
  const [image, setImage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const search = useAssetSearch(urlQ, category);
  const dam = useDamUrl();
  const openId = params.get('open');
  const listed = openId ? search.items.find((item) => item.id === openId) ?? null : null;
  const remote = useApi<Asset>(openId && !listed ? `assets/${openId}` : null);
  const preview = listed ?? remote.data ?? null;
  const missing = Boolean(openId) && !listed && !remote.loading && !remote.data;
  const current = preview?.images[image] ?? preview?.image ?? null;

  function setQuery(value: string) {
    setDraft(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => update({ q: value || null }), 280);
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setToast({ text: 'Link copied.', tone: 'ok' });
    } catch {
      setToast({ text: 'Copy is blocked in this browser.', tone: 'error' });
    }
  }

  async function startContent(asset: Asset) {
    setBusy(true);
    try {
      const created = await api<Content>('content', {
        method: 'POST',
        json: { title: asset.name || asset.title || asset.code, status: 'Idea', hero_product: asset.name, assets: asset.images.slice(0, 6) },
      });
      refreshAfterWrite('content');
      router.push(`/content?open=${created.id}`);
    } catch (err) {
      setToast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Assets"
        subtitle="Product images from the DAM. Search here, manage files in the DAM."
        actions={
          dam ? (
            <a href={dam} target="_blank" rel="noreferrer" className="btn-outline gap-1.5 px-3 py-1.5 text-[13px]">
              Open DAM <Icon.external className="h-3.5 w-3.5" />
            </a>
          ) : null
        }
      >
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1 sm:min-w-[14rem]">
            <Icon.search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-dark-gray" />
            <input className="os-input pl-9" placeholder="Search collection, product, or code" value={draft} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <FilterSelect label="All categories" value={category} options={search.categories} onChange={setCategory} />
        </div>
      </PageHeader>

      {search.error ? (
        <div className="mb-3">
          <ErrorBox message={search.error} onRetry={search.retry} />
        </div>
      ) : null}
      <AssetGrid
        items={search.items}
        loading={search.loading}
        query={urlQ}
        onToggle={(asset) => {
          setImage(0);
          update({ open: asset.id });
        }}
      />
      {search.next != null ? (
        <div className="mt-5 text-center">
          <button type="button" className="btn-outline" onClick={() => void search.more()}>
            Load more
          </button>
        </div>
      ) : null}

      <Drawer
        open={Boolean(openId) && !missing}
        onClose={() => update({ open: null })}
        wide
        title={preview?.name || preview?.title || (remote.loading ? 'Loading…' : 'Product')}
        subtitle={[preview?.code, preview?.category].filter(Boolean).join(' · ')}
        footer={
          preview ? (
            <>
              <div className="flex gap-1">
                {current ? (
                  <button type="button" className="btn-ghost" onClick={() => void copy(current)}>
                    <Icon.copy className="h-4 w-4" /> Copy link
                  </button>
                ) : null}
                {dam ? (
                  <a href={dam} target="_blank" rel="noreferrer" className="btn-ghost">
                    DAM <Icon.external className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void startContent(preview)}>
                {busy ? 'Creating…' : 'Use in new content'}
              </button>
            </>
          ) : null
        }
      >
        {preview ? (
          <div className="space-y-4">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-[#f6f5f3]">
              <ProductImage src={current} alt={preview.name} className="h-full w-full object-contain p-4" />
            </div>
            {preview.images.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {preview.images.map((url, index) => (
                  <button key={url} type="button" onClick={() => setImage(index)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-[#f6f5f3] ${index === image ? 'border-brand-burgundy' : 'border-black/10'}`}>
                    <ProductImage src={url} alt="" className="h-full w-full object-contain p-1" />
                  </button>
                ))}
              </div>
            ) : null}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Collection', preview.name || '—'],
                ['Product', preview.title || '—'],
                ['Code', preview.code || '—'],
                ['Category', preview.category || '—'],
                ['Price', money(preview.price)],
                ['Images', String(preview.images.length)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] text-brand-dark-gray">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <Skeleton className="aspect-square" />
        )}
      </Drawer>
      {missing ? <MissingOpen kind="Asset" onClose={() => update({ open: null })} /> : null}
      <Toast message={toast?.text ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
    </>
  );
}
