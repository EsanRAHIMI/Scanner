import './globals.css';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

import { MarketingShell } from './marketing-shell';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: 'Lorenzo Marketing',
  description: 'Marketing dashboard — content calendar and campaigns',
  applicationName: 'Lorenzo Marketing',
  icons: {
    icon: `${basePath}/favicon.ico`,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh bg-brand-light-gray font-sans text-brand-black antialiased">
        <MarketingShell>{children}</MarketingShell>
      </body>
    </html>
  );
}
