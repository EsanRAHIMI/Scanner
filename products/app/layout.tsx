import './globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ProductsCacheProvider } from './products-cache-provider';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Products table',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="h-dvh overflow-hidden bg-white text-black">
        <ProductsCacheProvider>
          <div className="mx-auto flex h-dvh w-full max-w-none flex-col gap-4 box-border px-5 py-6">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
          </div>
        </ProductsCacheProvider>
      </body>
    </html>
  );
}
