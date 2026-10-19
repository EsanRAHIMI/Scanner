import { Suspense } from 'react';

import { PaidMedia } from '@/components/os/live-dashboard';
import { PageSkeleton } from '@/components/os/ui';

export default function PaidMediaPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PaidMedia />
    </Suspense>
  );
}
