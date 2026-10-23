export const GOOGLE_SETUP_PARAM = 'google_setup';
export const GOOGLE_SETUP_KEY = 'connections-google-setup';
const GOOGLE_SETUP_MAX_AGE = 30 * 60 * 1000;

/** Same-window enable flow. Google sends the browser back to Connections after Enable. */
export function googleEnableUrl(href: string, origin: string): string {
  const back = new URL('/connections', origin);
  back.searchParams.set(GOOGLE_SETUP_PARAM, '1');
  const url = new URL(href);
  url.searchParams.set('redirect', back.toString());
  return url.toString();
}

export function markGoogleSetup(storage: Pick<Storage, 'setItem'>, now = Date.now()) {
  storage.setItem(GOOGLE_SETUP_KEY, String(now));
}

/** True once, when this visit is the return from Enable. Clears the stored mark. */
export function takeGoogleSetup(storage: Pick<Storage, 'getItem' | 'removeItem'>, search: string, now = Date.now()): boolean {
  const fromQuery = new URLSearchParams(search).get(GOOGLE_SETUP_PARAM) === '1';
  const raw = storage.getItem(GOOGLE_SETUP_KEY);
  const at = raw == null || raw === '' ? Number.NaN : Number(raw);
  const fromStore = Number.isFinite(at) && now - at >= 0 && now - at < GOOGLE_SETUP_MAX_AGE;
  if (fromQuery || fromStore) storage.removeItem(GOOGLE_SETUP_KEY);
  return fromQuery || fromStore;
}
