import Link from 'next/link';
import { headers } from 'next/headers';

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

function isLocalHost(host: string | null) {
  if (!host) return true;
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

export default async function StatusPage() {
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const origin = host ? `${proto}://${host}` : 'http://localhost:3003';

  const local = isLocalHost(host);

  const backendBase = local ? 'http://localhost:8000' : `${origin}/api`;
  const trainerBase = local ? 'http://localhost:8010' : `${origin}/trainer/api`;

  const backendHealthUrl = `${backendBase}/health`;
  const trainerHealthUrl = `${trainerBase}/health`;

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
              <CardDescription>{local ? 'http://localhost:8000' : '/api'}</CardDescription>
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
                  {local ? backendHealthUrl : '/api/health'}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`${backendBase}/docs`} target="_blank">
                  {local ? `${backendBase}/docs` : '/api/docs'}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`${backendBase}/openapi.json`} target="_blank">
                  {local ? `${backendBase}/openapi.json` : '/api/openapi.json'}
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-black/10">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Trainer Server API</CardTitle>
              <CardDescription>{local ? 'http://localhost:8010' : '/trainer/api'}</CardDescription>
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
                  {local ? trainerHealthUrl : '/trainer/api/health'}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`${trainerBase}/docs`} target="_blank">
                  {local ? `${trainerBase}/docs` : '/trainer/api/docs'}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`${trainerBase}/openapi.json`} target="_blank">
                  {local ? `${trainerBase}/openapi.json` : '/trainer/api/openapi.json'}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </section>

        <footer className="border-t border-black/10 pt-6">
          <Button asChild variant="outline">
            <Link href="/">Back</Link>
          </Button>
        </footer>
      </div>
    </main>
  );
}
