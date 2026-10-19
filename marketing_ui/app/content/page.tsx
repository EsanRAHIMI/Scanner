import { Suspense } from 'react';

import { ContentPlanner } from '@/components/os/content-planner';
import { PageSkeleton } from '@/components/os/ui';

export default function ContentPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ContentPlanner />
    </Suspense>
  );
}
