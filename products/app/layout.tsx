import './globals.css';

import type { Metadata, Viewport } from 'next';
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="h-dvh overflow-hidden bg-white text-black dark:bg-black dark:text-white">
        <ProductsCacheProvider>
          <div className="mx-auto flex h-dvh w-full max-w-none flex-col gap-4 box-border px-5 py-6">
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </div>
        </ProductsCacheProvider>
      </body>
    </html>
  );
}
