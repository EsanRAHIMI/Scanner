'use client';

import * as React from 'react';

interface FilterDropdownProps {
  id: string;
  title: string;
  options: string[];
  selected: Set<string>;
  activeDropdown: string | null;
  setActiveDropdown: (id: string | null) => void;
  onChange: (val: Set<string>) => void;
}

export function FilterDropdown({
  id,
  title,
  options,
  selected,
  activeDropdown,
  setActiveDropdown,
  onChange,
}: FilterDropdownProps) {
  const [search, setSearch] = React.useState('');
  const isOpen = activeDropdown === id;
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [panelStyle, setPanelStyle] = React.useState<React.CSSProperties>({});

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
      setSearch('');
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setActiveDropdown]);

  React.useEffect(() => {
    if (!isOpen || !buttonRef.current) {
      setPanelStyle({});
      return;
    }

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const margin = 12;
      const panelWidth = Math.min(280, window.innerWidth - margin * 2);
      const isNarrow = window.innerWidth < 640;

      if (isNarrow) {
        const left = Math.max(margin, Math.min(rect.left, window.innerWidth - panelWidth - margin));
        setPanelStyle({
          position: 'fixed',
          top: rect.bottom + 6,
          left,
          width: panelWidth,
          zIndex: 120,
        });
        return;
      }

      setPanelStyle({});
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleOption = (opt: string) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(next);
  };

  const clear = () => {
    onChange(new Set());
  };

  const isActive = selected.size > 0;

  return (
    <div className="relative min-w-0 w-full sm:w-auto" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setActiveDropdown(isOpen ? null : id)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={
          'flex h-9 w-full min-w-0 items-center justify-center gap-1 rounded-lg border px-2 text-[10px] font-semibold uppercase tracking-wide transition-all sm:h-7 sm:w-auto sm:justify-start sm:gap-1.5 sm:rounded-md sm:px-2.5 sm:py-0 sm:text-[10px] ' +
          (isActive
            ? 'border-emerald-500/45 bg-emerald-500/12 text-emerald-800 shadow-sm dark:border-emerald-400/50 dark:bg-emerald-400/12 dark:text-emerald-200'
            : 'border-black/10 bg-white/80 text-black/55 hover:bg-black/[0.04] dark:border-white/12 dark:bg-white/[0.06] dark:text-white/55 dark:hover:bg-white/10')
        }
      >
        <span className="truncate">{title}</span>
        {isActive ? (
          <span className="flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-bold leading-none text-white">
            {selected.size}
          </span>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-3 w-3 shrink-0 opacity-40"
            stroke="currentColor"
            strokeWidth="3"
            aria-hidden
          >
            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {isOpen ? (
        <div
          className={
            'rounded-xl border border-black/10 bg-white p-2 shadow-xl dark:border-white/20 dark:bg-zinc-950 dark:shadow-black/50 ' +
            (panelStyle.position === 'fixed'
              ? ''
              : 'absolute left-0 top-full z-[110] mt-1 w-[min(100vw-2.5rem,280px)] sm:w-[220px]')
          }
          style={panelStyle.position === 'fixed' ? panelStyle : undefined}
          role="listbox"
          aria-label={`${title} filter options`}
        >
          <div className="mb-2">
            <input
              autoFocus
              className="w-full rounded-lg border border-black/10 bg-black/[0.03] px-2.5 py-2 text-sm outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-white/5 sm:text-[11px] sm:py-1"
              placeholder={`Search ${title}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="scrollbar-minimal max-h-[min(50vh,220px)] overflow-y-auto pr-0.5 sm:max-h-[220px]">
            {filteredOptions.length === 0 ? (
              <div className="py-3 text-center text-[11px] text-black/40 dark:text-white/40">
                No options found
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 cursor-pointer rounded border-black/20 accent-emerald-600 dark:border-white/25"
                    checked={selected.has(opt)}
                    onChange={() => toggleOption(opt)}
                  />
                  <span className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-black/85 dark:text-white/85 sm:text-[11px]">
                    {opt}
                  </span>
                </label>
              ))
            )}
          </div>
          {selected.size > 0 ? (
            <div className="mt-2 border-t border-black/5 pt-2 dark:border-white/10">
              <button
                type="button"
                onClick={clear}
                className="w-full rounded-lg py-2 text-[11px] font-bold uppercase tracking-tight text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                Clear selection
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
