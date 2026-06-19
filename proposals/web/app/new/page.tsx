'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api, fmtMoney } from '@/lib/api';
import type { CatalogProduct, Proposal, Template } from '@/lib/types';

const ROOM_SUGGESTIONS = [
  'Entrance',
  'Majlis',
  'Living Room',
  'Dining Room',
  'Kitchen Island',
  'Master Bedroom',
  'Dressing Room',
  'Staircase',
  'Corridor',
];

type Selected = {
  product: CatalogProduct;
  room: string;
  qty: number;
};

const STEPS = ['Customer & Project', 'Select Products', 'Template', 'Generate'];

export default function NewProposalPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1 — customer & project
  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [proposalKind, setProposalKind] = useState('Lighting Proposal');
  const [validityDate, setValidityDate] = useState('');

  // Step 2 — products
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Map<string, Selected>>(new Map());

  // Step 3 — template
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState('');

  // Step 4
  const [discountPct, setDiscountPct] = useState<number | ''>('');
  const [vatPct, setVatPct] = useState<number | ''>('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const loadCatalog = useCallback(
    async (append = false, skip = 0) => {
      setCatalogLoading(true);
      try {
        const params = new URLSearchParams({ limit: '48', skip: String(skip) });
        if (search.trim()) params.set('search', search.trim());
        if (category) params.set('category', category);
        const res = await api<{ records: CatalogProduct[]; has_more: boolean }>(
          `/catalog?${params.toString()}`
        );
        setCatalog((prev) => (append ? [...prev, ...res.records] : res.records));
        setHasMore(res.has_more);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setCatalogLoading(false);
      }
    },
    [search, category]
  );

  useEffect(() => {
    if (step === 1) void loadCatalog();
  }, [step, loadCatalog]);

  useEffect(() => {
    if (step === 2 && templates.length === 0) {
      api<{ templates: Template[] }>('/templates')
        .then((res) => {
          setTemplates(res.templates);
          if (res.templates.length > 0) setTemplateId(res.templates[0].id);
        })
        .catch((e) => setError((e as Error).message));
    }
  }, [step, templates.length]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [catalog]);

  function toggleProduct(p: CatalogProduct) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.set(p.id, { product: p, room: '', qty: 1 });
      return next;
    });
  }

  function updateSelected(id: string, patch: Partial<Selected>) {
    setSelected((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (cur) next.set(id, { ...cur, ...patch });
      return next;
    });
  }

  const selectedList = Array.from(selected.values());
  const subtotal = selectedList.reduce(
    (sum, s) => sum + (s.product.price ?? 0) * (s.qty || 1),
    0
  );

  const canNext =
    step === 0
      ? Boolean(title.trim() || customerName.trim() || projectName.trim())
      : step === 1
        ? selected.size > 0
        : step === 2
          ? Boolean(templateId)
          : true;

  async function createProposal() {
    setCreating(true);
    setError('');
    try {
      const proposal = await api<Proposal>('', {
        method: 'POST',
        body: JSON.stringify({
          title:
            title.trim() ||
            [customerName.trim(), projectName.trim()].filter(Boolean).join(' — ') ||
            'Untitled proposal',
          customer: { name: customerName, phone: customerPhone, email: customerEmail },
          project: {
            name: projectName,
            location: projectLocation,
            kind: proposalKind,
            validity_date: validityDate,
          },
          template_id: templateId,
          items: selectedList.map((s) => ({
            product_id: s.product.id,
            room: s.room || 'Proposal',
            qty: s.qty || 1,
          })),
          pricing: {
            ...(discountPct !== '' ? { discount_pct: discountPct } : {}),
            ...(vatPct !== '' ? { vat_pct: vatPct } : {}),
          },
          generate: true,
        }),
      });
      router.push(`/proposals/${proposal.id}`);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-xl font-semibold">New Proposal</h1>
      <p className="mb-6 text-sm text-gray-500">
        Generate a branded Lorenzo proposal from the product catalog.
      </p>

      {/* Stepper */}
      <ol className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                i < step
                  ? 'bg-brand-burgundy text-white'
                  : i === step
                    ? 'border-2 border-brand-burgundy text-brand-burgundy'
                    : 'border border-gray-300 text-gray-400'
              }`}
            >
              {i + 1}
            </button>
            <span
              className={`text-sm ${i === step ? 'font-medium text-brand-black' : 'text-gray-500'}`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="mx-2 h-px w-8 bg-gray-300" />}
          </li>
        ))}
      </ol>

      {error && (
        <div className="card mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* ---- Step 1: customer & project ---- */}
      {step === 0 && (
        <div className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Proposal title</label>
            <input
              className="input"
              placeholder="e.g. Emirates Hills Villa"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Customer name</label>
            <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div>
            <label className="label">Customer phone</label>
            <input className="input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">Customer email</label>
            <input className="input" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Proposal type</label>
            <input
              className="input"
              value={proposalKind}
              onChange={(e) => setProposalKind(e.target.value)}
              placeholder="Lighting Proposal"
            />
          </div>
          <div>
            <label className="label">Project name</label>
            <input className="input" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={projectLocation} onChange={(e) => setProjectLocation(e.target.value)} />
          </div>
          <div>
            <label className="label">Valid until</label>
            <input className="input" type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} />
          </div>
        </div>
      )}

      {/* ---- Step 2: product selection ---- */}
      {step === 1 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="mb-3 flex gap-2">
              <input
                className="input"
                placeholder="Search name, code, category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void loadCatalog()}
              />
              <select className="input max-w-[180px]" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button className="btn-secondary" onClick={() => void loadCatalog()}>
                Search
              </button>
            </div>
            {catalogLoading && catalog.length === 0 ? (
              <div className="card p-12 text-center text-sm text-gray-500">Loading catalog…</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {catalog.map((p) => {
                    const isSel = selected.has(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => toggleProduct(p)}
                        className={`card overflow-hidden text-left transition ${
                          isSel ? 'ring-2 ring-brand-burgundy' : 'hover:shadow-brand-card-hover'
                        }`}
                      >
                        <div className="relative aspect-square bg-gray-100">
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-gray-400">
                              No image
                            </div>
                          )}
                          <span
                            className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                              isSel
                                ? 'border-brand-burgundy bg-brand-burgundy text-white'
                                : 'border-gray-300 bg-white text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                        </div>
                        <div className="p-2.5">
                          <div className="truncate text-sm font-medium">{p.name || p.code || p.id}</div>
                          <div className="truncate text-xs text-gray-500">
                            {[p.code, p.category].filter(Boolean).join(' · ')}
                          </div>
                          <div className="mt-1 text-xs font-medium text-brand-burgundy">
                            {p.price !== null ? fmtMoney(p.price) : p.price_raw || '—'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {hasMore && (
                  <div className="mt-4 text-center">
                    <button
                      className="btn-secondary"
                      disabled={catalogLoading}
                      onClick={() => void loadCatalog(true, catalog.length)}
                    >
                      {catalogLoading ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Selected panel */}
          <div className="card h-fit p-4">
            <h3 className="mb-3 text-sm font-semibold">
              Selected ({selected.size}) — {fmtMoney(subtotal)}
            </h3>
            {selectedList.length === 0 ? (
              <p className="text-sm text-gray-500">Tick products to include them.</p>
            ) : (
              <ul className="space-y-3">
                {selectedList.map((s) => (
                  <li key={s.product.id} className="rounded-lg border border-gray-200 p-2.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {s.product.name || s.product.code}
                      </span>
                      <button
                        className="text-xs text-red-500 hover:underline"
                        onClick={() => toggleProduct(s.product)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        className="input"
                        list="room-suggestions"
                        placeholder="Room / space (e.g. Majlis)"
                        value={s.room}
                        onChange={(e) => updateSelected(s.product.id, { room: e.target.value })}
                      />
                      <input
                        className="input max-w-[70px]"
                        type="number"
                        min={1}
                        value={s.qty}
                        onChange={(e) =>
                          updateSelected(s.product.id, { qty: Math.max(1, Number(e.target.value) || 1) })
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <datalist id="room-suggestions">
              {ROOM_SUGGESTIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
        </div>
      )}

      {/* ---- Step 3: template ---- */}
      {step === 2 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.length === 0 ? (
            <div className="card col-span-full p-12 text-center text-sm text-gray-500">
              Loading templates…
            </div>
          ) : (
            templates.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                className={`card p-5 text-left transition ${
                  templateId === t.id ? 'ring-2 ring-brand-burgundy' : 'hover:shadow-brand-card-hover'
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium">{t.name}</span>
                  {templateId === t.id && <span className="text-brand-burgundy">✓</span>}
                </div>
                <p className="text-xs text-gray-500">
                  {t.scope === 'global' ? 'Company template' : 'Assigned to you'}
                  {t.pricing_defaults?.discount_pct
                    ? ` · default discount ${t.pricing_defaults.discount_pct}%`
                    : ''}
                  {t.pricing_defaults?.vat_pct ? ` · VAT ${t.pricing_defaults.vat_pct}%` : ''}
                </p>
              </button>
            ))
          )}
        </div>
      )}

      {/* ---- Step 4: review & generate ---- */}
      {step === 3 && (
        <div className="card p-6">
          <h3 className="mb-4 font-semibold">Review & generate</h3>
          <dl className="mb-6 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between border-b border-gray-100 py-1.5">
              <dt className="text-gray-500">Customer</dt>
              <dd>{customerName || '—'}</dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 py-1.5">
              <dt className="text-gray-500">Project</dt>
              <dd>{[projectName, projectLocation].filter(Boolean).join(', ') || '—'}</dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 py-1.5">
              <dt className="text-gray-500">Products</dt>
              <dd>
                {selected.size} item{selected.size === 1 ? '' : 's'} · {fmtMoney(subtotal)}
              </dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 py-1.5">
              <dt className="text-gray-500">Template</dt>
              <dd>{templates.find((t) => t.id === templateId)?.name || '—'}</dd>
            </div>
          </dl>
          <div className="mb-6 grid max-w-md grid-cols-2 gap-4">
            <div>
              <label className="label">Discount % (blank = template default)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={discountPct}
                onChange={(e) =>
                  setDiscountPct(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>
            <div>
              <label className="label">VAT % (blank = template default)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={vatPct}
                onChange={(e) => setVatPct(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Generating creates the cover, company introduction, room pages, product visual and
            specification pages, pricing summary and closing page. You can edit everything before
            exporting the PDF.
          </p>
        </div>
      )}

      {/* Footer nav */}
      <div className="mt-6 flex items-center justify-between">
        <button
          className="btn-secondary"
          disabled={step === 0 || creating}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          ← Back
        </button>
        {step < STEPS.length - 1 ? (
          <button className="btn-primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continue →
          </button>
        ) : (
          <button className="btn-primary" disabled={creating} onClick={() => void createProposal()}>
            {creating ? 'Generating…' : 'Generate Proposal'}
          </button>
        )}
      </div>
    </div>
  );
}
