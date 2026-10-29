/* Kay Ayiti service worker — Phase 14a + 14b.
 *
 * Scope is the whole origin (served from /sw.js).
 *
 * 14a (shell): precaches a self-contained offline page and serves it when a
 * fresh navigation can't reach the network.
 *
 * 14b (caching the things that cost data on Haitian mobile): adds runtime
 * caches so repeat visits transfer almost nothing and already-seen pages
 * open with no signal. Each strategy is chosen so a stale copy can never
 * mislead:
 *   - /_next/static/*  cache-first. The filenames are build-hashed, so a
 *     cached copy is byte-identical to the network one, forever.
 *   - /uploads/...?w=  cache-first, capped. Only the RESIZED photo
 *     thumbnails (the ?w= variants cards and galleries use), never the
 *     full-size originals, videos or voice notes — those would blow the
 *     cache. A resized URL always names the same bytes.
 *   - GET /api/listings (no query) stale-while-revalidate: the public feed
 *     shows instantly from cache and refreshes in the background. Only the
 *     bare feed — the owner/admin/viewer variants all carry a query string
 *     and go straight to the network, so no personalised data is cached.
 *   - navigations network-first: always fresh online; offline, the last
 *     good copy of THAT page, else the offline page. Pages that can carry
 *     signed-in content are never stored (PRIVATE_PAGE).
 * Everything else goes straight to the network, exactly as without a worker.
 *
 * Updating: bump VERSION; every old cache is dropped on activate. /sw.js is
 * served no-cache (next.config.js), so a new worker is noticed on the next
 * visit and the page shows a small "update ready" prompt rather than
 * swapping the worker in under the user.
 */
const VERSION = 'v2';
const SHELL = `kay-shell-${VERSION}`;
const STATIC = `kay-static-${VERSION}`;
const PHOTOS = `kay-photos-${VERSION}`;
const FEED = `kay-feed-${VERSION}`;
const PAGES = `kay-pages-${VERSION}`;
const KEEP = new Set([SHELL, STATIC, PHOTOS, FEED, PAGES]);

const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/logo.png', '/icons/icon-192.webp'];

const PHOTO_MAX = 60; // resized photos kept offline; oldest evicted past this
const PAGE_MAX = 30; // recently visited pages kept for offline viewing

// Pages that can render signed-in content server-side: never stored for
// offline replay (a shared phone must not show a cached private page).
const PRIVATE_PAGE = /\/(account|admin|admin-login|admin-chat|library|chats|payments|visits|signin|signup|tenant-signup|forgot-password)(\/|$|\?)/;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Drop the oldest entries once a cache grows past its cap. Cache.keys() is
// in insertion order, so the first entries are the oldest; re-fetching a hit
// does not re-insert it, so this is simple age-based (FIFO) eviction.
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(req, cacheName, cap) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) {
    await cache.put(req, res.clone());
    if (cap) trim(cacheName, cap);
  }
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await fresh) || Response.error();
}

async function navigate(req) {
  const url = new URL(req.url);
  const cacheable = !PRIVATE_PAGE.test(url.pathname + url.search);
  try {
    const res = await fetch(req);
    if (cacheable && res && res.ok) {
      const cache = await caches.open(PAGES);
      await cache.put(req, res.clone());
      trim(PAGES, PAGE_MAX);
    }
    return res;
  } catch {
    const cached = cacheable && (await caches.match(req, { cacheName: PAGES }));
    return cached || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(navigate(req));
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req, STATIC));
  } else if (url.pathname.startsWith('/uploads/') && url.searchParams.has('w')) {
    event.respondWith(cacheFirst(req, PHOTOS, PHOTO_MAX));
  } else if (url.pathname === '/api/listings' && url.search === '') {
    event.respondWith(staleWhileRevalidate(req, FEED));
  }
  // Everything else — API writes, admin, auth, uploads originals, videos,
  // voice notes, soft client-side navigations — is left to the network.
});

// The page asks the waiting worker to take over when the user taps the
// update prompt; without this an update waits until every tab is closed.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
