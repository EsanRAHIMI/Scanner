import { Suspense } from 'react';

import { CampaignsView } from '@/components/os/campaigns-view';
import { PageSkeleton } from '@/components/os/ui';

export default function CampaignsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CampaignsView />
    </Suspense>
  );
}
