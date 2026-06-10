import type { ReactNode } from 'react';

export default function OutputsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 -my-4 flex min-h-full flex-1 flex-col bg-brand-white px-4 py-4 sm:-mx-6 sm:-my-6 sm:px-6 sm:py-6 lg:-mx-8 lg:-my-6 lg:px-8">
      {children}
    </div>
  );
}
