import { Suspense } from 'react';

import { TasksView } from '@/components/os/tasks-view';
import { PageSkeleton } from '@/components/os/ui';

export default function TasksPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TasksView />
    </Suspense>
  );
}
