import Link from 'next/link';
import { headers } from 'next/headers';

import { LOCAL_APP_URLS, resolveAppUrls, isLocalHostname } from '@/lib/app-urls';
import { getPublicServiceUrl } from '@/lib/public-urls';
import { Button } from '@/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/ui/card';

async function check(url: string) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    return { ok: false, status: 0, body: msg };
  }
}

export default async function StatusPage() {
  const h = await headers();
  const host = h.get('host');
  const hostname = host?.split(':')[0] ?? 'localhost';
  const proto = h.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const origin = host ? `${proto}://${host}` : 'http://localhost:3003';

  const local = isLocalHostname(hostname);
  const urls = local ? LOCAL_APP_URLS : resolveAppUrls(origin);

  const backendHealthUrl = urls.backendHealth;
  const trainerHealthUrl = urls.trainerHealth;
  const backendDocsUrl = urls.apiDocs;
  const trainerDocsUrl = urls.trainerApiDocs;
  const trainerOpenApiUrl = local
    ? 'http://localhost:8010/openapi.json'
    : getPublicServiceUrl('trainer', '/api/openapi.json');

  const [backendHealth, trainerHealth] = await Promise.all([
    check(backendHealthUrl),
    check(trainerHealthUrl),
  ]);

  return (
    <main className="min-h-dvh bg-white text-black">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
        <header className="space-y-2">
          <div className="text-xs tracking-[0.35em] text-black/60">LORENZO</div>
          <h1 className="text-2xl font-semibold">Service Status</h1>
          <p className="text-sm text-black/70">
            Quick health checks and direct links to Backend + Trainer APIs.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-black/10">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Backend API</CardTitle>
              <CardDescription>{backendHealthUrl}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                Health:{' '}
                <span className={backendHealth.ok ? 'font-medium text-green-700' : 'font-medium text-red-700'}>
                  {backendHealth.ok ? 'OK' : 'ERROR'}
                </span>
                <span className="text-black/50"> (HTTP {backendHealth.status || '—'})</span>
              </div>
              <pre className="max-h-40 overflow-auto rounded-md bg-black/5 p-3 text-xs text-black/70">
                {backendHealth.body || '—'}
              </pre>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={backendHealthUrl} target="_blank">
                  Health
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={backendDocsUrl} target="_blank">
                  Docs
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-black/10">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Trainer Server API</CardTitle>
              <CardDescription>{trainerHealthUrl}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                Health:{' '}
                <span className={trainerHealth.ok ? 'font-medium text-green-700' : 'font-medium text-red-700'}>
                  {trainerHealth.ok ? 'OK' : 'ERROR'}
                </span>
                <span className="text-black/50"> (HTTP {trainerHealth.status || '—'})</span>
              </div>
              <pre className="max-h-40 overflow-auto rounded-md bg-black/5 p-3 text-xs text-black/70">
                {trainerHealth.body || '—'}
              </pre>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={trainerHealthUrl} target="_blank">
                  Health
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={trainerDocsUrl} target="_blank">
                  Docs
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={trainerOpenApiUrl} target="_blank">
                  OpenAPI
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </section>
      </div>
    </main>
  );
}
