'use client';

import * as React from 'react';

export const ListScrollRootContext = React.createContext<HTMLElement | null>(null);

export function useListScrollRoot(): HTMLElement | null {
  return React.useContext(ListScrollRootContext);
}
