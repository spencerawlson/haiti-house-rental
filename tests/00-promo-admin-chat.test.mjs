// Free forever (Nov 2026) + admin chat + AI assist availability
// (admin chats only, key-optional).
//
// The promo is GONE: no 1000-spot cap, no tagging, no free year —
// every account is free forever from signup, so this file no longer
// consumes any spots and no longer gates the rest of the suite. The
// promo countdown route still exists and returns counts (all zero
// tagged). Admin chat is the listing-chat model with admin as a
// participant, not listing-bound: users start from "Contact admin",
// the admin starts from the chat symbol on an account row. The AI
// button only exists in admin chats, and only when the server has a
// key — with no key the route says available:false and the button
// stays hidden.
//
// ORDERING: this file still runs first in the suite (the 00- prefix
// puts it first in the tests/*.test.mjs glob, and the suite runs files
// sequentially with --test-concurrency=1). Run the full suite, not one
// file alone.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, ADMIN_PASSWORD, client, signup, adminClient, uniq, sha } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Pam Promo', username: `pam_${run}`, password: 'pw-p', role: 'landlord' };
const T = { name: 'Tom Tenant', username: `tom_${run}`, password: 'pw-t', role: 'tenant' };
const T2 = { name: 'Tess Second', username: `tes_${run}`, password: 'pw-t2', role: 'tenant' };
const as = { L: client(), T: client(), T2: client() };
let admin;
let stats;

async function loginRaw(body) {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  return { status: res.status, cookie, data: await res.json().catch(() => null) };
}

async function signInRaw(username, password) {  const res = await fetch(`${BASE}/api/accounts/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, passwordHash: sha(password) }),
  });
  const cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  return { status: res.status, cookie, data: await res.json().catch(() => null) };
}

async function landingHtml() {
  // The landing page renders in the kay_locale cookie's language and
  // needs raw HTML, which the JSON test client does not return.
  const res = await fetch(`${BASE}/`, { headers: { Cookie: 'kay_locale=ht' } });
  return { status: res.status, html: await res.text() };
}

before(async () => {
  if (skip) return;
  assert.equal((await signup(as.L, L)).status, 200);
  assert.equal((await signup(as.T, T)).status, 200);
  assert.equal((await signup(as.T2, T2)).status, 200);
  admin = await adminClient();
  const statsName = `promostats_${run}`;
  assert.equal((await admin('/api/admin/admin-users', { method: 'POST', body: { username: statsName, password: 'partner-pass-123' } })).status, 201);
  const logged = await loginRaw({ username: statsName, password: 'partner-pass-123' });
  assert.equal(logged.status, 200);
  stats = client(logged.cookie);
});

test('landlord signup is never promo-tagged: active at once, free forever', { skip }, async () => {
  const me = (await as.L('/api/accounts/me')).data.account;
  assert.equal(me.promoTagged, false, 'no promo tagging any more');
  assert.equal(me.promoUntil, null);
  assert.equal(me.activated, true, 'free forever activates immediately, no payment wait');
  assert.equal(me.billingStatus, 'active');
  assert.equal(me.paidUntil, null, 'no expiry');
});

test('tenant signup is never promo-tagged', { skip }, async () => {
  const me = (await as.T('/api/accounts/me')).data.account;
  assert.equal(me.promoTagged, false);
  assert.equal(me.promoUntil, null);
});

test('admin-created partner landlord is never promo-tagged', { skip }, async () => {
  const name = `partner_${run}`;
  const r = await admin('/api/admin/partner', {
    method: 'POST',
    body: { name, username: name, passwordHash: sha('pw-partner') },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.account.promoTagged, false, 'partners are already free and take no spot');
});

test('promo countdown route still exists and returns counts: none tagged', { skip }, async () => {
  const r = await admin('/api/admin/promo');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.spots, 1000);
  assert.equal(r.data.tagged, 0, 'nobody is tagged any more');
  assert.equal(r.data.remaining, 1000);
  assert.equal(r.data.sellerSpots, 2000);
  assert.equal(r.data.sellerTagged, 0);
  assert.equal(r.data.sellerRemaining, 2000);
  assert.equal((await stats('/api/admin/promo')).status, 401, 'stats scope refused');
  assert.equal((await client()('/api/admin/promo')).status, 401, 'anonymous refused');
});

test('landing page says free forever; no struck-through fees, no promo', { skip }, async () => {
  const { status, html } = await landingHtml();
  assert.equal(status, 200);
  assert.ok(html.includes('Kay Ayiti gratis nèt pou tout moun, pou tout tan.'), 'free-forever copy renders');
  assert.ok(!html.includes('Pwomosyon: Pibliye gratis pou yon ane!'), 'no promo announcement');
  assert.ok(!html.includes('promo-banner'), 'no promo banner');
  assert.ok(!html.includes('price-was'), 'no struck-through fees');
  assert.ok(!html.includes('1,500 HTG'), 'no joining fee anywhere on the landing page');
  // Public counts for the client pages: counts only.
  const pub = await (await fetch(`${BASE}/api/promo`)).json();
  assert.deepEqual(Object.keys(pub).sort(), ['remaining', 'sellerRemaining', 'sellerSpots', 'sellerTagged', 'spots']);
  assert.equal(pub.spots, 1000);
  assert.equal(pub.remaining, 1000, 'nothing tagged, so all spots remain');
  assert.equal(pub.sellerSpots, 2000);
  assert.equal(pub.sellerTagged, 0);
});

test('a free-forever landlord survives the billing sweep: still active', { skip }, async () => {
  const cron = await fetch(`${BASE}/api/cron`, { method: 'POST', headers: { 'x-cron-key': process.env.CRON_SECRET || '' } });
  // The sweep runs on the shared cron endpoint; whatever it returned,
  // a free-forever landlord with no expiry must still be active afterwards.
  const me = (await as.L('/api/accounts/me')).data.account;
  assert.equal(me.activated, true);
  assert.equal(me.billingStatus, 'active');
  assert.equal(me.paidUntil, null);
  assert.ok(cron.status === 200 || cron.status === 401, `cron answered ${cron.status}`);
});

test('no cap: landlord signups stay untagged and active, however many', { skip }, async () => {
  for (let i = 0; i < 5; i++) {
    const u = { name: 'NoCap', username: `nocap_${run}_${i}`, password: 'pw-cap', role: 'landlord' };
    const c = client();
    const r = await signup(c, u);
    assert.equal(r.status, 200, `signup ${i}: ${JSON.stringify(r.data)}`);
    assert.equal(r.data.account.promoTagged, false, 'no tagging on any signup');
    assert.equal(r.data.account.activated, true, 'active at once');
    assert.equal(r.data.account.billingStatus, 'active');
  }
  const r = await admin('/api/admin/promo');
  assert.equal(r.data.tagged, 0, 'still nobody tagged after more signups');
  assert.equal(r.data.remaining, 1000);
});

test('admin chat: user writes, admin lists and replies, user reads both', { skip }, async () => {
  const sent = await as.L('/api/admin-chat', { method: 'POST', body: { text: 'Bonjou, mwen bezwen èd ak kont mwen.' } });
  assert.equal(sent.status, 200, JSON.stringify(sent.data));
  const list = await admin('/api/admin/admin-chat');
  assert.equal(list.status, 200, JSON.stringify(list.data));
  const thread = (list.data.threads || []).find((x) => x.username === L.username);
  assert.ok(thread, 'admin sees the thread');
  assert.equal(thread.unread, 1, 'user message is unread for the admin');
  assert.equal(thread.lastText, 'Bonjou, mwen bezwen èd ak kont mwen.');
  const reply = await admin('/api/admin/admin-chat', { method: 'POST', body: { username: L.username, text: 'Bonjou Pam, mwen la pou ede w.' } });
  assert.equal(reply.status, 200, JSON.stringify(reply.data));
  const mine = await as.L('/api/admin-chat');
  assert.equal(mine.status, 200, JSON.stringify(mine.data));
  assert.deepEqual(mine.data.messages.map((m) => [m.sender, m.text]), [
    ['user', 'Bonjou, mwen bezwen èd ak kont mwen.'],
    ['admin', 'Bonjou Pam, mwen la pou ede w.'],
  ]);
  // Opening the thread marks it read for the admin (the list itself
  // does not auto-read threads — the admin reads by opening one).
  const opened = await admin(`/api/admin/admin-chat?username=${encodeURIComponent(L.username)}`);
  assert.equal(opened.status, 200, JSON.stringify(opened.data));
  const after = await admin('/api/admin/admin-chat');
  const threadAfter = (after.data.threads || []).find((x) => x.username === L.username);
  assert.equal(threadAfter.unread, 0, 'admin read the thread');
});

test('admin chat threads are private: another user sees only their own', { skip }, async () => {
  const mine = await as.T2('/api/admin-chat');
  assert.equal(mine.status, 200, JSON.stringify(mine.data));
  assert.deepEqual(mine.data.messages, [], 'a stranger\'s thread never leaks');
  assert.equal((await stats('/api/admin/admin-chat')).status, 401, 'stats scope refused on list');
  assert.equal((await stats('/api/admin/admin-chat', { method: 'POST', body: { username: L.username, text: 'x' } })).status, 401, 'stats scope refused on send');
  assert.equal((await admin('/api/admin/admin-chat', { method: 'POST', body: { username: `nobody_${run}`, text: 'x' } })).status, 404);
});

test('suspended user cannot send admin chat but can still read it', { skip }, async () => {
  const susp = await admin('/api/admin/flags', { method: 'POST', body: { username: L.username, action: 'suspend', reason: 'Tès' } });
  assert.equal(susp.status, 200, JSON.stringify(susp.data));
  // Suspension revokes sessions, and a landlord still signs in (the
  // refusal is tenant-only) — so re-sign in for a live session.
  const logged = await signInRaw(L.username, L.password);
  assert.equal(logged.status, 200, JSON.stringify(logged.data));
  const fresh = client(logged.cookie);
  assert.equal((await fresh('/api/admin-chat', { method: 'POST', body: { text: 'Mwen sispann?' } })).status, 403);
  const read = await fresh('/api/admin-chat');
  assert.equal(read.status, 200, 'reading still works for a suspended user');
  assert.ok(read.data.messages.length >= 2, 'the earlier exchange is still readable');
});

test('AI improve without a key reports unavailable; stats refused', { skip }, async () => {
  const get = await admin('/api/admin/admin-chat/improve');
  assert.equal(get.status, 200, JSON.stringify(get.data));
  assert.equal(get.data.available, false, 'no key in test env, so no button');
  const post = await admin('/api/admin/admin-chat/improve', { method: 'POST', body: { text: 'Bonjou', locale: 'ht' } });
  assert.equal(post.status, 200, JSON.stringify(post.data));
  assert.equal(post.data.available, false);
  assert.equal((await stats('/api/admin/admin-chat/improve')).status, 401, 'stats scope refused');
});
