// The landing page's top-right button, and the avatar the tab bar uses.
//
// The landing page is server-rendered, so what it offers a signed-in
// visitor is directly testable — which is the bug this pins down: it used
// to offer "Konekte" (sign in) to somebody who was already signed in,
// sending them to a sign-in form for the account they were using.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, client, signup, uniq, sha } from './helpers.mjs';

const run = uniq();
const U = { name: 'Land Tenant', username: `lnd_${run}`, password: 'pw-l', role: 'tenant' };
const as = client();
let sessionCookie = '';

// The landing page needs kay_locale, or it shows the first-visit splash
// instead. Fetched raw so the cookies sent are exactly what is under test.
const landing = (extra = '') =>
  fetch(BASE, { headers: { Cookie: `kay_locale=ht${extra}` }, redirect: 'manual' }).then(async (r) => ({
    status: r.status,
    html: await r.text(),
  }));

before(async () => {
  assert.equal((await signup(as, U)).status, 200);
  // Sign in with a raw fetch so the session cookie can be read off the
  // response and replayed on the landing request.
  const res = await fetch(`${BASE}/api/accounts/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: U.username, passwordHash: sha(U.password) }),
  });
  assert.equal(res.status, 200);
  const set = res.headers.getSetCookie?.() || [];
  const session = set.map((c) => c.split(';')[0]).find((c) => c.startsWith('kay_session='));
  assert.ok(session, 'got a session cookie');
  sessionCookie = session;
});

test('signed out, the landing page offers Konekte', async () => {
  const { status, html } = await landing();
  assert.equal(status, 200);
  assert.ok(html.includes('href="/ht/signin"'), 'links to sign in');
  assert.ok(!html.includes('href="/ht/account"'), 'does not offer the account page');
});

test('signed in, the landing page offers Kont instead', async () => {
  const { status, html } = await landing(`; ${sessionCookie}`);
  assert.equal(status, 200);
  assert.ok(html.includes('href="/ht/account"'), 'links to the account page');
  assert.ok(!html.includes('href="/ht/signin"'), 'no longer offers a sign-in form');
  // And it says Kont, not Konekte.
  assert.ok(html.includes('>Kont<'), 'labelled Kont');
});

test('a dead session falls back to Konekte rather than a broken account link', async () => {
  // A cookie that looks right but is not a live session must not be
  // treated as signed in.
  const { html } = await landing('; kay_session=deadbeefdeadbeefdeadbeefdeadbeef');
  assert.ok(html.includes('href="/ht/signin"'), 'back to sign in');
  assert.ok(!html.includes('href="/ht/account"'));
});

test('the presence reply carries the avatar for the tab bar', async () => {
  // This is how the tab bar learns the photo without any page paying for
  // an extra request: the account row is already loaded for presence.
  const p = await as('/api/presence', { method: 'POST', body: { visitor: `v-${run}` } });
  assert.equal(p.status, 200);
  assert.equal(p.data.signedIn, true);
  assert.equal(p.data.username, U.username);
  assert.ok('avatarUrl' in p.data, 'avatarUrl is part of the reply');
  assert.equal(p.data.avatarUrl, null, 'null until a photo is set');

  // Set one, and presence reports it.
  const JPEG = Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
    'HBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDc0NP/bAEMBCQkJDAsMGA0NGDIhHCEyMjIyMjIy' +
    'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEB' +
    'AxEB/8QAFAABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAA' +
    'AAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJQA/9k=',
    'base64',
  );
  const form = new FormData();
  form.append('file', new Blob([JPEG], { type: 'image/jpeg' }), 'face.jpg');
  const up = await as('/api/accounts/avatar', { method: 'POST', form });
  assert.equal(up.status, 200);
  const after = await as('/api/presence', { method: 'POST', body: { visitor: `v-${run}` } });
  assert.equal(after.data.avatarUrl, up.data.account.avatarUrl, 'presence now reports the photo');
  assert.ok(after.data.avatarUrl.startsWith('/uploads/'));

  // Signed out, there is nothing to report.
  const anon = client();
  const out = await anon('/api/presence', { method: 'POST', body: { visitor: `v-anon-${run}` } });
  assert.equal(out.data.signedIn, false);
  assert.equal(out.data.avatarUrl, null);
});
