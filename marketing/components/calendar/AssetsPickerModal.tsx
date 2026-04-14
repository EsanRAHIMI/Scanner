'use client';

import React from 'react';

import { extractUrls, isImageUrl, isVideoUrl } from '../../lib/calendar/utils';

type ProductsAssetsResponse = {
  columns: string[];
  records: Array<{ id: string; fields: Record<string, unknown> }>;
};

function getStringField(fields: Record<string, unknown> | undefined, key: string): string {
  const v = fields?.[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function normalizeUrlFieldName(columns: string[]): string {
  const found = columns.find((c) => c.trim().toLowerCase() === 'url');
  return found || 'URL';
}

function productLabel(r: { id: string; fields: Record<string, unknown> }): string {
  const fields = r.fields;
  return (
    getStringField(fields, 'Colecction Name') ||
    getStringField(fields, 'Collection Name') ||
    getStringField(fields, 'Name') ||
    r.id
  ).trim();
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

  React.useEffect(() => {
    if (!open) return;

    const currentProduct = typeof item?.fields?.Product === 'string' ? String(item?.fields?.Product).trim() : '';
    if (currentProduct && productsData?.records?.length) {
      const byId = productsData.records.find((r) => r.id === currentProduct);
      if (byId) {
        setSelectedProductId(byId.id);
      } else {
        const byLabel = productsData.records.find((r) => productLabel(r).toLowerCase() === currentProduct.toLowerCase());
        setSelectedProductId(byLabel?.id ?? '');
      }
    } else {
      setSelectedProductId(currentProduct);
    }

    const urls = extractUrls(item?.fields?.Assets);
    setSelectedUrls(urls);

    setSearch('');
  }, [open, item, productsData?.records]);

  const urlFieldName = React.useMemo(() => normalizeUrlFieldName(productsData?.columns ?? []), [productsData?.columns]);

  const products = React.useMemo(() => {
    const list = productsData?.records ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => productLabel(r).toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }, [productsData?.records, search]);

  const selectedProduct = React.useMemo(() => {
    if (!selectedProductId) return null;
    return (productsData?.records ?? []).find((r) => r.id === selectedProductId) ?? null;
  }, [productsData?.records, selectedProductId]);

  const availableUrls = React.useMemo(() => {
    const raw = selectedProduct ? selectedProduct.fields?.[urlFieldName] : '';
    return extractUrls(raw);
  }, [selectedProduct, urlFieldName]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Assets</div>
            <h2 className="truncate text-lg font-bold text-foreground">Select product URLs</h2>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
            onClick={onClose}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid gap-5 p-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Product</div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-input bg-muted/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
                placeholder="Search products..."
              />

              <div className="max-h-[52vh] overflow-auto rounded-xl border border-border bg-card">
                {productsLoading ? (
                  <div className="p-4 text-sm text-muted-foreground/50">Loading...</div>
                ) : productsError ? (
                  <div className="p-4 text-sm text-destructive">{productsError}</div>
                ) : products.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground/50">No products found</div>
                ) : (
                  <div className="divide-y divide-border">
                    {products.map((r) => {
                      const label = productLabel(r);
                      const active = r.id === selectedProductId;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className={
                            'w-full px-4 py-3 text-left transition-colors ' +
                            (active
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted/50')
                          }
                          onClick={() => setSelectedProductId(r.id)}
                        >
                          <div className="truncate text-sm font-semibold">{label}</div>
                          <div className="truncate text-[11px] text-muted-foreground/60">{r.id}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="text-[11px] text-muted-foreground/50">
                Selected ID: <span className="font-bold text-foreground/70">{selectedProductId || '—'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Available URLs</div>
                <div className="text-sm text-muted-foreground">
                  Pick the media assets from the product field.
                </div>
              </div>
              <div className="text-sm font-bold text-primary">{selectedUrls.length} selected</div>
            </div>

            {!selectedProductId ? (
              <div className="rounded-2xl border border-border bg-muted/30 p-12 flex flex-col items-center justify-center gap-3 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground/30">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="text-sm font-medium text-muted-foreground">Select a product to view its URLs</div>
              </div>
            ) : availableUrls.length === 0 ? (
              <div className="rounded-2xl border border-border bg-muted/30 p-12 flex flex-col items-center justify-center gap-3 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground/30">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                  No URLs in <span className="font-bold">{urlFieldName}</span>
                </div>
              </div>
            ) : (
              <div className="max-h-[52vh] overflow-auto rounded-2xl border border-border bg-card">
                <div className="divide-y divide-border">
                  {availableUrls.map((u) => {
                    const checked = selectedUrls.includes(u);
                    return (
                      <label
                        key={u}
                        className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/80"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                          onChange={() => {
                            setSelectedUrls((prev) => {
                              if (prev.includes(u)) return prev.filter((x) => x !== u);
                              return [...prev, u];
                            });
                          }}
                        />
                        <div className="h-12 w-12 flex-none overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                          {isImageUrl(u) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted-foreground/40">
                              {isVideoUrl(u) ? 'VIDEO' : 'FILE'}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <a
                            href={u}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-sm font-bold text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {u}
                          </a>
                          <div className="mt-1 flex items-center gap-3">
                            <button
                              type="button"
                              className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await navigator.clipboard.writeText(u);
                                } catch {}
                              }}
                            >
                              Copy
                            </button>
                            <a
                              href={u}
                              download
                              className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Download
                            </a>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
              <button
                type="button"
                className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold text-foreground hover:bg-muted transition-all disabled:opacity-50"
                onClick={() => setSelectedUrls([])}
                disabled={selectedUrls.length === 0}
              >
                Clear selection
              </button>

              <button
                type="button"
                disabled={saving || !selectedProductId}
                className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={async () => {
                  if (!selectedProductId) return;
                  const p = (productsData?.records ?? []).find((r) => r.id === selectedProductId);
                  const label = p ? productLabel(p) : selectedProductId;
                  setSaving(true);
                  try {
                    await onSave({ productId: selectedProductId, productLabel: label, selectedUrls });
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? 'Saving...' : 'Save to Calendar'}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-border px-6 py-4 text-[10px] uppercase font-bold tracking-widest text-muted-foreground/40 bg-muted/20">
          Tip:newline-separated URLs in the <span className="text-primary/70">Assets</span> field.
        </div>
      </div>
    </div>
  );
}
