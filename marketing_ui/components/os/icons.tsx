import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const Icon = {
  overview: (p: Props) => (
    <Base {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Base>
  ),
  content: (p: Props) => (
    <Base {...p}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4M7.5 13h3M7.5 17h6" />
    </Base>
  ),
  campaign: (p: Props) => (
    <Base {...p}>
      <path d="M3 10v4a1 1 0 001 1h2l5 4V5L6 9H4a1 1 0 00-1 1zM15 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" />
    </Base>
  ),
  paid: (p: Props) => (
    <Base {...p}>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </Base>
  ),
  initiative: (p: Props) => (
    <Base {...p}>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </Base>
  ),
  task: (p: Props) => (
    <Base {...p}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 12l3 3 5-6" />
    </Base>
  ),
  asset: (p: Props) => (
    <Base {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </Base>
  ),
  report: (p: Props) => (
    <Base {...p}>
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <path d="M14 3v6h6M8 17v-3M12 17v-6M16 17v-2" />
    </Base>
  ),
  budget: (p: Props) => (
    <Base {...p}>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 10h20M6 15h3" />
    </Base>
  ),
  target: (p: Props) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </Base>
  ),
  plug: (p: Props) => (
    <Base {...p}>
      <path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 01-12 0zM12 17v5" />
    </Base>
  ),
  sheet: (p: Props) => (
    <Base {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </Base>
  ),
  search: (p: Props) => (
    <Base {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Base>
  ),
  plus: (p: Props) => (
    <Base {...p}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  ),
  menu: (p: Props) => (
    <Base {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Base>
  ),
  chevronLeft: (p: Props) => (
    <Base {...p}>
      <path d="M15 18l-6-6 6-6" />
    </Base>
  ),
  chevronRight: (p: Props) => (
    <Base {...p}>
      <path d="M9 18l6-6-6-6" />
    </Base>
  ),
  external: (p: Props) => (
    <Base {...p}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
    </Base>
  ),
  refresh: (p: Props) => (
    <Base {...p}>
      <path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" />
    </Base>
  ),
  alert: (p: Props) => (
    <Base {...p}>
      <path d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    </Base>
  ),
  link: (p: Props) => (
    <Base {...p}>
      <path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" />
    </Base>
  ),
  copy: (p: Props) => (
    <Base {...p}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
    </Base>
  ),
  print: (p: Props) => (
    <Base {...p}>
      <path d="M6 9V3h12v6M6 18H4a1 1 0 01-1-1v-6a2 2 0 012-2h14a2 2 0 012 2v6a1 1 0 01-1 1h-2" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </Base>
  ),
  trash: (p: Props) => (
    <Base {...p}>
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 001 1h10a1 1 0 001-1l1-13M9 7V4h6v3" />
    </Base>
  ),
};

export type IconName = keyof typeof Icon;
