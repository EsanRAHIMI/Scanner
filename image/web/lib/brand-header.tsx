import type { ReactNode } from 'react';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export type BrandHeaderProps = {
  appName: string;
  tagline?: string;
  compact?: boolean;
  trailing?: ReactNode;
  className?: string;
};

export function BrandHeader({
  appName,
  tagline,
  compact = false,
  trailing,
  className = '',
}: BrandHeaderProps) {
  return (
    <div className={`flex min-w-0 items-center gap-3 sm:gap-4 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${basePath}/Lorenzo_Logo1.png`}
        alt="Lorenzo"
        width={168}
        height={56}
        className={
          compact
            ? 'h-8 w-auto max-h-9 max-w-[5.75rem] shrink-0 object-contain object-left sm:h-9 sm:max-w-[6.75rem]'
            : 'h-9 w-auto max-h-12 max-w-[6.75rem] shrink-0 object-contain object-left sm:h-10 sm:max-w-[8rem] md:h-12 md:max-w-[9.5rem]'
        }
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight text-brand-black">{appName}</p>
        {tagline ? (
          <p className="truncate text-xs leading-tight text-brand-dark-gray">{tagline}</p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
