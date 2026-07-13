/** Public URL prefix when the app is hosted under a subpath (e.g. `/products`). */
export function getPwaBasePath(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  if (!raw || raw === '/') return '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export function withBasePath(path: string): string {
  const base = getPwaBasePath();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}
