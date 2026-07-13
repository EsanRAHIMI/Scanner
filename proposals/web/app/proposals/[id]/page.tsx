'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api, fmtMoney, STATUS_STYLES } from '@/lib/api';
import { driveDirectLink } from '@/lib/product-image';
import type { CatalogProduct, Proposal, ProposalItem, ProposalPage } from '@/lib/types';

import { ProposalPagePreview } from './page-preview';
import { ProposalPageThumbPreview } from './page-thumb-preview';

type Tab = 'page' | 'products' | 'pricing' | 'details';

/** Common Lorenzo rooms — suggestions only (free text is allowed). Mirrors the New-Proposal wizard. */
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

/** A product chosen in the Add-Product modal, with its per-item room/qty. */
type PickedProduct = { product: CatalogProduct; room: string; qty: number };

const PAGE_TYPE_LABELS: Record<string, string> = {
  cover: 'Cover',
  intro: 'Company Intro',
  room_title: 'Room Title',
  product_visual: 'Product Visual',
  product_spec: 'Specification',
  pricing_summary: 'Pricing Summary',
  custom: 'Custom Page',
  closing: 'Closing',
};

function newId(): string {
  return Math.random().toString(36).slice(2, 14);
}

export default function ProposalEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState('');
  const [pageIdx, setPageIdx] = useState(0);
  const [tab, setTab] = useState<Tab>('page');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [shareInfo, setShareInfo] = useState<{ share_url: string; share_pdf_url: string } | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  // Shown while the "add products" request inserts new items + pages.
  const [addBusy, setAddBusy] = useState(false);
  // True after items are REMOVED — removing leaves stale pages that need a regenerate.
  const [needsRegen, setNeedsRegen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- load ----------
  useEffect(() => {
    api<Proposal>(`/${id}`)
      .then(setProposal)
      .catch((e) => setError((e as Error).message));
  }, [id]);

  const pages = useMemo(() => proposal?.pages ?? [], [proposal]);
  const page = pages[pageIdx];

  // ---------- mutation + debounced autosave ----------
  const persist = useCallback(
    async (p: Proposal) => {
      setSaving(true);
      try {
        const saved = await api<Proposal>(`/${p.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: p.title,
            customer: p.customer,
            project: p.project,
            salesperson: p.salesperson,
            pages: p.pages,
            items: p.items.map((it) => ({
              id: it.id,
              product_id: it.product_id,
              room: it.room,
              qty: it.qty,
              overrides: {
                name: it.name,
                code: it.code,
                design: it.design,
                category: it.category,
                material: it.material,
                color: it.color,
                size: it.size,
                pieces: it.pieces,
                light: it.light,
                description: it.description,
                price: it.price,
                image_url: it.image_url,
                drawing_url: it.drawing_url,
                spec_title: it.spec_title,
              },
            })),
            pricing: {
              discount_pct: p.pricing?.discount_pct,
              vat_pct: p.pricing?.vat_pct,
              currency: p.pricing?.currency,
              notes: p.pricing?.notes,
            },
          }),
        });
        setProposal(saved);
        setDirty(false);
        setPreviewKey((k) => k + 1);
      } catch (e) {
        setError(`Save failed: ${(e as Error).message}`);
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const mutate = useCallback(
    (fn: (p: Proposal) => Proposal, autosave = true) => {
      setProposal((prev) => {
        if (!prev) return prev;
        const next = fn(structuredClone(prev));
        setDirty(true);
        if (autosave) {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => void persist(next), 900);
        }
        return next;
      });
    },
    [persist]
  );

  function saveNow() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (proposal) void persist(proposal);
  }

  // ---------- page ops ----------
  function setPageData(key: string, value: unknown) {
    mutate((p) => {
      const target = p.pages[pageIdx];
      if (target) target.data = { ...target.data, [key]: value };
      return p;
    });
  }

  function movePage(from: number, dir: -1 | 1) {
    const to = from + dir;
    if (to < 0 || to >= pages.length) return;
    mutate((p) => {
      const [moved] = p.pages.splice(from, 1);
      p.pages.splice(to, 0, moved);
      return p;
    });
    setPageIdx(to);
  }

  function duplicatePage(idx: number) {
    mutate((p) => {
      const copy = structuredClone(p.pages[idx]);
      copy.id = newId();
      p.pages.splice(idx + 1, 0, copy);
      return p;
    });
    setPageIdx(idx + 1);
  }

  function removePage(idx: number) {
    if (pages.length <= 1) return;
    if (!confirm('Remove this page?')) return;
    mutate((p) => {
      p.pages.splice(idx, 1);
      return p;
    });
    setPageIdx(Math.max(0, idx - 1));
  }

  function addCustomPage() {
    mutate((p) => {
      p.pages.splice(pageIdx + 1, 0, {
        id: newId(),
        type: 'custom',
        data: { heading: 'Custom Page', body: '', image_url: '' },
      });
      return p;
    });
    setPageIdx(pageIdx + 1);
    setTab('page');
  }

  // ---------- items ----------
  function setItem(itemId: string, patch: Partial<ProposalItem>) {
    mutate((p) => {
      p.items = p.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it));
      return p;
    });
  }

  function removeItem(itemId: string) {
    if (!confirm('Remove this product from the proposal? Regenerate pages afterwards to update them.')) return;
    mutate((p) => {
      p.items = p.items.filter((it) => it.id !== itemId);
      return p;
    });
    setNeedsRegen(true);
  }

  /**
   * Append catalog products to the proposal via the dedicated additive endpoint,
   * which also inserts the new products' pages into the existing flow WITHOUT
   * rebuilding (or destroying) existing pages / manual edits. No manual
   * "Regenerate" step is needed — the returned proposal already includes the
   * new items, pages and recomputed pricing.
   */
  async function addProducts(picked: PickedProduct[]) {
    if (!proposal || picked.length === 0) return;
    setShowAddProduct(false);
    setAddBusy(true);
    setError('');
    try {
      // Flush any pending manual edits first so the server has them before we
      // append (the endpoint reads the stored doc, then returns the merged result).
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirty) await persist(proposal);
      const saved = await api<Proposal>(`/${proposal.id}/items`, {
        method: 'POST',
        body: JSON.stringify({
          items: picked.map((s) => ({
            product_id: s.product.id,
            room: s.room.trim(),
            qty: Math.max(1, Number(s.qty) || 1),
          })),
        }),
      });
      setProposal(saved);
      setDirty(false);
      setPreviewKey((k) => k + 1);
    } catch (e) {
      setError(`Add products failed: ${(e as Error).message}`);
    } finally {
      setAddBusy(false);
    }
  }

  // ---------- actions ----------
  async function regenerate() {
    if (
      !confirm(
        'Regenerate rebuilds all pages from the template and current products. Manual page edits will be lost. Continue?'
      )
    )
      return;
    try {
      const saved = await api<Proposal>(`/${id}/generate`, { method: 'POST' });
      setProposal(saved);
      setPageIdx(0);
      setDirty(false);
      setNeedsRegen(false);
      setPreviewKey((k) => k + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function exportPdf() {
    setExporting(true);
    setError('');
    try {
      if (dirty && proposal) await persist(proposal);
      await api(`/${id}/export`, { method: 'POST' });
      const fresh = await api<Proposal>(`/${id}`);
      setProposal(fresh);
      window.open(`/api/proposals/${id}/pdf`, '_blank');
    } catch (e) {
      setError(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  }

  async function share() {
    try {
      const info = await api<{ share_url: string; share_pdf_url: string }>(`/${id}/share`, {
        method: 'POST',
      });
      setShareInfo(info);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function uploadImage(file: File): Promise<string | null> {
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api<{ url: string }>(
        `/assets/upload?proposal_id=${encodeURIComponent(id)}&kind=images`,
        { method: 'POST', body: form },
      );
      return res.url;
    } catch (e) {
      setError(`Upload failed: ${(e as Error).message}`);
      return null;
    }
  }

  // ---------- render helpers ----------
  if (error && !proposal) {
    return <div className="card border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }
  if (!proposal) {
    return <div className="py-20 text-center text-sm text-gray-500">Loading proposal…</div>;
  }

  const previewSrc = `/api/proposals/${proposal.id}/render?page=${pageIdx}&embed=1&v=${previewKey}`;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-brand-medium-gray/30 bg-brand-white px-4 py-2">
        <button className="btn-ghost px-2 text-xs" onClick={() => router.push('/')}>
          ← Proposals
        </button>
        <input
          className="w-64 rounded-md border border-transparent px-2 py-1 text-sm font-semibold hover:border-gray-300 focus:border-accent-600 focus:outline-none"
          value={proposal.title}
          onChange={(e) => mutate((p) => ({ ...p, title: e.target.value }))}
        />
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${STATUS_STYLES[proposal.status]}`}
        >
          {proposal.status}
        </span>
        <span className="text-xs text-gray-400">
          {addBusy
            ? 'Updating proposal pages…'
            : saving
              ? 'Saving…'
              : dirty
                ? 'Unsaved changes'
                : 'Saved'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void regenerate()}>
            Regenerate pages
          </button>
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={saveNow} disabled={saving || !dirty}>
            Save draft
          </button>
          <a
            className="btn-secondary px-3 py-1.5 text-xs"
            href={`/api/proposals/${proposal.id}/render`}
            target="_blank"
            rel="noreferrer"
          >
            Preview all
          </a>
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void share()}>
            Share
          </button>
          <button
            className="btn-primary px-3 py-1.5 text-xs"
            onClick={() => void exportPdf()}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}{' '}
          <button className="underline" onClick={() => setError('')}>
            dismiss
          </button>
        </div>
      )}

      {needsRegen && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <span>
            A product was removed. Its pages may still appear in the proposal until you regenerate.{' '}
            <span className="text-amber-700/80">
              (Regenerate rebuilds pages from the template and replaces manual page edits.)
            </span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn-primary px-3 py-1 text-xs" onClick={() => void regenerate()}>
              Regenerate pages
            </button>
            <button className="underline" onClick={() => setNeedsRegen(false)}>
              dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Thumbnails */}
        <aside className="flex w-52 shrink-0 flex-col overflow-hidden border-r border-brand-medium-gray/25 bg-brand-white">
          <div className="editor-scroll-rail flex-1 p-2">
            {pages.map((pg, i) => (
              <ThumbCard
                key={pg.id}
                proposalId={proposal.id}
                previewKey={previewKey}
                page={pg}
                index={i}
                active={i === pageIdx}
                total={pages.length}
                onSelect={() => setPageIdx(i)}
                onUp={() => movePage(i, -1)}
                onDown={() => movePage(i, 1)}
                onDuplicate={() => duplicatePage(i)}
                onRemove={() => removePage(i)}
              />
            ))}
            <button
              className="mt-2 w-full rounded-lg border border-dashed border-brand-medium-gray/40 py-2 text-xs text-brand-dark-gray hover:border-brand-burgundy/40 hover:text-brand-burgundy"
              onClick={addCustomPage}
            >
              + Add custom page
            </button>
          </div>
        </aside>

        {/* Preview */}
        <ProposalPagePreview src={previewSrc} pageKey={`${pageIdx}-${previewKey}`} />

        {/* Edit panel */}
        <aside className="flex w-[360px] shrink-0 flex-col overflow-hidden border-l border-brand-medium-gray/25 bg-brand-white">
          <div className="flex shrink-0 border-b border-brand-medium-gray/25 text-xs">
            {(
              [
                ['page', 'Page'],
                ['products', 'Products'],
                ['pricing', 'Pricing'],
                ['details', 'Details'],
              ] as [Tab, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-2 py-2.5 font-medium uppercase tracking-wide ${
                  tab === t
                    ? 'border-b-2 border-brand-burgundy text-brand-burgundy'
                    : 'text-brand-dark-gray hover:text-brand-black'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="editor-scroll-rail flex-1 space-y-4 p-4">
            {tab === 'page' && page && (
              <PageEditor
                page={page}
                onChange={setPageData}
                onUpload={uploadImage}
              />
            )}

            {tab === 'products' && (
              <ProductsEditor
                items={proposal.items}
                currency={proposal.pricing?.currency || 'AED'}
                onChange={setItem}
                onRemove={removeItem}
                onUpload={uploadImage}
                onAddClick={() => setShowAddProduct(true)}
              />
            )}

            {tab === 'pricing' && (
              <PricingEditor proposal={proposal} mutate={mutate} />
            )}

            {tab === 'details' && <DetailsEditor proposal={proposal} mutate={mutate} />}
          </div>
        </aside>
      </div>

      {/* Add-product modal */}
      {showAddProduct && (
        <AddProductModal
          currency={proposal.pricing?.currency || 'AED'}
          existingProductIds={
            new Set(proposal.items.map((it) => it.product_id).filter(Boolean) as string[])
          }
          onClose={() => setShowAddProduct(false)}
          onAdd={(picked) => void addProducts(picked)}
        />
      )}

      {/* Share dialog */}
      {shareInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShareInfo(null)}
        >
          <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">Share proposal</h3>
            <label className="label">Customer view link (no login required)</label>
            <div className="mb-3 flex gap-2">
              <input className="input" readOnly value={shareInfo.share_url} />
              <button
                className="btn-secondary"
                onClick={() => void navigator.clipboard.writeText(shareInfo.share_url)}
              >
                Copy
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {proposal.customer?.email && (
                <a
                  className="btn-secondary text-xs"
                  href={`mailto:${proposal.customer.email}?subject=${encodeURIComponent(
                    `Lorenzo Home — ${proposal.title}`
                  )}&body=${encodeURIComponent(
                    `Dear ${proposal.customer?.name || 'Customer'},%0D%0A%0D%0APlease find your proposal here: ${shareInfo.share_url}`
                  )}`}
                >
                  Send by email
                </a>
              )}
              {proposal.customer?.phone && (
                <a
                  className="btn-secondary text-xs"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://wa.me/${proposal.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Lorenzo Home — ${proposal.title}: ${shareInfo.share_url}`
                  )}`}
                >
                  Send via WhatsApp
                </a>
              )}
              {proposal.pdf_key && (
                <a
                  className="btn-secondary text-xs"
                  href={shareInfo.share_pdf_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Public PDF link
                </a>
              )}
            </div>
            <div className="mt-4 text-right">
              <button className="btn-ghost text-xs" onClick={() => setShareInfo(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ Thumbnail card ============================ */

function ThumbCard(props: {
  proposalId: string;
  previewKey: number;
  page: ProposalPage;
  index: number;
  total: number;
  active: boolean;
  onSelect: () => void;
  onUp: () => void;
  onDown: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { page, index, total, active, proposalId, previewKey } = props;
  const typeLabel = PAGE_TYPE_LABELS[page.type] || page.type;

  return (
    <div
      className={`group mb-2 cursor-pointer rounded-lg border p-1.5 transition ${
        active
          ? 'border-brand-burgundy bg-accent-50 shadow-[0_0_0_1px_rgba(80,15,40,0.15)]'
          : 'border-brand-medium-gray/25 bg-white hover:border-brand-medium-gray/50'
      }`}
      onClick={props.onSelect}
    >
      <div className="mb-1 flex items-center justify-between gap-1 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-dark-gray">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-right text-[9px] uppercase tracking-wide text-brand-medium-gray">
          {typeLabel}
        </span>
        <div className="hidden shrink-0 gap-0.5 group-hover:flex" onClick={(e) => e.stopPropagation()}>
          <button title="Move up" className="rounded px-1 text-[10px] hover:bg-black/5" onClick={props.onUp} disabled={index === 0}>
            ↑
          </button>
          <button title="Move down" className="rounded px-1 text-[10px] hover:bg-black/5" onClick={props.onDown} disabled={index === total - 1}>
            ↓
          </button>
          <button title="Duplicate" className="rounded px-1 text-[10px] hover:bg-black/5" onClick={props.onDuplicate}>
            ⧉
          </button>
          <button title="Remove" className="rounded px-1 text-[10px] text-red-600 hover:bg-red-50" onClick={props.onRemove}>
            ✕
          </button>
        </div>
      </div>

      <ProposalPageThumbPreview
        proposalId={proposalId}
        pageIndex={index}
        previewKey={previewKey}
      />

      {typeof page.data?.title === 'string' && page.data.title ? (
        <div className="mt-1 truncate px-0.5 text-[10px] text-brand-dark-gray">{String(page.data.title)}</div>
      ) : null}
    </div>
  );
}

/* ============================ Page editor ============================ */

function ImageField(props: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onUpload: (f: File) => Promise<string | null>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div>
      <label className="label">{props.label}</label>
      {props.value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={driveDirectLink(props.value)}
          alt=""
          className="mb-2 max-h-28 w-full rounded-lg border border-gray-200 object-cover"
        />
      ) : null}
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Image URL"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
        <button className="btn-secondary shrink-0 text-xs" onClick={() => inputRef.current?.click()}>
          Replace…
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            const url = await props.onUpload(f);
            if (url) props.onChange(url);
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}

function PageEditor(props: {
  page: ProposalPage;
  onChange: (key: string, value: unknown) => void;
  onUpload: (f: File) => Promise<string | null>;
}) {
  const { page, onChange, onUpload } = props;
  const d = page.data as Record<string, unknown>;
  const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');

  const text = (k: string, label: string) => (
    <div key={k}>
      <label className="label">{label}</label>
      <input className="input" value={str(k)} onChange={(e) => onChange(k, e.target.value)} />
    </div>
  );
  const area = (k: string, label: string, rows = 5, dir?: 'rtl') => (
    <div key={k}>
      <label className="label">{label}</label>
      <textarea
        className="input"
        dir={dir}
        rows={rows}
        value={str(k)}
        onChange={(e) => onChange(k, e.target.value)}
      />
    </div>
  );
  const image = (k: string, label: string) => (
    <ImageField key={k} label={label} value={str(k)} onChange={(url) => onChange(k, url)} onUpload={onUpload} />
  );

  switch (page.type) {
    case 'cover':
    case 'closing':
      return (
        <>
          <PanelTitle>{PAGE_TYPE_LABELS[page.type]}</PanelTitle>
          {text('tag', 'Corner label')}
          <p className="text-xs text-gray-400">
            Logo, contact footer and patterns come from the template branding (Admin → Templates).
          </p>
        </>
      );
    case 'intro':
      return (
        <>
          <PanelTitle>Company Introduction</PanelTitle>
          {text('heading', 'Heading (EN)')}
          {area('text_en', 'Text (EN)', 8)}
          {text('heading_ar', 'Heading (AR)')}
          {area('text_ar', 'Text (AR)', 8, 'rtl')}
          {image('image_url', 'Center image')}
        </>
      );
    case 'room_title':
      return (
        <>
          <PanelTitle>Room Title Page</PanelTitle>
          {text('title', 'Title')}
          {image('image_url', 'Room render / photo')}
        </>
      );
    case 'product_visual':
      return (
        <>
          <PanelTitle>Product Visual Page</PanelTitle>
          {image('image_url', 'Main render (dark card)')}
          {image('drawing_url', 'Technical drawing (light card)')}
        </>
      );
    case 'product_spec': {
      const rows = Array.isArray(d.rows) ? (d.rows as { label: string; value: string }[]) : [];
      return (
        <>
          <PanelTitle>Specification Page</PanelTitle>
          {text('title', 'Title')}
          <div>
            <label className="label">Specification rows</label>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="input max-w-[110px]"
                    value={row.label}
                    onChange={(e) => {
                      const next = rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r));
                      onChange('rows', next);
                    }}
                  />
                  <input
                    className="input"
                    value={row.value}
                    onChange={(e) => {
                      const next = rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r));
                      onChange('rows', next);
                    }}
                  />
                  <button
                    className="text-xs text-red-500"
                    onClick={() => onChange('rows', rows.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                className="btn-secondary w-full text-xs"
                onClick={() => onChange('rows', [...rows, { label: 'Label', value: '' }])}
              >
                + Add row
              </button>
            </div>
          </div>
        </>
      );
    }
    case 'pricing_summary': {
      const services = Array.isArray(d.services) ? (d.services as string[]) : [];
      return (
        <>
          <PanelTitle>Pricing Summary Page</PanelTitle>
          <p className="text-xs text-gray-400">
            Totals are calculated automatically from products + discount/VAT (Pricing tab).
          </p>
          {text('included_title', 'Included-services title')}
          <div>
            <label className="label">Included services / warranty</label>
            <div className="space-y-2">
              {services.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <textarea
                    className="input"
                    rows={2}
                    value={s}
                    onChange={(e) =>
                      onChange('services', services.map((x, j) => (j === i ? e.target.value : x)))
                    }
                  />
                  <button
                    className="text-xs text-red-500"
                    onClick={() => onChange('services', services.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                className="btn-secondary w-full text-xs"
                onClick={() => onChange('services', [...services, ''])}
              >
                + Add line
              </button>
            </div>
          </div>
          {area('notes', 'Extra notes', 3)}
        </>
      );
    }
    case 'custom':
      return (
        <>
          <PanelTitle>Custom Page</PanelTitle>
          {text('heading', 'Heading')}
          {area('body', 'Body text', 8)}
          {image('image_url', 'Image (optional)')}
        </>
      );
    default:
      return <p className="text-sm text-gray-500">No editable fields for this page type.</p>;
  }
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-gray-800">{children}</h3>;
}

/* ============================ Products editor ============================ */

function ProductsEditor(props: {
  items: ProposalItem[];
  currency: string;
  onChange: (id: string, patch: Partial<ProposalItem>) => void;
  onRemove: (id: string) => void;
  onUpload: (f: File) => Promise<string | null>;
  onAddClick: () => void;
}) {
  const { items, currency, onChange, onRemove, onAddClick } = props;
  const [openId, setOpenId] = useState<string>('');

  return (
    <div className="space-y-2">
      <button className="btn-primary w-full text-xs" onClick={onAddClick}>
        + Add product
      </button>
      {items.length === 0 ? (
        <p className="pt-1 text-sm text-gray-500">
          No products in this proposal yet. Use “Add product” to pick from the catalog.
        </p>
      ) : (
        <p className="text-xs text-gray-400">
          Edits here override catalog values for this proposal only. Use “Regenerate pages” to
          rebuild product pages after changes.
        </p>
      )}
      {items.map((it) => {
        const open = openId === it.id;
        return (
          <div key={it.id} className="rounded-lg border border-gray-200">
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left"
              onClick={() => setOpenId(open ? '' : it.id)}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{it.name || it.code || 'Product'}</div>
                <div className="truncate text-xs text-gray-500">
                  {[it.room, fmtMoney(it.price ?? null, currency)].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span className="text-gray-400">{open ? '▾' : '▸'}</span>
            </button>
            {open && (
              <div className="space-y-3 border-t border-gray-100 p-3">
                {(
                  [
                    ['room', 'Room / space'],
                    ['name', 'Name'],
                    ['design', 'Design'],
                    ['size', 'Size'],
                    ['material', 'Material'],
                    ['pieces', 'Pieces'],
                    ['light', 'Light'],
                    ['color', 'Color'],
                  ] as [keyof ProposalItem, string][]
                ).map(([k, label]) => (
                  <div key={String(k)}>
                    <label className="label">{label}</label>
                    <input
                      className="input"
                      value={(it[k] as string) || ''}
                      onChange={(e) => onChange(it.id, { [k]: e.target.value })}
                    />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Price ({currency})</label>
                    <input
                      className="input"
                      type="number"
                      value={it.price ?? ''}
                      onChange={(e) =>
                        onChange(it.id, { price: e.target.value === '' ? null : Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Qty</label>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={it.qty ?? 1}
                      onChange={(e) => onChange(it.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </div>
                </div>
                <ImageField
                  label="Product image"
                  value={it.image_url || ''}
                  onChange={(url) => onChange(it.id, { image_url: url })}
                  onUpload={props.onUpload}
                />
                <ImageField
                  label="Technical drawing"
                  value={it.drawing_url || ''}
                  onChange={(url) => onChange(it.id, { drawing_url: url })}
                  onUpload={props.onUpload}
                />
                <button className="text-xs text-red-500 hover:underline" onClick={() => onRemove(it.id)}>
                  Remove product
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================ Add-product modal ============================ */

function AddProductModal(props: {
  currency: string;
  existingProductIds: Set<string>;
  onClose: () => void;
  onAdd: (picked: PickedProduct[]) => void;
}) {
  const { currency, existingProductIds, onClose, onAdd } = props;

  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Map<string, PickedProduct>>(new Map());
  const [bulkRoom, setBulkRoom] = useState('');
  // Monotonic request id: only the latest request may write results, so a slow
  // earlier response (e.g. the initial empty-query load) can never overwrite a
  // newer search. Fixes "first search shows wrong results" race conditions.
  const reqIdRef = useRef(0);

  const loadCatalog = useCallback(
    async (append = false, skip = 0) => {
      const myId = ++reqIdRef.current;
      setLoading(true);
      setErr('');
      try {
        const params = new URLSearchParams({ limit: '48', skip: String(skip) });
        if (search.trim()) params.set('search', search.trim());
        if (category) params.set('category', category);
        const res = await api<{ records: CatalogProduct[]; has_more: boolean }>(
          `/catalog?${params.toString()}`,
        );
        if (myId !== reqIdRef.current) return; // a newer request superseded this one
        setCatalog((prev) => (append ? [...prev, ...res.records] : res.records));
        setHasMore(res.has_more);
      } catch (e) {
        if (myId !== reqIdRef.current) return;
        setErr((e as Error).message);
      } finally {
        if (myId === reqIdRef.current) setLoading(false);
      }
    },
    [search, category],
  );

  // Debounced search-as-you-type: runs the initial load and re-queries (from
  // page 0) whenever the search text or category changes. The server searches
  // name + code + category, so typing either a name or a code works.
  useEffect(() => {
    const t = setTimeout(() => {
      void loadCatalog(false, 0);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [catalog]);

  function toggle(p: CatalogProduct) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.set(p.id, { product: p, room: bulkRoom, qty: 1 });
      return next;
    });
  }

  function patchSelected(id: string, patch: Partial<PickedProduct>) {
    setSelected((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (cur) next.set(id, { ...cur, ...patch });
      return next;
    });
  }

  function applyRoomToAll() {
    setSelected((prev) => {
      const next = new Map(prev);
      for (const [id, v] of next) next.set(id, { ...v, room: bulkRoom });
      return next;
    });
  }

  const selectedList = Array.from(selected.values());
  const addSubtotal = selectedList.reduce(
    (sum, s) => sum + (s.product.price ?? 0) * (s.qty || 1),
    0,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="card flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold">Add products from catalog</h3>
          <button className="btn-ghost ml-auto px-2 text-xs" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 lg:flex-row">
          {/* Catalog */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex shrink-0 items-center gap-2">
              <div className="relative flex-1">
                <input
                  className="input w-full"
                  placeholder="Search name or code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void loadCatalog(false, 0)}
                  autoFocus
                />
                {loading && catalog.length > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    Searching…
                  </span>
                )}
              </div>
              <select
                className="input max-w-[160px]"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {err && (
              <div className="mb-2 shrink-0 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {err}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {loading && catalog.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-500">Loading catalog…</div>
              ) : catalog.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-500">
                  No products match. Try a different search.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {catalog.map((p) => {
                      const isSel = selected.has(p.id);
                      const already = p.id ? existingProductIds.has(p.id) : false;
                      return (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => toggle(p)}
                          className={`card overflow-hidden text-left transition ${
                            isSel ? 'ring-2 ring-brand-burgundy' : 'hover:shadow-brand-card-hover'
                          }`}
                        >
                          <div className="relative aspect-square bg-gray-100">
                            {p.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={driveDirectLink(p.image_url)}
                                alt={p.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-gray-400">
                                No image
                              </div>
                            )}
                            {already && (
                              <span className="absolute left-2 top-2 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                Added
                              </span>
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
                          <div className="min-h-[4.25rem] p-2">
                            <div className="truncate text-sm font-medium">
                              {p.name || p.code || p.id}
                            </div>
                            <div className="truncate text-xs text-gray-500">
                              {[p.code, p.category].filter(Boolean).join(' · ')}
                            </div>
                            <div className="mt-1 text-xs font-medium text-brand-burgundy">
                              {p.price !== null ? fmtMoney(p.price, currency) : p.price_raw || '—'}
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
                        disabled={loading}
                        onClick={() => void loadCatalog(true, catalog.length)}
                      >
                        {loading ? 'Loading…' : 'Load more'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Selected panel */}
          <div className="flex w-full shrink-0 flex-col lg:w-[320px]">
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <h4 className="text-sm font-semibold">
                Selected ({selected.size}) — {fmtMoney(addSubtotal, currency)}
              </h4>
            </div>
            <div className="mb-2 flex shrink-0 gap-2">
              <input
                className="input"
                list="add-room-suggestions"
                placeholder="Room for all (optional)"
                value={bulkRoom}
                onChange={(e) => setBulkRoom(e.target.value)}
              />
              <button
                className="btn-secondary shrink-0 text-xs"
                disabled={selected.size === 0}
                onClick={applyRoomToAll}
              >
                Apply to all
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {selectedList.length === 0 ? (
                <p className="text-sm text-gray-500">Tick products on the left to add them.</p>
              ) : (
                <ul className="space-y-2">
                  {selectedList.map((s) => (
                    <li key={s.product.id} className="rounded-lg border border-gray-200 p-2">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {s.product.name || s.product.code}
                        </span>
                        <button
                          className="text-xs text-red-500 hover:underline"
                          onClick={() => toggle(s.product)}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          className="input"
                          list="add-room-suggestions"
                          placeholder="Room / space"
                          value={s.room}
                          onChange={(e) => patchSelected(s.product.id, { room: e.target.value })}
                        />
                        <input
                          className="input max-w-[70px]"
                          type="number"
                          min={1}
                          value={s.qty}
                          onChange={(e) =>
                            patchSelected(s.product.id, {
                              qty: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <datalist id="add-room-suggestions">
              {ROOM_SUGGESTIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button className="btn-secondary text-xs" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary min-w-[150px] text-center text-xs"
            disabled={selected.size === 0}
            onClick={() => onAdd(selectedList)}
          >
            Add {selected.size > 0 ? `${selected.size} ` : ''}product{selected.size === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ Pricing editor ============================ */

function PricingEditor(props: {
  proposal: Proposal;
  mutate: (fn: (p: Proposal) => Proposal) => void;
}) {
  const { proposal, mutate } = props;
  const pricing = proposal.pricing || {};
  const currency = pricing.currency || 'AED';

  function setPricing(patch: Partial<Proposal['pricing']>) {
    mutate((p) => ({ ...p, pricing: { ...p.pricing, ...patch } }));
  }

  return (
    <div className="space-y-4">
      <PanelTitle>Pricing</PanelTitle>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Discount %</label>
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            value={pricing.discount_pct ?? 0}
            onChange={(e) => setPricing({ discount_pct: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="label">VAT %</label>
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            value={pricing.vat_pct ?? 0}
            onChange={(e) => setPricing({ vat_pct: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea
          className="input"
          rows={3}
          value={pricing.notes || ''}
          onChange={(e) => setPricing({ notes: e.target.value })}
        />
      </div>
      <dl className="space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">Subtotal</dt>
          <dd className="tabular-nums">{fmtMoney(pricing.subtotal, currency)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Discount ({pricing.discount_pct ?? 0}%)</dt>
          <dd className="tabular-nums">−{fmtMoney(pricing.discount_amount, currency)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">VAT ({pricing.vat_pct ?? 0}%)</dt>
          <dd className="tabular-nums">+{fmtMoney(pricing.vat_amount, currency)}</dd>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{fmtMoney(pricing.total, currency)}</dd>
        </div>
      </dl>
      <p className="text-xs text-gray-400">
        Totals recalculate on save and update the pricing summary page automatically.
      </p>
    </div>
  );
}

/* ============================ Details editor ============================ */

function DetailsEditor(props: {
  proposal: Proposal;
  mutate: (fn: (p: Proposal) => Proposal) => void;
}) {
  const { proposal, mutate } = props;

  function setCustomer(patch: Partial<Proposal['customer']>) {
    mutate((p) => ({ ...p, customer: { ...p.customer, ...patch } }));
  }
  function setProject(patch: Partial<Proposal['project']>) {
    mutate((p) => ({ ...p, project: { ...p.project, ...patch } }));
  }
  function setSales(patch: Partial<Proposal['salesperson']>) {
    mutate((p) => ({ ...p, salesperson: { ...p.salesperson, ...patch } }));
  }

  return (
    <div className="space-y-4">
      <PanelTitle>Customer</PanelTitle>
      <input className="input" placeholder="Name" value={proposal.customer?.name || ''} onChange={(e) => setCustomer({ name: e.target.value })} />
      <input className="input" placeholder="Phone" value={proposal.customer?.phone || ''} onChange={(e) => setCustomer({ phone: e.target.value })} />
      <input className="input" placeholder="Email" value={proposal.customer?.email || ''} onChange={(e) => setCustomer({ email: e.target.value })} />

      <PanelTitle>Project</PanelTitle>
      <input className="input" placeholder="Project name" value={proposal.project?.name || ''} onChange={(e) => setProject({ name: e.target.value })} />
      <input className="input" placeholder="Location" value={proposal.project?.location || ''} onChange={(e) => setProject({ location: e.target.value })} />
      <input className="input" placeholder="Proposal type (e.g. Lighting Proposal)" value={proposal.project?.kind || ''} onChange={(e) => setProject({ kind: e.target.value })} />
      <div>
        <label className="label">Valid until</label>
        <input className="input" type="date" value={proposal.project?.validity_date || ''} onChange={(e) => setProject({ validity_date: e.target.value })} />
      </div>

      <PanelTitle>Salesperson</PanelTitle>
      <input className="input" placeholder="Name" value={proposal.salesperson?.name || ''} onChange={(e) => setSales({ name: e.target.value })} />
      <input className="input" placeholder="Phone" value={proposal.salesperson?.phone || ''} onChange={(e) => setSales({ phone: e.target.value })} />
      <input className="input" placeholder="Email" value={proposal.salesperson?.email || ''} onChange={(e) => setSales({ email: e.target.value })} />
      <input className="input" placeholder="WhatsApp" value={proposal.salesperson?.whatsapp || ''} onChange={(e) => setSales({ whatsapp: e.target.value })} />
      <textarea className="input" rows={2} placeholder="Signature text" value={proposal.salesperson?.signature_text || ''} onChange={(e) => setSales({ signature_text: e.target.value })} />
    </div>
  );
}
