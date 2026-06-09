import type { ReactNode } from 'react';

export type BrandHeaderProps = {
  /** Primary line next to the logo (e.g. Trainer, Dashboard) */
  appName: string;
  /** Secondary line under app name */
  tagline?: string;
  /** Smaller logo — mobile nav / compact surfaces */
  compact?: boolean;
  /** Optional trailing content (badges, actions) */
  trailing?: ReactNode;
  className?: string;
};

/**
 * Lorenzo brand lockup — logo wordmark + app title.
 * Matches the frontend hub header (dashboard-home) for cross-app consistency.
 */
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
        src="/Lorenzo_Logo1.png"
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

/** Centered brand for auth screens */
export function BrandHeaderAuth({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Lorenzo_Logo1.png"
        alt="Lorenzo"
        width={168}
        height={56}
        className="h-10 w-auto max-w-[8rem] object-contain"
      />
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-brand-black">{title}</h1>
      {description ? <p className="mt-1.5 text-sm text-brand-dark-gray">{description}</p> : null}
    </div>
  );
}
