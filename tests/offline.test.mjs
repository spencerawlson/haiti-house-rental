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
