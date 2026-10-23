'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/os/icons';
import { useSession } from '@/components/os/session';
import { useApi } from '@/lib/os/client';

type Notice = { id: string; source: string; message: string; href: string };

export function AdminNotices() {
  const { isAdmin } = useSession();
  const { data } = useApi<{ items: Notice[] }>(isAdmin ? 'notices' : null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const items = data?.items ?? [];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  if (!isAdmin) return null;

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        className="relative rounded-lg p-2 text-brand-black hover:bg-black/5"
        aria-label={items.length ? `${items.length} source notices` : 'Source notices'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon.alert className="h-5 w-5" />
        {items.length ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-burgundy px-1 text-[10px] font-semibold text-white">
            {items.length > 9 ? '9+' : items.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-[300] mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/5">
          <p className="border-b border-black/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-brand-dark-gray">Source notices</p>
          {items.length ? (
            <ul className="max-h-96 overflow-auto">
              {items.map((item) => (
                <li key={item.id} className="border-b border-black/5 last:border-b-0">
                  <Link href={item.href} onClick={() => setOpen(false)} className="block px-3 py-2.5 hover:bg-black/[0.03]">
                    <span className="block text-sm font-semibold text-brand-black">{item.source}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-brand-dark-gray">{item.message}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-sm text-brand-dark-gray">No source needs attention.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
