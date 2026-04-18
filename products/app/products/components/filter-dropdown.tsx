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

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  const toggleOption = (opt: string) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(next);
  };

  const clear = () => {
    onChange(new Set());
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setActiveDropdown(isOpen ? null : id)}
        className={`flex h-[24px] items-center gap-1.5 rounded border px-2.5 py-0 font-medium transition-all ${selected.size > 0
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/80'
            : 'border-black/10 bg-black/5 text-black/60 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10'
          }`}
      >
        <span className="text-[10px] uppercase tracking-wider">{title}</span>
        {selected.size > 0 ? (
          <span className="flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white">
            {selected.size}
          </span>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 opacity-40" stroke="currentColor" strokeWidth="3">
            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-[110] mt-1 w-[220px] rounded-lg border border-black/10 bg-white p-2 shadow-xl dark:border-white/20 dark:bg-black/90 dark:backdrop-blur-xl">
          <div className="mb-2">
            <input
              autoFocus
              className="w-full rounded border border-black/10 bg-black/5 px-2 py-1 text-[11px] outline-none dark:border-white/10 dark:bg-white/5"
              placeholder={`Search ${title}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="scrollbar-minimal max-h-[220px] overflow-y-auto pr-1">
            {filteredOptions.length === 0 ? (
              <div className="py-2 text-center text-[10px] italic text-black/40 dark:text-white/40">No options found</div>
            ) : (
              filteredOptions.map((opt) => (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 cursor-pointer rounded border-black/20 accent-emerald-600 dark:border-white/20"
                    checked={selected.has(opt)}
                    onChange={() => toggleOption(opt)}
                  />
                  <span className="truncate text-[11px] font-medium text-black/80 dark:text-white/80">{opt}</span>
                </label>
              ))
            )}
          </div>
          {selected.size > 0 && (
            <div className="mt-2 border-t border-black/5 pt-2 dark:border-white/5">
              <button
                type="button"
                onClick={clear}
                className="w-full rounded py-1 text-[10px] font-bold uppercase tracking-tight text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
