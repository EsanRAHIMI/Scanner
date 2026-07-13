'use client';

import type { ReactNode } from 'react';

import { ImageNavbar } from './image-navbar';

export function ImageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <ImageNavbar />
      <main className="app-main flex-1">
        <div className="app-main-inner">{children}</div>
      </main>
    </div>
  );
}
