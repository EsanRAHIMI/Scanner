import { Suspense } from 'react';

import { ProductsPageClient } from './products-page-client';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Stable shell SSR'd on the server; client tree with useSearchParams stays inside Suspense. */
export default function ProductsPage() {
  return (
    <div className="relative flex flex-1 w-full min-h-0 flex-col">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${basePath}/Brand_symbol_1.svg`}
          alt=""
          aria-hidden="true"
          className="absolute left-0 top-0 h-[122vh] w-auto -translate-x-[10vw] -translate-y-[10vh] select-none object-contain opacity-[0.07]"
        />
      </div>

      <Suspense
        fallback={
          <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label="Loading products" />
        }
      >
        <ProductsPageClient />
      </Suspense>
    </div>
  );
}
