/* Kay Ayiti service worker — Phase 14a (app shell + offline fallback).
 *
 * Scope is the whole origin (served from /sw.js). It is deliberately
 * minimal: it precaches a self-contained offline page and the logo, and it
 * only touches *navigations* — a page the browser loads fresh (address
 * bar, cold app open, refresh). When that navigation can't reach the
 * network it serves the offline page instead of a dead white screen.
 *
 * It does NOT cache real listings, photos, API data or _next assets yet —
 * that is Phase 14b. Keeping the fetch handler to navigations only means a
 * stale cache entry can never hide a changed listing, price or balance.
 *
 * Updating: bump CACHE_VERSION; old caches are deleted on activate. /sw.js
 * is served no-cache (next.config.js), so a new worker is noticed on the
 * next visit, and the page shows a small "update ready" prompt rather than
 * swapping the worker in under the user.
 */
const CACHE_VERSION = 'v1';
const CACHE = `kay-shell-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/logo.png', '/icons/icon-192.webp'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Only fresh navigations. Everything else — API, _next, uploads, and the
// soft client-side navigations Next does after the first load — goes
// straight to the network, exactly as before this worker existed.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
  );
});

// The page asks the waiting worker to take over when the user taps the
// update prompt; without this an update waits until every tab is closed.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
