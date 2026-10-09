'use client';

import React from 'react';

import {
  buildVariantCounts,
  countProductImageUrls,
  getProductCodeNumber,
  getProductCollectionName,
  getProductDisplayLabel,
  getProductMediaUrls,
  getProductPreviewUrl,
  getVariantCountForRecord,
  productMatchesSearch,
  sortProductsByNum,
} from '../../lib/calendar/product-fields';
import {
  canPreviewMediaUrl,
  extractUrls,
  getGoogleDriveFileId,
  getMediaPreviewUrl,
  isVideoUrl,
  DRIVE_IMAGE_WIDTH_FULL,
} from '../../lib/calendar/utils';

type ProductsAssetsResponse = {
  columns: string[];
  records: Array<{ id: string; fields: Record<string, unknown> }>;
};

type MobilePanel = 'products' | 'urls';

function normalizeUrlFieldName(columns: string[]): string {
  const found = columns.find((c) => c.trim().toLowerCase() === 'url');
  return found || 'URL';
}

function ProductListRow({
  record,
  active,
  urlFieldName,
  variantCount,
  imageCount,
  onSelect,
}: {
  record: { id: string; fields: Record<string, unknown> };
  active: boolean;
  urlFieldName: string;
  variantCount: number;
  imageCount: number;
  onSelect: () => void;
}) {
  const codeNumber = getProductCodeNumber(record.fields);
  const collectionName = getProductCollectionName(record.fields) || getProductDisplayLabel(record);
  const previewUrl = getProductPreviewUrl(record.fields, urlFieldName);

  return (
    <button
      type="button"
      className={
        'flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors sm:gap-3 sm:px-3.5 sm:py-3 ' +
        (active ? 'bg-primary/10 ring-1 ring-inset ring-primary/20' : 'hover:bg-muted/50')
      }
      onClick={onSelect}
    >
      <div className={
          'relative h-11 w-11 flex-none overflow-hidden rounded-lg border bg-muted/40 shadow-sm sm:h-12 sm:w-12 ' +
          (active ? 'border-primary/30' : 'border-border')
        }
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const el = e.currentTarget;
              const raw = getProductPreviewUrl(record.fields, urlFieldName);
              if (el.src !== raw && raw) el.src = raw;
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        {active ? (
          <span className="absolute bottom-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow sm:h-4 sm:w-4">
            <svg className="h-2 w-2 sm:h-2.5 sm:w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[11px] font-bold tracking-tight text-foreground sm:text-xs">
          {codeNumber || '—'}
        </p>
        <p className="truncate text-sm text-muted-foreground">{collectionName}</p>
        <p className="mt-0.5 flex gap-2 text-[10px] font-medium tabular-nums text-muted-foreground sm:hidden">
          <span>{variantCount} var.</span>
          <span>·</span>
          <span>{imageCount} img</span>
        </p>
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-0.5 border-l border-border/60 pl-3 text-[10px] font-medium tabular-nums text-muted-foreground sm:flex sm:pl-4 sm:text-[11px]">
        <span>{variantCount} variant{variantCount === 1 ? '' : 's'}</span>
        <span>{imageCount} image{imageCount === 1 ? '' : 's'}</span>
      </div>
    </button>
  );
}

function SelectedProductBanner({
  record,
  urlFieldName,
  compact = false,
}: {
  record: { id: string; fields: Record<string, unknown> };
  urlFieldName: string;
  compact?: boolean;
}) {
  const codeNumber = getProductCodeNumber(record.fields);
  const collectionName = getProductCollectionName(record.fields) || getProductDisplayLabel(record);
  const previewUrl = getProductPreviewUrl(record.fields, urlFieldName);

  return (
    <div
      className={
        'flex items-center gap-2.5 rounded-xl border border-border bg-muted/20 sm:gap-3 ' +
        (compact ? 'px-2.5 py-2' : 'px-3 py-2.5 sm:px-4')
      }
    >
      <div className="h-10 w-10 flex-none overflow-hidden rounded-lg border border-border bg-background shadow-sm sm:h-11 sm:w-11">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16" />
            </svg>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {codeNumber ? (
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary sm:text-[11px]">
              {codeNumber}
            </span>
          ) : null}
          <span className="truncate text-sm font-bold text-foreground">{collectionName}</span>
        </div>
      </div>
    </div>
  );
}

function UrlListItem({
  url,
  checked,
  onToggle,
}: {
  url: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col gap-2.5 border-b border-border px-3 py-3 transition-colors last:border-b-0 hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          className="h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary/20"
          onChange={onToggle}
        />
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-background shadow-sm sm:h-16 sm:w-16 sm:rounded-xl">
          {canPreviewMediaUrl(url) ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getMediaPreviewUrl(url, DRIVE_IMAGE_WIDTH_FULL)}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const el = e.currentTarget;
                  if (el.dataset.fallback === 'original') return;
                  if (el.src !== url) {
                    el.dataset.fallback = 'original';
                    el.src = url;
                    return;
                  }
                  const id = getGoogleDriveFileId(url);
                  if (id && !el.src.includes('=w')) {
                    el.src = `https://lh3.googleusercontent.com/d/${id}=w1000`;
                  }
                }}
              />
              {isVideoUrl(url) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <svg className="h-4 w-4 fill-current text-white" viewBox="0 0 24 24" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted-foreground/40">
              {isVideoUrl(url) ? 'VIDEO' : 'FILE'}
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 pl-7 sm:pl-0">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 break-all text-xs font-semibold text-primary hover:underline sm:truncate sm:text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={async (e) => {
              e.stopPropagation();
              e.preventDefault();
              try {
                await navigator.clipboard.writeText(url);
              } catch {
                /* ignore */
              }
            }}
          >
            Copy
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            Open
          </a>
        </div>
      </div>
    </label>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center sm:py-12">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground/30 sm:h-12 sm:w-12">
        <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-muted-foreground">{title}</p>
      {subtitle ? <p className="max-w-xs text-xs text-muted-foreground/70">{subtitle}</p> : null}
    </div>
  );
}

export function AssetsPickerModal({
  open,
  item,
  productsData,
  productsLoading,
  productsError,
  onClose,
  onSave,
}: {
  open: boolean;
  item: { id: string; fields?: Record<string, unknown> } | null;
  productsData: ProductsAssetsResponse | null;
  productsLoading: boolean;
  productsError: string | null;
  onClose: () => void;
  onSave: (args: { productId: string; productLabel: string; selectedUrls: string[] }) => Promise<void>;
}) {
  const [search, setSearch] = React.useState('');
  const [selectedProductId, setSelectedProductId] = React.useState('');
  const [selectedUrls, setSelectedUrls] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [mobilePanel, setMobilePanel] = React.useState<MobilePanel>('products');

  React.useEffect(() => {
    if (!open) return;

    const currentProduct = typeof item?.fields?.Product === 'string' ? String(item?.fields?.Product).trim() : '';
    if (currentProduct && productsData?.records?.length) {
      const byId = productsData.records.find((r) => r.id === currentProduct);
      if (byId) {
        setSelectedProductId(byId.id);
      } else {
        const byLabel = productsData.records.find(
          (r) => getProductDisplayLabel(r).toLowerCase() === currentProduct.toLowerCase(),
        );
        setSelectedProductId(byLabel?.id ?? '');
      }
    } else {
      setSelectedProductId(currentProduct);
    }

    setSelectedUrls(extractUrls(item?.fields?.Assets));
    setSearch('');
    setMobilePanel('products');
  }, [open, item, productsData?.records]);

  const urlFieldName = React.useMemo(() => normalizeUrlFieldName(productsData?.columns ?? []), [productsData?.columns]);

  const variantCounts = React.useMemo(
    () => buildVariantCounts(productsData?.records ?? []),
    [productsData?.records],
  );

  const products = React.useMemo(() => {
    const list = (productsData?.records ?? []).filter((r) => productMatchesSearch(r, search));
    return sortProductsByNum(list);
  }, [productsData?.records, search]);

  const selectedProduct = React.useMemo(() => {
    if (!selectedProductId) return null;
    return (productsData?.records ?? []).find((r) => r.id === selectedProductId) ?? null;
  }, [productsData?.records, selectedProductId]);

  const availableUrls = React.useMemo(() => {
    if (!selectedProduct) return [];
    return getProductMediaUrls(selectedProduct.fields, urlFieldName);
  }, [selectedProduct, urlFieldName]);

  const selectProduct = (id: string) => {
    setSelectedProductId(id);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setMobilePanel('urls');
    }
  };

  const handleSave = async () => {
    if (!selectedProductId) return;
    const p = (productsData?.records ?? []).find((r) => r.id === selectedProductId);
    const label = p ? getProductDisplayLabel(p) : selectedProductId;
    setSaving(true);
    try {
      await onSave({ productId: selectedProductId, productLabel: label, selectedUrls });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const panelClass = (panel: MobilePanel) =>
    panel === mobilePanel
      ? 'flex min-h-0 flex-1 flex-col overflow-hidden lg:flex'
      : 'hidden min-h-0 flex-1 flex-col overflow-hidden lg:flex';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assets-picker-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-md"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="relative flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden border-border bg-popover shadow-2xl sm:h-auto sm:max-h-[min(92dvh,880px)] sm:rounded-2xl sm:border">
        {/* Header */}
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:items-center sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1 pr-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Assets</p>
            <h2 id="assets-picker-title" className="text-base font-bold text-foreground sm:text-lg">
              Select product URLs
            </h2>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-xl border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Mobile tabs */}
        <div className="flex shrink-0 gap-1 border-b border-border bg-muted/30 p-1.5 lg:hidden">
          <button
            type="button"
            className={
              'flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ' +
              (mobilePanel === 'products'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground')
            }
            onClick={() => setMobilePanel('products')}
          >
            Products
            <span className="ml-1 tabular-nums text-muted-foreground">({products.length})</span>
          </button>
          <button
            type="button"
            className={
              'flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ' +
              (mobilePanel === 'urls'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground')
            }
            onClick={() => setMobilePanel('urls')}
            disabled={!selectedProductId}
          >
            Media
            <span className="ml-1 tabular-nums text-primary">({selectedUrls.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(260px,36%)_1fr] lg:gap-0">
          {/* Products column */}
          <section className={panelClass('products') + ' border-border lg:border-r'}>
            <div className="shrink-0 space-y-2 border-b border-border px-3 py-3 sm:px-4 lg:px-5">
              <label htmlFor="assets-product-search" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                Product
              </label>
              <input
                id="assets-product-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/20 transition-all placeholder:text-muted-foreground/40 focus:ring-2 sm:px-4 sm:py-3"
                placeholder="Search code or collection…"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {productsLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading…</p>
              ) : productsError ? (
                <p className="p-4 text-sm text-destructive">{productsError}</p>
              ) : products.length === 0 ? (
                <EmptyState title="No products found" subtitle="Try a different search term." />
              ) : (
                <div className="divide-y divide-border">
                  {products.map((r) => (
                    <ProductListRow
                      key={r.id}
                      record={r}
                      active={r.id === selectedProductId}
                      urlFieldName={urlFieldName}
                      variantCount={getVariantCountForRecord(r, variantCounts)}
                      imageCount={countProductImageUrls(r.fields, urlFieldName)}
                      onSelect={() => selectProduct(r.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* URLs column */}
          <section className={panelClass('urls') + ' flex min-h-0 flex-col'}>
            <div className="shrink-0 space-y-2 border-b border-border px-3 py-3 sm:px-4 lg:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Available URLs</p>
                  <p className="hidden text-xs text-muted-foreground sm:block">Select media for this calendar item.</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-primary">
                  {selectedUrls.length} selected
                </span>
              </div>
              {selectedProduct ? (
                <SelectedProductBanner record={selectedProduct} urlFieldName={urlFieldName} compact />
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {!selectedProductId ? (
                <EmptyState
                  title="Select a product"
                  subtitle="Choose a product from the list to see its media URLs."
                />
              ) : availableUrls.length === 0 ? (
                <EmptyState
                  title="No media URLs"
                  subtitle={`No links found in ${urlFieldName}, Image, or DAM fields.`}
                />
              ) : (
                <div className="bg-card">
                  {availableUrls.map((u) => (
                    <UrlListItem
                      key={u}
                      url={u}
                      checked={selectedUrls.includes(u)}
                      onToggle={() => {
                        setSelectedUrls((prev) =>
                          prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u],
                        );
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="shrink-0 border-t border-border bg-muted/20 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4">
          <p className="mb-3 hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 sm:block">
            URLs are saved newline-separated in the <span className="text-primary/70">Assets</span> field.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <button
              type="button"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50 sm:w-auto sm:py-2.5"
              onClick={() => setSelectedUrls([])}
              disabled={selectedUrls.length === 0}
            >
              Clear selection
            </button>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-2">
              {mobilePanel === 'urls' ? (
                <button
                  type="button"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted lg:hidden sm:py-2.5"
                  onClick={() => setMobilePanel('products')}
                >
                  Back to products
                </button>
              ) : null}
              <button
                type="button"
                disabled={saving || !selectedProductId}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[160px] sm:py-2.5"
                onClick={() => void handleSave()}
              >
                {saving ? 'Saving…' : 'Save to Calendar'}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
