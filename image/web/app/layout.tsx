import './globals.css';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import Script from 'next/script';

import { ImageShell } from './image-shell';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// Global Lorenzo AI / navigation widget (served by the agent service).
const agentWidgetSrc =
  (process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:8040').replace(/\/+$/, '') +
  '/static/widget.js';

export const metadata: Metadata = {
  title: 'Lorenzo Image',
  description: 'Image import, processing, and output management',
  applicationName: 'Lorenzo Image',
  icons: {
    icon: '/favicon.ico',
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
        <ImageShell>{children}</ImageShell>
        <Script src={agentWidgetSrc} strategy="afterInteractive" />
      </body>
    </html>
  );
}
