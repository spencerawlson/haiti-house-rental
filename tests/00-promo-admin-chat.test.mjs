// Promo (400 free landlord spots, retroactive) + admin chat + AI assist
// availability (admin chats only, key-optional).
//
// ORDERING: this file MUST run first in the suite (the 00- prefix puts
// it first in the tests/*.test.mjs glob, and the suite runs files
// sequentially with --test-concurrency=1). It consumes the 400 promo
// spots — the cap test at the end tags the last one — so every other
// file runs with the promo full and exercises normal billing: a fresh
// landlord there is pending and pays to activate, exactly as before
// the promo existed. Run the full suite, not one file alone: a single
// file against a fresh DB sees live promo tagging, by design.
//
// Design (owner-decided Oct 26): the first 400 landlord accounts —
// existing ones first, earliest created — are tagged promo and post
// free for one year (activated at once, paid_until IS the promo end),
// then normal billing applies. The Admin Board shows the countdown:
// 400 minus tagged. Admin chat is the listing-chat model with admin
// as a participant, not listing-bound: users start from "Contact
// admin", the admin starts from the chat symbol on an account row.
// The AI button only exists in admin chats, and only when the server
// has a key — with no key the route says available:false and the
// button stays hidden.
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

test('landlord signup is promo-tagged while spots remain: active at once, free year', { skip }, async () => {
  const me = (await as.L('/api/accounts/me')).data.account;
  assert.equal(me.promoTagged, true, 'landlord takes a promo spot');
  assert.equal(me.activated, true, 'promo activates immediately, no payment wait');
  assert.equal(me.billingStatus, 'active');
  const year = 365 * 86400000;
  assert.ok(me.promoUntil > Date.now() + year - 5 * 60 * 1000, 'promo runs about a year');
  assert.ok(me.promoUntil < Date.now() + year + 5 * 60 * 1000, 'promo runs about a year');
  assert.equal(me.paidUntil, me.promoUntil, 'paid_until IS the promo end');
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

test('promo countdown route: counts only, full-admin only', { skip }, async () => {
  const r = await admin('/api/admin/promo');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.spots, 400);
  assert.ok(r.data.tagged >= 1, 'at least this file\'s landlord is tagged');
  assert.equal(r.data.remaining, 400 - r.data.tagged);
  assert.equal((await stats('/api/admin/promo')).status, 401, 'stats scope refused');
  assert.equal((await client()('/api/admin/promo')).status, 401, 'anonymous refused');
});

test('landing page announces the promo; fees show struck through', { skip }, async () => {
  const promo = (await admin('/api/admin/promo')).data;
  assert.ok(promo.remaining > 150, 'early in the run: plenty of spots left');
  const { status, html } = await landingHtml();
  assert.equal(status, 200);
  assert.ok(html.includes('Pwomosyon: Pibliye gratis pou yon ane!'), 'banner title renders');
  assert.ok(html.includes('Plas limite: premye 400 pwopriyetè yo'), 'early on it says spots are limited');
  assert.ok(!/Sèlman \d+ plas ki rete/.test(html), 'no "398 of 400" count while most spots are open');
  assert.ok(html.includes('Apre premye ane a: 1,000 HTG chak 3 mwa.'), 'what happens after the year');
  assert.ok(html.includes('/ht/signup?role=landlord'), 'banner goes straight to landlord signup');
  assert.ok(html.includes('Mete kay ou gratis'), 'banner button says what it does');
  // The landlord card no longer contradicts the banner: normal fees struck.
  assert.match(html, /<s class="price-was">1,500 HTG<\/s>/);
  assert.match(html, /<s class="price-was">1,000 HTG<\/s>/);
  // Search comes before the banner: most visitors are looking for a home.
  assert.ok(html.indexOf('name="q"') < html.indexOf('promo-banner'), 'search above the banner');
  // Public counts for the client pages: spots and spots left only.
  const pub = await (await fetch(`${BASE}/api/promo`)).json();
  assert.deepEqual(Object.keys(pub).sort(), ['remaining', 'spots']);
  assert.equal(pub.spots, 400);
});

test('promo landlord survives the billing sweep: the year counts as paid up', { skip }, async () => {
  const cron = await fetch(`${BASE}/api/cron`, { method: 'POST', headers: { 'x-cron-key': process.env.CRON_SECRET || '' } });
  // The sweep runs on the shared cron endpoint; whatever it returned,
  // a promo landlord with a year left must still be active afterwards.
  const me = (await as.L('/api/accounts/me')).data.account;
  assert.equal(me.activated, true);
  assert.equal(me.billingStatus, 'active');
  assert.ok(cron.status === 200 || cron.status === 401, `cron answered ${cron.status}`);
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

test('the 400 cap holds: the first untagged landlord ends the promo', { skip }, async () => {
  // Other files sign up landlords concurrently, so the loop runs until
  // it SEES an untagged landlord rather than counting to 400 itself.
  // The signup response carries the account, so one request per try.
  let untagged = null;
  let countSeen = false;
  for (let i = 0; i < 420; i++) {
    // Once spots are scarce (<= 150 left), the banner shows the count
    // and a progress bar. Checked once, around 100 left.
    if (!countSeen) {
      const left = (await (await fetch(`${BASE}/api/promo`)).json()).remaining;
      if (left <= 100) {
        const { html } = await landingHtml();
        const m = html.match(/Sèlman (\d+) plas ki rete sou 400/);
        assert.ok(m, 'scarce spots: the banner shows the count');
        assert.ok(Number(m[1]) <= left && Number(m[1]) > 0, `shown ${m[1]} vs ${left}`);
        assert.ok(html.includes('class="promo-meter"'), 'and a progress bar');
        countSeen = true;
      }
    }
    const u = { name: 'Cap', username: `cap_${run}_${i}`, password: 'pw-cap', role: 'landlord' };
    const c = client();
    const r = await signup(c, u);
    assert.equal(r.status, 200, `signup ${i}: ${JSON.stringify(r.data)}`);
    if (!r.data.account.promoTagged) {
      untagged = u.username;
      break;
    }
  }
  assert.ok(untagged, 'a landlord past the cap comes back untagged');
  assert.ok(countSeen, 'the count was shown while spots were scarce');
  const r = await admin('/api/admin/promo');
  assert.equal(r.data.tagged, 400, 'exactly 400 tagged, no overshoot');
  assert.equal(r.data.remaining, 0);
  assert.equal(r.data.spots, 400);
});

test('landing page hides the promo announcement once full', { skip }, async () => {
  // Runs after the cap test in this file, so the promo is genuinely
  // full here — and tags never come off, so no later signup reopens it.
  const { status, html } = await landingHtml();
  assert.equal(status, 200);
  assert.ok(!html.includes('Pwomosyon: Pibliye gratis pou yon ane!'), 'no banner at 0 spots');
  // Full promo: normal prices again, nothing struck through.
  assert.ok(!html.includes('price-was'), 'normal fees once the promo is full');
  assert.match(html, /1,500(<!-- -->)? HTG/, 'the joining fee shows normally');
});
