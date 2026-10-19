import { Suspense } from 'react';

import { InitiativesView } from '@/components/os/initiatives-view';
import { PageSkeleton } from '@/components/os/ui';

export default function InitiativesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InitiativesView />
    </Suspense>
  );
}
