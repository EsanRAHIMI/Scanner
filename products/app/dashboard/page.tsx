import { Metadata } from 'next';
import { DashboardView } from '@/app/dashboard/dashboard-view';

export const metadata: Metadata = {
  title: 'Admin Dashboard | Products',
  description: 'Manage products, backups, and view system statistics.',
};

export default function DashboardPage() {
  return <DashboardView />;
}
