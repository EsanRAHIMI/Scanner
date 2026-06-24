/* Minimal service worker — installability only. Pure network passthrough, no caching.
 *
 * IMPORTANT: API and cross-origin requests bypass the SW entirely so they behave
 * exactly like a direct request (this avoids intercepting paginated/cursor API
 * calls such as /api/products/assets). For requests it does handle, failures are
 * resolved gracefully so they never surface as an uncaught promise rejection.
 */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  // Never intercept cross-origin requests.
  if (url.origin !== self.location.origin) return;

  // Never intercept API requests — they must behave like a direct request
  // (covers /api/... and any base-path-prefixed /.../api/...).
  if (url.pathname.includes('/api/')) return;

  // Network passthrough; resolve (not reject) on failure so the FetchEvent never
  // produces an uncaught "Failed to fetch" rejection.
  event.respondWith(fetch(req).catch(() => Response.error()));
});
