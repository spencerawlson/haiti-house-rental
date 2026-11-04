// Phase 14a — the service worker, its offline fallback page, and the web
// app manifest are actually served, and the worker is served UNcached so a
// fix can propagate (a service worker pinned behind a long cache is how you
// brick a site). Runs against a live instance; no account needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE } from './helpers.mjs';

test('/sw.js is served as uncached javascript', async () => {
  const res = await fetch(`${BASE}/sw.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /javascript/i);
  const cache = res.headers.get('cache-control') || '';
  assert.match(cache, /no-cache|no-store|max-age=0/i, `sw.js must not be cached long: "${cache}"`);
  assert.doesNotMatch(cache, /immutable/i, 'sw.js must never be immutable');
});

test('/offline.html is a self-contained fallback page', async () => {
  const res = await fetch(`${BASE}/offline.html`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Koneksyon entènèt la koupe/, 'carries the Kreyòl offline message');
});

test('the web manifest is complete enough to install', async () => {
  const res = await fetch(`${BASE}/manifest.webmanifest`);
  assert.equal(res.status, 200);
  const m = JSON.parse(await res.text());
  assert.ok(m.name, 'has a name');
  assert.equal(m.display, 'standalone', 'installs as a standalone app');
  assert.ok(m.start_url, 'has a start_url');
  assert.ok(Array.isArray(m.icons) && m.icons.length > 0, 'has icons');
  assert.ok(m.icons.some((i) => /512/.test(i.sizes || '')), 'has a 512px icon');
});

// Every icon the manifest and the worker name must exist: one missing
// precache entry (icon-192, Oct 29 – Nov 4 2026) made cache.addAll reject,
// so the service worker never installed and the app was not installable.
test('manifest icons and every service-worker precache entry are served', async () => {
  const m = JSON.parse(await (await fetch(`${BASE}/manifest.webmanifest`)).text());
  const sw = await (await fetch(`${BASE}/sw.js`)).text();
  const precache = JSON.parse(
    sw.match(/const PRECACHE = (\[[^\]]*\])/)[1].replace(/'/g, '"').replace('OFFLINE_URL', '"/offline.html"'),
  );
  for (const src of [...m.icons.map((i) => i.src), ...precache]) {
    const res = await fetch(`${BASE}${src}`);
    assert.equal(res.status, 200, `${src} must be served`);
  }
});

test('robots.txt and sitemap.xml are real files, not the home page', async () => {
  const robots = await fetch(`${BASE}/robots.txt`);
  assert.match(robots.headers.get('content-type') || '', /text\/plain/);
  const rt = await robots.text();
  assert.match(rt, /Disallow: \/api\//);
  assert.match(rt, /Sitemap: /);
  const sm = await fetch(`${BASE}/sitemap.xml`);
  assert.match(sm.headers.get('content-type') || '', /xml/);
  const xml = await sm.text();
  assert.match(xml, /<urlset/);
  assert.match(xml, /\/ht\/listings<\/loc>/);
  assert.doesNotMatch(xml, /\/shop/, 'the hidden Shop is not advertised');
});
