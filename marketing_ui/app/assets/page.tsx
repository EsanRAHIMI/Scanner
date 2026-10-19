import { Suspense } from 'react';

import { AssetsView } from '@/components/os/assets-view';
import { PageSkeleton } from '@/components/os/ui';

export default function AssetsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AssetsView />
    </Suspense>
  );
}
