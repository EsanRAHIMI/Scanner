import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';
import { AppShell } from './shell';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Lorenzo Proposals',
  description: 'Lorenzo Home — sales proposal builder',
  applicationName: 'Lorenzo Proposals',
  icons: {
    icon: '/Lorenzo_Logo1.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh bg-brand-light-gray font-sans text-brand-black antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
