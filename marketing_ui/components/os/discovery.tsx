'use client';

import { useEffect, useState } from 'react';

import { Empty, Panel, Pill } from '@/components/os/ui';
import { compact, shortDate } from '@/lib/os/model';

export type SearchQuery = { query: string; clicks: number; impressions: number; ctr?: number | null; position?: number | null };
export type SearchBlock = {
  state?: string;
  detail?: string;
  clicks?: number | null;
  impressions?: number | null;
  as_of?: string | null;
  queries?: SearchQuery[];
};
export type ReviewItem = {
  id: string;
  reviewer: string;
  stars: number | null;
  text: string;
  created: string;
  replied: boolean;
  owner: string;
};
export type ReviewBlock = {
  state?: string;
  detail?: string;
  rating?: number | null;
  count?: number | null;
  items?: ReviewItem[];
};

export function Discovery({
  search,
  reviews,
  people,
  onOwner,
}: {
  search?: SearchBlock;
  reviews?: ReviewBlock;
  people: string[];
  onOwner: (id: string, owner: string) => Promise<void>;
}) {
  const queries = search?.queries ?? [];
  const items = reviews?.items ?? [];
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Panel
        title="Search Console"
        action={<span className="text-[11px] text-brand-dark-gray">{searchSummary(search)}</span>}
        pad={false}
      >
        {queries.length ? (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white">
                <tr className="text-[10px] uppercase tracking-wider text-brand-medium-gray">
                  <th className="px-4 py-2 font-medium">Query</th>
                  <th className="px-2 py-2 text-right font-medium">Clicks</th>
                  <th className="px-2 py-2 text-right font-medium">Impr.</th>
                  <th className="px-4 py-2 text-right font-medium">Pos.</th>
                </tr>
              </thead>
              <tbody>
                {queries.map((row) => (
                  <tr key={row.query} className="border-t border-black/5">
                    <td className="px-4 py-2 text-[13px]">{row.query}</td>
                    <td className="px-2 py-2 text-right text-[13px] tabular-nums">{compact(row.clicks)}</td>
                    <td className="px-2 py-2 text-right text-[13px] tabular-nums text-brand-dark-gray">{compact(row.impressions)}</td>
                    <td className="px-4 py-2 text-right text-[13px] tabular-nums text-brand-dark-gray">{row.position == null ? '—' : row.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4">
            <Empty title={search?.state === 'ok' ? 'No search queries in this period' : search?.detail || 'Search Console has not been read yet'} />
          </div>
        )}
      </Panel>

      <Panel
        title="Google Reviews"
        action={<span className="text-[11px] text-brand-dark-gray">{reviewSummary(reviews)}</span>}
        pad={false}
      >
        {items.length ? (
          <ul className="max-h-[32rem] divide-y divide-black/5 overflow-auto">
            {items.map((review) => (
              <ReviewRow key={review.id} review={review} people={people} onOwner={onOwner} />
            ))}
          </ul>
        ) : (
          <div className="p-4">
            <Empty title={reviews?.state === 'ok' ? 'No reviews yet' : reviews?.detail || 'Google Reviews has not been read yet'} />
          </div>
        )}
      </Panel>
    </div>
  );
}

function searchSummary(search?: SearchBlock): string {
  if (!search || search.state === 'error' || search.state === 'unconfigured') return search?.detail || 'Not connected';
  const clicks = search.clicks == null ? '—' : compact(search.clicks);
  const impressions = search.impressions == null ? '—' : compact(search.impressions);
  return `${clicks} clicks · ${impressions} impressions`;
}

function reviewSummary(reviews?: ReviewBlock): string {
  if (!reviews || reviews.state === 'error' || reviews.state === 'unconfigured') return reviews?.detail || 'Not connected';
  const rating = reviews.rating == null ? '—' : Number(reviews.rating).toFixed(1);
  const count = reviews.count == null ? (reviews.items?.length ?? 0) : reviews.count;
  return `${rating} · ${count} reviews`;
}

function Stars({ value }: { value: number | null }) {
  const filled = value ?? 0;
  return (
    <span className="text-[13px] tracking-tight text-brand-burgundy" aria-label={value == null ? 'No star rating' : `${value} of 5 stars`}>
      {'★★★★★'.slice(0, filled)}
      <span className="text-black/15">{'★★★★★'.slice(filled)}</span>
    </span>
  );
}

function ReviewRow({ review, people, onOwner }: { review: ReviewItem; people: string[]; onOwner: (id: string, owner: string) => Promise<void> }) {
  const [draft, setDraft] = useState(review.owner);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => setDraft(review.owner), [review.owner]);
  const names = [...new Set([review.owner, ...people].map((name) => name.trim()).filter(Boolean))];

  async function commit() {
    const next = draft.trim();
    if (next === review.owner || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await onOwner(review.id, next);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stars value={review.stars} />
        <Pill tone={review.replied ? 'green' : 'amber'}>{review.replied ? 'Replied' : 'No reply'}</Pill>
        <span className="text-xs text-brand-dark-gray">{review.reviewer || 'Anonymous'}</span>
        <span className="ml-auto text-xs tabular-nums text-brand-dark-gray">{shortDate(review.created)}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-brand-black">{review.text || 'No written review'}</p>
      <label className="mt-3 block">
        <span className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">
          Sales owner
          {!review.owner ? <span className="font-semibold normal-case tracking-normal text-amber-800">Not set</span> : null}
        </span>
        <input
          className="w-full rounded-lg border border-brand-medium-gray/40 px-3 py-1.5 text-sm outline-none focus:border-brand-burgundy disabled:opacity-60"
          list={`sales-${review.id}`}
          value={draft}
          placeholder="Add the salesperson"
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
        />
        <datalist id={`sales-${review.id}`}>
          {names.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {failed ? <span className="mt-1 block text-xs text-red-700">The sales owner was not saved.</span> : null}
      </label>
    </li>
  );
}
