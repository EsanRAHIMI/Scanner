'use client';

import { useId } from 'react';

import { useSession } from '@/components/os/session';
import { cx } from '@/components/os/ui';
import { usePeople } from '@/lib/os/data';
import { meLabel } from '@/lib/os/model';

export function OwnerInput({ value, onChange, placeholder = 'Who owns it' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const id = useId();
  const people = usePeople();
  const { me } = useSession();
  const mine = meLabel(me);
  const names = [...new Set([mine, ...(people.data?.items ?? [])].filter(Boolean))];
  return (
    <div className="flex gap-1.5">
      <input className="os-input min-w-0 flex-1" list={id} value={value} placeholder={placeholder} maxLength={80} onChange={(e) => onChange(e.target.value)} />
      <datalist id={id}>
        {names.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {mine && value !== mine ? (
        <button type="button" className="btn-ghost shrink-0 px-2 text-xs" onClick={() => onChange(mine)}>
          Me
        </button>
      ) : null}
    </div>
  );
}

export function ChipPicker({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((name) => {
        const on = value.includes(name);
        return (
          <button
            key={name}
            type="button"
            aria-pressed={on}
            className={cx('os-chip', on && 'os-chip-on')}
            onClick={() => onChange(on ? value.filter((item) => item !== name) : [...value, name])}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({ stages, value, onChange }: { stages: readonly string[]; value: string; onChange: (value: string) => void }) {
  const at = stages.indexOf(value);
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className="flex min-w-max items-center gap-1">
        {stages.map((stage, index) => {
          const done = index < at;
          const on = index === at;
          return (
            <li key={stage} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChange(stage)}
                aria-current={on ? 'step' : undefined}
                className={cx(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition',
                  on && 'bg-brand-burgundy text-white shadow-sm',
                  done && 'bg-brand-burgundy/10 text-brand-burgundy',
                  !on && !done && 'bg-black/[0.04] text-brand-dark-gray hover:bg-black/[0.07]',
                )}
              >
                {stage}
              </button>
              {index < stages.length - 1 ? <span className={cx('h-px w-2', index < at ? 'bg-brand-burgundy/40' : 'bg-black/10')} /> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  placeholder = 'Unknown',
  prefix,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  prefix?: string;
}) {
  return (
    <div className="relative">
      {prefix ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-brand-dark-gray">{prefix}</span> : null}
      <input
        className={cx('os-input tabular-nums', prefix && 'pl-11')}
        inputMode="decimal"
        type="number"
        min={0}
        step="any"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === '') return onChange(null);
          const number = Number(raw);
          onChange(Number.isFinite(number) && number >= 0 ? number : null);
        }}
      />
    </div>
  );
}

/** Shallow diff for PATCH: only keys whose value changed. */
export function changed<T extends Record<string, unknown>>(before: T, after: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(after) as Array<keyof T>) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) out[key] = after[key];
  }
  return out;
}
