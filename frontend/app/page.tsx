import { headers } from 'next/headers';
import type { Metadata } from 'next';

import { DashboardHome } from '@/components/dashboard-home';
import { LOCAL_APP_URLS, isLocalHostname, resolveAppUrls } from '@/lib/app-urls';

export const metadata: Metadata = {
  title: { absolute: 'Dashboard' },
};

export default async function Home() {
  const h = await headers();
  const host = h.get('host');
  const hostname = host?.split(':')[0] ?? 'localhost';
  const proto = h.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const origin = host ? `${proto}://${host}` : undefined;
  const isLocal = isLocalHostname(hostname);
  const urls = isLocal ? LOCAL_APP_URLS : resolveAppUrls(origin);

  return <DashboardHome urls={urls} isLocal={isLocal} />;
}
