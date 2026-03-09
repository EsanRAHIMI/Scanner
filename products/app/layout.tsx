import './globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ProductsCacheProvider } from './products-cache-provider';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Products table',
  icons: {
    icon: `${basePath}/favicon.ico`,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh overflow-y-auto bg-white text-black">
        <ProductsCacheProvider>
          <div className="mx-auto flex min-h-dvh w-full max-w-none flex-col gap-4 box-border px-5 py-6">
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </div>
        </ProductsCacheProvider>
      </body>
    </html>
  );
}
