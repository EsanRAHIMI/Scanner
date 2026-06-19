import type { Metadata } from 'next';

import './globals.css';
import { AppShell } from './shell';

export const metadata: Metadata = {
  title: 'Lorenzo Proposals',
  description: 'Lorenzo Home — sales proposal builder',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
