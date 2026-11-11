// SEO surfaces (Farelune fix, replicated): the locale home carries
// WebSite + Organization JSON-LD and a canonical link, /llms.txt is real
// text/plain, and a plain-http visitor is sent to https. The pure-function
// tests need no server; the route tests run against a live instance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE } from './helpers.mjs';
import { cloudflareScheme, canonicalHost } from '../lib/cloudflare.js';
import { safeJsonLd } from '../lib/jsonld.js';

test('cloudflareScheme reads the CF-Visitor header', () => {
  assert.equal(cloudflareScheme('{"scheme":"https"}'), 'https');
  assert.equal(cloudflareScheme('{"scheme":"http"}'), 'http');
  assert.equal(cloudflareScheme(null), null);
  assert.equal(cloudflareScheme(''), null);
  assert.equal(cloudflareScheme('not json'), null);
  assert.equal(cloudflareScheme('{"scheme":"ftp"}'), null);
  assert.equal(cloudflareScheme('{"scheme":123}'), null);
});

test('canonicalHost never emits an internal bind address', () => {
  const headers = (v) => ({ get: (name) => (name === 'x-forwarded-host' ? v : null) });
  // The forwarded host is trusted only when it IS the canonical host.
  assert.equal(canonicalHost(headers('kayayiti.app')), 'kayayiti.app');
  assert.equal(canonicalHost(headers('KayAyiti.App')), 'kayayiti.app');
  // Anything else — absent, localhost, the origin bind address, a
  // spoofed host — falls back to the hardcoded canonical host.
  assert.equal(canonicalHost(headers(null)), 'kayayiti.app');
  assert.equal(canonicalHost(headers('')), 'kayayiti.app');
  assert.equal(canonicalHost(headers('localhost:3000')), 'kayayiti.app');
  assert.equal(canonicalHost(headers('0.0.0.0:3000')), 'kayayiti.app');
  assert.equal(canonicalHost(headers('127.0.0.1:3000')), 'kayayiti.app');
  assert.equal(canonicalHost(headers('evil.example.com')), 'kayayiti.app');
});

test('safeJsonLd escapes < so a value cannot close the script tag', () => {
  const out = safeJsonLd({ a: '</script><script>alert(1)</script>' });
  assert.doesNotMatch(out, /<\/script>/);
  assert.match(out, /\\u003c\/script>/);
  assert.deepEqual(JSON.parse(out), { a: '</script><script>alert(1)</script>' });
});

const home = (locale) =>
  fetch(`${BASE}/${locale}`).then(async (r) => ({ status: r.status, html: await r.text() }));

function jsonLd(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'a JSON-LD block is present');
  return JSON.parse(m[1]);
}

for (const locale of ['ht', 'fr', 'en']) {
  test(`/${locale} home carries WebSite + Organization JSON-LD in ${locale}`, async () => {
    const { status, html } = await home(locale);
    assert.equal(status, 200);
    const graph = jsonLd(html);
    const nodes = graph['@graph'] || [];
    const types = nodes.map((n) => n['@type']);
    assert.ok(types.includes('WebSite'), 'WebSite node present');
    assert.ok(types.includes('Organization'), 'Organization node present');
    const org = nodes.find((n) => n['@type'] === 'Organization');
    assert.equal(org.inLanguage, locale);
    assert.equal(org.name, 'Kay Ayiti');
    assert.ok(!nodes.some((n) => 'sameAs' in n), 'no social profile is claimed');
  });

  test(`/${locale} home has a canonical link`, async () => {
    const { html } = await home(locale);
    assert.ok(
      html.includes(`<link rel="canonical" href="https://kayayiti.app/${locale}"`),
      'canonical points at the locale home',
    );
  });
}

test('/llms.txt is real text/plain, not the home page', async () => {
  const res = await fetch(`${BASE}/llms.txt`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/plain/);
  const txt = await res.text();
  assert.match(txt, /^# Kay Ayiti/m);
  assert.match(txt, /\/ht\/listings/);
  assert.match(txt, /\/fr\/advertise/);
  assert.match(txt, /\/en\/shop/);
  assert.match(txt, /sitemap\.xml/);
  assert.doesNotMatch(txt, /<!DOCTYPE html|<html/i, 'not the home page HTML');
});

test('a plain-http visitor (CF-Visitor) is redirected to https', async () => {
  const res = await fetch(`${BASE}/ht`, {
    headers: { 'cf-visitor': '{"scheme":"http"}' },
    redirect: 'manual',
  });
  assert.equal(res.status, 308);
  const loc = res.headers.get('location') || '';
  // Regression (PR #117 shipped it): the Location host must be the
  // public host. The origin binds 0.0.0.0:3000, so a redirect built from
  // the request URL lands the browser on a dead https://0.0.0.0:3000.
  assert.equal(loc, 'https://kayayiti.app/ht');
});

for (const forwarded of ['kayayiti.app', '0.0.0.0:3000', 'localhost:3000', 'evil.example.com']) {
  test(`redirect host stays kayayiti.app with x-forwarded-host: ${forwarded}`, async () => {
    const res = await fetch(`${BASE}/ht`, {
      headers: { 'cf-visitor': '{"scheme":"http"}', 'x-forwarded-host': forwarded },
      redirect: 'manual',
    });
    assert.equal(res.status, 308);
    assert.equal(res.headers.get('location'), 'https://kayayiti.app/ht');
  });
}

test('the root page carries the ht homepage JSON-LD + canonical', async () => {
  const res = await fetch(`${BASE}/`, { redirect: 'manual' });
  assert.equal(res.status, 200);
  const html = await res.text();
  const graph = jsonLd(html);
  const nodes = graph['@graph'] || [];
  const types = nodes.map((n) => n['@type']);
  assert.ok(types.includes('WebSite'), 'WebSite node present');
  assert.ok(types.includes('Organization'), 'Organization node present');
  const org = nodes.find((n) => n['@type'] === 'Organization');
  assert.equal(org.inLanguage, 'ht');
  assert.equal(org.name, 'Kay Ayiti');
  assert.ok(!nodes.some((n) => 'sameAs' in n), 'no social profile is claimed');
  assert.ok(
    html.includes('<link rel="canonical" href="https://kayayiti.app/ht"'),
    'root canonical points at the ht homepage',
  );
});

test('the root landing (saved ht locale) shows the free-forever message', async () => {
  const res = await fetch(`${BASE}/`, { headers: { Cookie: 'kay_locale=ht' } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('Kay Ayiti gratis nèt pou tout moun, pou tout tan.'));
});

test('an https visitor is not redirected', async () => {
  const res = await fetch(`${BASE}/ht`, {
    headers: { 'cf-visitor': '{"scheme":"https"}' },
    redirect: 'manual',
  });
  assert.equal(res.status, 200);
});

test('no Cloudflare headers means no redirect (local dev / direct origin)', async () => {
  const res = await fetch(`${BASE}/ht`, { redirect: 'manual' });
  assert.equal(res.status, 200);
});
