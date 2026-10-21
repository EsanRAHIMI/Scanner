'use client';

import { useMemo, useState } from 'react';

import { Avatar, cx } from '@/components/os/ui';
import { usePeople } from '@/lib/os/data';

export function PeoplePicker({
  value,
  onChange,
  multiple = false,
  placeholder = 'Search people',
}: {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
}) {
  const people = usePeople();
  const [query, setQuery] = useState('');
  const selected = multiple ? (value as string[]) : value ? [value as string] : [];
  const names = useMemo(() => {
    const all = [...new Set([...(people.data?.items ?? []), ...selected].filter(Boolean))];
    const needle = query.trim().toLowerCase();
    return needle ? all.filter((name) => name.toLowerCase().includes(needle)) : all;
  }, [people.data?.items, query, selected]);

  function toggle(name: string) {
    if (multiple) {
      const next = selected.includes(name) ? selected.filter((item) => item !== name) : [...selected, name];
      onChange(next);
      return;
    }
    onChange(name === value ? '' : name);
    setQuery('');
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((name) => (
          <button key={name} type="button" className="inline-flex items-center gap-1 rounded-full bg-brand-burgundy/10 py-0.5 pl-0.5 pr-2 text-xs font-medium text-brand-burgundy" onClick={() => toggle(name)}>
            <Avatar name={name} />
            {name}
            <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>
      <input className="os-input" value={query} placeholder={placeholder} onChange={(event) => setQuery(event.target.value)} />
      {query || multiple ? (
        <ul className="max-h-40 overflow-auto rounded-xl border border-black/[0.07]">
          {names.length ? (
            names.map((name) => (
              <li key={name}>
                <button type="button" className={cx('os-row w-full text-sm', selected.includes(name) && 'bg-brand-burgundy/[0.06]')} onClick={() => toggle(name)}>
                  <Avatar name={name} />
                  {name}
                </button>
              </li>
            ))
          ) : query.trim() ? (
            <li>
              <button type="button" className="os-row w-full text-sm" onClick={() => toggle(query.trim())}>
                Add “{query.trim()}”
              </button>
            </li>
          ) : (
            <li className="px-3 py-2 text-xs text-brand-medium-gray">No people yet.</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
