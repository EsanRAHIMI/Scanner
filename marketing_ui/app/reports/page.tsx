import { Suspense } from 'react';

import { ReportView } from '@/components/os/report-view';
import { PageSkeleton } from '@/components/os/ui';

export default function ReportsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportView />
    </Suspense>
  );
}
