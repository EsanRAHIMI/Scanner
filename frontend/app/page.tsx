import Link from 'next/link';

import { Button } from '@/ui/button';

export default function Home() {
  const trainerUrl =
    (process.env.NEXT_PUBLIC_TRAINER_URL && process.env.NEXT_PUBLIC_TRAINER_URL.trim()) ||
    (process.env.NODE_ENV === 'production' ? '/trainer' : 'http://localhost:3010/trainer');

  return (
    <main className="min-h-dvh bg-white text-black">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-6 py-14">
        <header className="space-y-3">
          <div className="text-xs tracking-[0.35em] text-black/60">LORENZO</div>
          <h1 className="text-3xl font-semibold leading-tight">AI Scanner</h1>
          <p className="text-sm leading-relaxed text-black/70">
            Mobile-first chandelier detection with fast frame capture and on-screen
            bounding boxes.
          </p>
        </header>

        <section className="space-y-3">
          <Button asChild className="w-full bg-black text-white hover:bg-black/90">
            <Link href="/scanner">Open Scanner</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={trainerUrl}>Trainer</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/status">Backend status</Link>
          </Button>
          <p className="text-xs text-black/50">
            For best results, allow camera access and use good lighting.
          </p>
        </section>

        <footer className="border-t border-black/10 pt-6 text-xs text-black/50">
          Lorenzo Chandelier Scanner
        </footer>
      </div>
    </main>
  );
}
