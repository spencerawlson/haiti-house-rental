// Fraud-flag admin table + suspension for cause (landlords AND tenants).
//
// Design (owner-decided Oct 26): the Admin Board shows flagged accounts —
// name, account number (kay-XXXX), the tenant's report text, flag count
// (open reports). Flags are review-only: suspension is a separate admin
// action, and fraud reactivation is admin-only (never by payment).
// Suspension for cause is separate from billing status: it never touches
// activated/billing_status. The flagged account is told privately (no
// reporter identity, no verbatim report text in their notice); the public
// sees no labels — a suspended landlord's homes just disappear.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, ADMIN_PASSWORD, client, signup, adminClient, uniq, sha } from './helpers.mjs';
import { getDict } from '../lib/dictionaries.js';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Fred Landlord', username: `fredflag_${run}`, password: 'pw-l', role: 'landlord' };
const T = { name: 'Tess Tenant', username: `tesflag_${run}`, password: 'pw-t', role: 'tenant' };
const T2 = { name: 'Tom Tenant', username: `tomflag_${run}`, password: 'pw-t2', role: 'tenant' };
const as = { L: client(), T: client(), T2: client() };
let admin;
let stats;
let listingId;
let billingBefore;
let listingReportT;
let listingReportT2;
let conversationReportL;

async function loginRaw(body) {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  return { status: res.status, cookie, data: await res.json().catch(() => null) };
}

async function signInRaw(username, password) {
  const res = await fetch(`${BASE}/api/accounts/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, passwordHash: sha(password) }),
  });
  const cookies = res.headers.getSetCookie?.() || [];
  return { status: res.status, cookies, data: await res.json().catch(() => null) };
}

async function waitForNotification(who, kind) {
  for (let i = 0; i < 12; i++) {
    const r = await who('/api/notifications');
    const found = (r.data?.notifications || []).find((n) => n.kind === kind);
    if (found) return found;
    await new Promise((res) => setTimeout(res, 500));
  }
  return null;
}

before(async () => {
  if (skip) return;
  assert.equal((await signup(as.L, L)).status, 200);
  assert.equal((await signup(as.T, T)).status, 200);
  assert.equal((await signup(as.T2, T2)).status, 200);
  admin = await adminClient();
  // Stats-scope login, for the 401 checks: a partner sees numbers only.
  const statsName = `flagstats_${run}`;
  assert.equal((await admin('/api/admin/admin-users', { method: 'POST', body: { username: statsName, password: 'partner-pass-123' } })).status, 201);
  const logged = await loginRaw({ username: statsName, password: 'partner-pass-123' });
  assert.equal(logged.status, 200);
  stats = client(logged.cookie);
  // Activate the landlord the billing way (payment + admin confirm).
  const p = await as.L('/api/payments', {
    method: 'POST',
    body: { kind: 'activation', provider: 'moncash', senderPhone: '30000021' },
  });
  assert.equal(p.status, 200);
  await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed', receiverTxn: `F${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
  assert.equal((await as.L('/api/accounts/me')).data.account.activated, true);
  // The landlord posts one home; the tenant writes in its thread.
  const posted = await as.L('/api/listings', {
    method: 'POST',
    body: { title: `Flag home ${run}`, commune: 'Delmas', department: 'ouest', price: 50000, purpose: 'rent', lat: 18.5, lng: -72.3 },
  });
  assert.equal(posted.status, 200, JSON.stringify(posted.data));
  listingId = posted.data.listing.id;
  assert.equal((await as.T('/api/chat', { method: 'POST', body: { listingId, text: 'Bonjou, kay la toujou disponib?' } })).status, 200);
  // Two tenants report the listing (count 2, latest message wins); the
  // landlord reports the conversation (accused = the tenant).
  const r1 = await as.T('/api/reports', { method: 'POST', body: { kind: 'listing', listingId, reason: 'scam', details: 'Frod mesaj 1' } });
  assert.equal(r1.status, 200, JSON.stringify(r1.data));
  listingReportT = r1.data.report.id;
  const r2 = await as.T2('/api/reports', { method: 'POST', body: { kind: 'listing', listingId, reason: 'scam', details: 'Frod mesaj 2, pi resan' } });
  assert.equal(r2.status, 200, JSON.stringify(r2.data));
  listingReportT2 = r2.data.report.id;
  const r3 = await as.L('/api/reports', { method: 'POST', body: { kind: 'conversation', listingId, tenant: T.username, reason: 'harassment', details: 'Menas nan chat' } });
  assert.equal(r3.status, 200, JSON.stringify(r3.data));
  conversationReportL = r3.data.report.id;
});

test('flags table aggregates open reports per account: name, id, message, count — admin only', { skip }, async () => {
  const r = await admin('/api/admin/flags');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const landlord = (r.data.flags || []).find((f) => f.username === L.username);
  assert.ok(landlord, 'landlord row present');
  assert.equal(landlord.name, L.name);
  assert.match(landlord.id, /^kay-\d+$/);
  assert.equal(landlord.role, 'landlord');
  assert.equal(landlord.fraudSuspended, false);
  assert.equal(landlord.flagCount, 2, 'two tenant reports on the listing');
  assert.equal(landlord.message, 'Frod mesaj 2, pi resan', 'latest open report text');
  assert.deepEqual(Object.keys(landlord).sort(), ['flagCount', 'fraudSuspended', 'id', 'latestAt', 'message', 'name', 'role', 'username'], 'no reporter identity leaks into the row');
  const tenant = (r.data.flags || []).find((f) => f.username === T.username);
  assert.ok(tenant, 'tenant row present from the conversation report');
  assert.equal(tenant.role, 'tenant');
  assert.equal(tenant.flagCount, 1);
  assert.equal(tenant.message, 'Menas nan chat');
  assert.equal((await client()('/api/admin/flags')).status, 401, 'anonymous refused');
  assert.equal((await stats('/api/admin/flags')).status, 401, 'stats scope refused');
  assert.equal((await as.T('/api/admin/flags')).status, 401, 'tenant refused');
});

test('suspending a landlord hides homes, blocks posting and chat, keeps sign-in — and revokes old sessions', { skip }, async () => {
  // Billing state before: the 'activation' payment flow sets activated
  // but leaves billing_status 'pending' — record it, don't assume it.
  billingBefore = (await as.L('/api/accounts/me')).data.account;
  const susp = await admin('/api/admin/flags', { method: 'POST', body: { username: L.username, action: 'suspend', reason: 'Rapò fwod' } });
  assert.equal(susp.status, 200, JSON.stringify(susp.data));
  assert.equal(susp.data.account.fraudSuspended, true);
  // Old sessions die at suspension.
  assert.equal((await as.L('/api/accounts/me')).status, 401, 'pre-suspension session revoked');
  // Landlord sign-in still works (they must see the notice + appeal path).
  const back = await signInRaw(L.username, L.password);
  assert.equal(back.status, 200, JSON.stringify(back.data));
  // signInRaw is a raw fetch, so re-seed the jar client with the fresh
  // session it issued; the old jar still holds the revoked cookie.
  const sessionCookie = (back.cookies || []).map((c) => c.split(';')[0]).join('; ');
  assert.ok(sessionCookie.includes('kay_session='), 're-sign-in issued a session');
  as.L = client(sessionCookie);
  const me = await as.L('/api/accounts/me');
  assert.equal(me.data.account.fraudSuspended, true);
  assert.equal(me.data.account.billingStatus, billingBefore.billingStatus, 'billing untouched by fraud suspension');
  assert.equal(me.data.account.activated, billingBefore.activated, 'activated untouched by fraud suspension');
  // Public views lose the home; the owner's library keeps it.
  const anon = client();
  const pub = await anon('/api/listings');
  assert.ok(!(pub.data.listings || []).some((l) => l.id === listingId), 'home gone from public search');
  assert.equal((await anon(`/api/listings?id=${listingId}`)).status, 404, 'direct link 404s');
  const mine = await as.L(`/api/listings?owner=${encodeURIComponent(L.username)}&all=1`);
  assert.ok((mine.data.listings || []).some((l) => l.id === listingId), 'owner library unaffected');
  // Cannot post, cannot reply in chat while suspended.
  assert.equal((await as.L('/api/listings', { method: 'POST', body: { title: 'Pandan sispann', commune: 'Delmas', department: 'ouest', price: 1000, purpose: 'rent' } })).status, 403);
  assert.equal((await as.L('/api/chat', { method: 'POST', body: { listingId, tenant: T.username, text: 'Repons pandan sispann' } })).status, 403);
  // The tenant side sees the counterpart as neutrally unavailable.
  const thread = await as.T(`/api/chat?listingId=${listingId}`);
  assert.equal(thread.data.otherSuspended, true, 'counterpart sees unavailable, no reason');
});

test('reactivating a landlord restores homes and posting, billing still untouched', { skip }, async () => {
  const re = await admin('/api/admin/flags', { method: 'POST', body: { username: L.username, action: 'reactivate' } });
  assert.equal(re.status, 200, JSON.stringify(re.data));
  assert.equal(re.data.account.fraudSuspended, false);
  const pub = await client()('/api/listings');
  assert.ok((pub.data.listings || []).some((l) => l.id === listingId), 'home back in public search');
  const posted = await as.L('/api/listings', {
    method: 'POST',
    body: { title: `Apre reaktive ${run}`, commune: 'Delmas', department: 'ouest', price: 60000, purpose: 'rent' },
  });
  assert.equal(posted.status, 200, JSON.stringify(posted.data));
  const after = (await as.L('/api/accounts/me')).data.account;
  assert.equal(after.billingStatus, billingBefore.billingStatus, 'billing still untouched after reactivation');
  assert.equal(after.activated, billingBefore.activated);
});

test('report resolution notifies the reporter with the outcome, never the sanction', { skip }, async () => {
  const beforeT = (await as.T('/api/notifications')).data.notifications || [];
  const resolvedAction = await admin('/api/admin/reports', { method: 'POST', body: { id: listingReportT, actionTaken: true } });
  assert.equal(resolvedAction.status, 200, JSON.stringify(resolvedAction.data));
  const noteAction = await waitForNotification(as.T, 'report_reviewed_action');
  assert.ok(noteAction, 'reporter notified of action taken');
  const renderedAction = getDict('ht').notif_report_reviewed_action;
  assert.ok(!renderedAction.includes('sispann') && !renderedAction.includes('suspend'), 'no sanction detail in the notice text');
  const resolvedNone = await admin('/api/admin/reports', { method: 'POST', body: { id: listingReportT2, actionTaken: false } });
  assert.equal(resolvedNone.status, 200);
  const noteNone = await waitForNotification(as.T2, 'report_reviewed_none');
  assert.ok(noteNone, 'reporter notified of no action');
  // Resolving without an outcome states nothing: no new notice appears.
  const beforeL = ((await as.L('/api/notifications')).data.notifications || []).filter((n) => n.kind.startsWith('report_reviewed')).length;
  assert.equal((await admin('/api/admin/reports', { method: 'POST', body: { id: conversationReportL } })).status, 200);
  await new Promise((res) => setTimeout(res, 1500));
  const afterL = ((await as.L('/api/notifications')).data.notifications || []).filter((n) => n.kind.startsWith('report_reviewed')).length;
  assert.equal(afterL, beforeL, 'no notice without an outcome');
  assert.ok(beforeT.length >= 0, 'baseline read');
});

test('suspending a tenant refuses sign-in with the notice and no session', { skip }, async () => {
  const susp = await admin('/api/admin/flags', { method: 'POST', body: { username: T.username, action: 'suspend', reason: 'Abi chat' } });
  assert.equal(susp.status, 200);
  assert.equal((await as.T('/api/accounts/me')).status, 401, 'pre-suspension session revoked');
  const attempt = await signInRaw(T.username, T.password);
  assert.equal(attempt.status, 403, 'correct password still refused while suspended');
  assert.equal(attempt.data.error, 'suspended');
  assert.equal(attempt.data.reason, 'Abi chat', 'category carried, reporter identity never');
  assert.ok(!(attempt.cookies || []).some((c) => c.startsWith('kay_session=')), 'no session issued');
  // Scope: the other tenant is unaffected.
  assert.equal((await as.T2('/api/accounts/me')).status, 200);
});

test('suspend validation: unknown account, bad action, missing reason', { skip }, async () => {
  assert.equal((await admin('/api/admin/flags', { method: 'POST', body: { username: `nobody_${run}`, action: 'suspend', reason: 'x' } })).status, 404);
  assert.equal((await admin('/api/admin/flags', { method: 'POST', body: { username: L.username, action: 'ban' } })).status, 400);
  assert.equal((await admin('/api/admin/flags', { method: 'POST', body: { username: L.username, action: 'suspend', reason: '   ' } })).status, 400);
});

test('fraud dictionary keys exist in all three locales', async () => {
  const keys = ['flagsTitle', 'flagsEmpty', 'flagsCount', 'flagsSuspend', 'flagsReactivate', 'flagsSuspendConfirm', 'flagsSuspendReasonPrompt', 'flagsReactivateConfirm', 'flagsSuspendedBadge', 'fraudAccountSuspended', 'fraudSigninSuspended', 'fraudChatUnavailable', 'resolveReportAction', 'resolveReportNone', 'notif_report_reviewed_action', 'notif_report_reviewed_none'];
  for (const locale of ['ht', 'fr', 'en']) {
    const t = getDict(locale);
    for (const k of keys) {
      assert.equal(typeof t[k], 'string', `${locale}.${k} present`);
      assert.ok(t[k].length > 0, `${locale}.${k} non-empty`);
    }
  }
});
