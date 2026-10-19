'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Icon, type IconName } from '@/components/os/icons';
import { cx } from '@/components/os/ui';
import { api } from '@/lib/os/client';
import type { SearchHit } from '@/lib/os/model';

type Action = { id: string; label: string; hint: string; href: string; icon: IconName; image?: string | null };

export const NAV: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/', label: 'Overview', icon: 'overview' },
  { href: '/content', label: 'Content', icon: 'content' },
  { href: '/campaigns', label: 'Campaigns', icon: 'campaign' },
  { href: '/paid', label: 'Paid media', icon: 'paid' },
  { href: '/initiatives', label: 'Initiatives', icon: 'initiative' },
  { href: '/tasks', label: 'Tasks', icon: 'task' },
  { href: '/assets', label: 'Assets', icon: 'asset' },
  { href: '/reports', label: 'Reports', icon: 'report' },
];

export const SETUP: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/budgets', label: 'Budgets', icon: 'budget' },
  { href: '/targets', label: 'Targets', icon: 'target' },
  { href: '/connections', label: 'Connections', icon: 'plug' },
  { href: '/calendar', label: 'Sheet view', icon: 'sheet' },
];

export const CREATE: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/content?new=1', label: 'Content', icon: 'content' },
  { href: '/campaigns?new=1', label: 'Campaign', icon: 'campaign' },
  { href: '/tasks?new=1', label: 'Task', icon: 'task' },
  { href: '/initiatives?new=1', label: 'Initiative', icon: 'initiative' },
];

const HIT_ROUTE: Record<SearchHit['type'], (hit: SearchHit) => string> = {
  content: (hit) => `/content?open=${hit.id}`,
  campaign: (hit) => `/campaigns?open=${hit.id}`,
  initiative: (hit) => `/initiatives?open=${hit.id}`,
  task: (hit) => `/tasks?open=${hit.id}`,
  asset: (hit) => `/assets?open=${hit.id}`,
};

const HIT_ICON: Record<SearchHit['type'], IconName> = {
  content: 'content',
  campaign: 'campaign',
  initiative: 'initiative',
  task: 'task',
  asset: 'asset',
};

const HIT_LABEL: Record<SearchHit['type'], string> = {
  content: 'Content',
  campaign: 'Campaign',
  initiative: 'Initiative',
  task: 'Task',
  asset: 'Asset',
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <Palette onClose={onClose} /> : null;
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ term: string; hits: SearchHit[]; failed: boolean } | null>(null);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const term = query.trim();
  const searching = term.length >= 2;
  const current = searching && result?.term === term ? result : null;
  const hits = current?.hits ?? [];
  const failed = current?.failed ?? false;
  const busy = searching && !current;

  useEffect(() => {
    const timer = window.setTimeout(() => input.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (term.length < 2) return;
    let live = true;
    const timer = window.setTimeout(() => {
      api<{ items: SearchHit[] }>(`search?q=${encodeURIComponent(term)}`)
        .then((body) => live && setResult({ term, hits: body.items, failed: false }))
        .catch(() => live && setResult({ term, hits: [], failed: true }));
    }, 180);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [term]);

  const actions = ((): Action[] => {
    const term = query.trim().toLowerCase();
    const found = hits.map((hit) => ({
      id: `${hit.type}:${hit.id}`,
      label: hit.title || 'Untitled',
      hint: `${HIT_LABEL[hit.type]} · ${hit.meta}`,
      href: HIT_ROUTE[hit.type](hit),
      icon: HIT_ICON[hit.type],
      image: hit.image,
    }));
    const pages = [...NAV, ...SETUP]
      .filter((item) => !term || item.label.toLowerCase().includes(term))
      .map((item) => ({ id: `go:${item.href}`, label: item.label, hint: 'Go to', href: item.href, icon: item.icon }));
    const creates = CREATE.filter((item) => !term || `new ${item.label}`.toLowerCase().includes(term)).map((item) => ({
      id: `new:${item.href}`,
      label: `New ${item.label.toLowerCase()}`,
      hint: 'Create',
      href: item.href,
      icon: 'plus' as IconName,
    }));
    return term ? [...found, ...creates, ...pages] : [...creates, ...pages];
  })();

  const at = Math.min(cursor, Math.max(0, actions.length - 1));

  function go(action: Action | undefined) {
    if (!action) return;
    onClose();
    router.push(action.href);
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-start justify-center p-3 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Search">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center gap-3 border-b border-black/5 px-4">
          <Icon.search className="h-4 w-4 shrink-0 text-brand-dark-gray" />
          <input
            ref={input}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
              else if (event.key === 'ArrowDown') {
                event.preventDefault();
                setCursor(Math.min(actions.length - 1, at + 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setCursor(Math.max(0, at - 1));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                go(actions[at]);
              }
            }}
            placeholder="Search content, campaigns, tasks, products…"
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-brand-medium-gray"
            aria-label="Search"
          />
          {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-burgundy/20 border-t-brand-burgundy" /> : null}
          <kbd className="hidden rounded border border-black/10 px-1.5 py-0.5 text-[10px] text-brand-dark-gray sm:block">Esc</kbd>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto p-2" role="listbox">
          {failed ? <li className="px-3 py-2 text-sm text-red-700">Search is not reachable right now.</li> : null}
          {query.trim().length >= 2 && !busy && !hits.length && !failed ? (
            <li className="px-3 py-2 text-sm text-brand-dark-gray">Nothing matches “{query.trim()}”.</li>
          ) : null}
          {actions.map((action, index) => {
            const ActionIcon = Icon[action.icon];
            return (
              <li key={action.id} role="option" aria-selected={index === at}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => go(action)}
                  className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left', index === at ? 'bg-brand-burgundy/[0.06]' : '')}
                >
                  {action.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={action.image} alt="" className="h-8 w-8 shrink-0 rounded object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.04] text-brand-dark-gray">
                      <ActionIcon className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-brand-black">{action.label}</span>
                    <span className="block truncate text-xs text-brand-dark-gray">{action.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
