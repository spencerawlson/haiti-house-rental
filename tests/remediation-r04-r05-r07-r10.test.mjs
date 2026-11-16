// Remediation R-04 / R-05 / R-07 / R-10 (2026-11-16 test-analysis plan).
// Cookie consent banner, real 404s (unknown paths, /.env, /.git/*),
// compressed landing images with alt text, and a real favicon.
// The disk checks need no server; the route checks run against a live
// instance, like the rest of the suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { BASE } from './helpers.mjs';

const IMAGES = new URL('../public/images/', import.meta.url);

// Landing page with a saved language (without the cookie the first-visit
// splash renders instead — same pattern as tests/landing.test.mjs).
const landing = () =>
  fetch(BASE, { headers: { Cookie: 'kay_locale=ht' } }).then(async (r) => ({
    status: r.status,
    html: await r.text(),
  }));

function imgs(html) {
  return [...html.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
}

test('R-07: landing images are WebP and under target size', () => {
  const house = statSync(new URL('landing-house.webp', IMAGES));
  const mountain = statSync(new URL('landing-mountain.webp', IMAGES));
  assert.ok(house.size < 300 * 1024, `og image ${house.size} B, target < 300 KB`);
  assert.ok(mountain.size < 500 * 1024, `hero image ${mountain.size} B, target < 500 KB`);
  // The oversized JPEGs are gone, not just unreferenced.
  assert.equal(existsSync(new URL('landing-house.jpg', IMAGES)), false);
  assert.equal(existsSync(new URL('landing-mountain.jpg', IMAGES)), false);
  // Still the same pictures (1920x1280), not a re-crop.
  assert.equal(readFileSync(new URL('landing-house.webp', IMAGES)).subarray(0, 4).toString('latin1'), 'RIFF');
});

test('R-10: a real favicon.ico ships (ICO magic, not the app shell)', () => {
  const fav = readFileSync(new URL('../public/favicon.ico', import.meta.url));
  assert.deepEqual([...fav.subarray(0, 4)], [0x00, 0x00, 0x01, 0x00]);
  assert.ok(fav.length > 1000, 'multi-size icon, not a stub');
});

test('R-05: unknown paths return a real 404, not the app shell', async () => {
  for (const p of ['/this-page-does-not-exist-12345', '/ht/this-page-does-not-exist-12345']) {
    const r = await fetch(`${BASE}${p}`, { redirect: 'manual' });
    assert.equal(r.status, 404, `${p} -> ${r.status}`);
  }
});

test('R-05: /.env and /.git/* return 404 with no env content', async () => {
  for (const p of ['/.env', '/.env.local', '/.git/config', '/.git/HEAD']) {
    const r = await fetch(`${BASE}${p}`, { redirect: 'manual' });
    const body = await r.text();
    assert.equal(r.status, 404, `${p} -> ${r.status}`);
    assert.doesNotMatch(body, /NEXT_|DATABASE_URL|ADMIN_PASSWORD/);
  }
});

test('R-05: the 404 page says so and links home', async () => {
  const r = await fetch(`${BASE}/this-page-does-not-exist-12345`);
  const html = await r.text();
  assert.match(html, /404/);
  // The home link is there; in the raw flight payload it arrives as
  // JSON (\"href\":\"/ht\"), in a browser document as href="/ht" — so
  // assert on the button text, which reads the same in both forms.
  assert.ok(html.includes('Ale nan paj dakèy la'), 'links back to the ht home');
  assert.ok(html.includes('/ht'), 'home link target present');
});

test('R-10: /favicon.ico serves an image, and the HTML links it', async () => {
  const r = await fetch(`${BASE}/favicon.ico`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /^image\//);
  const { html } = await landing();
  assert.match(html, /<link rel="icon"[^>]*href="\/favicon\.ico"/);
});

test('R-07: the landing og image is the compressed WebP', async () => {
  const { html } = await landing();
  const og = (html.match(/<meta property="og:image" content="([^"]*)"/) || [])[1];
  assert.ok(og && og.endsWith('/images/landing-house.webp'), `og:image is ${og}`);
  const r = await fetch(`${BASE}/images/landing-house.webp`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/webp');
  assert.ok(Number(r.headers.get('content-length')) < 300 * 1024);
  const m = await fetch(`${BASE}/images/landing-mountain.webp`);
  assert.equal(m.status, 200);
  assert.equal(m.headers.get('content-type'), 'image/webp');
  assert.ok(Number(m.headers.get('content-length')) < 500 * 1024);
  // The deleted JPEGs 404 instead of silently serving something else.
  assert.equal((await fetch(`${BASE}/images/landing-house.jpg`)).status, 404);
});

test('R-07: every image on the landing page carries a non-empty alt', async () => {
  const { html } = await landing();
  const tags = imgs(html);
  assert.ok(tags.length > 0, 'the landing page has images');
  for (const tag of tags) {
    const alt = (tag.match(/alt="([^"]*)"/) || [])[1];
    assert.ok(alt !== undefined && alt.trim().length > 0, `img without a useful alt: ${tag}`);
  }
  assert.match(html, /Mòn vèt Ayiti/);
});

test('R-04: the cookie consent banner is in the served HTML', async () => {
  const { html } = await landing();
  assert.ok(html.includes('id="cookie-consent"'), 'banner marker present');
  assert.match(html, /cookie/i);
  assert.ok(html.includes('/ht/privacy'), 'banner links the privacy page');
  assert.match(html, /Aksepte tout|Refize|Preferans/);
});
