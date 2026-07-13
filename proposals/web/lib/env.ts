function trimBase(url: string): string {
  return url.replace(/\/+$/, '');
}

function appBaseDomain(): string {
  return (
    process.env.NEXT_PUBLIC_APP_BASE_DOMAIN?.trim() ||
    process.env.APP_BASE_DOMAIN?.trim() ||
    'lorenzohome.ae'
  );
}

/** Server-side base of the proposals FastAPI (the web app proxies to it). */
export function getProposalsApiBase(): string {
  const v = process.env.PROPOSALS_API_BASE?.trim();
  if (v) return trimBase(v);
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:8030';
  // In production compose/Dokploy the API runs next to the web app.
  return 'http://proposals-server:8030';
}

/** Server-side base of the trainer FastAPI (auth + shared platform API). */
export function getTrainerApiBase(): string {
  const v =
    process.env.TRAINER_API_BASE?.trim() ||
    process.env.NEXT_PUBLIC_TRAINER_API_BASE?.trim();
  if (v && !v.startsWith('/')) return trimBase(v);
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:8010';
  return trimBase(`https://trainer.${appBaseDomain()}/api`);
}

/** Trainer dashboard URL — used for the login redirect. */
export function getTrainerWebUrl(path = ''): string {
  const explicit = process.env.NEXT_PUBLIC_TRAINER_URL?.trim();
  const base =
    explicit ||
    (process.env.NODE_ENV !== 'production'
      ? 'http://localhost:3010'
      : `https://trainer.${appBaseDomain()}`);
  const p = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${trimBase(base)}${p}`;
}
