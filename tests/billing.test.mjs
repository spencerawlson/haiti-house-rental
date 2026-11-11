// Free forever (Nov 2026): no fees, no billing lifecycle.
//
// Every new account is activated at signup — billing_status 'active',
// paid_until NULL — and landlords post immediately with no payment.
// Billing is dead: dueKindFor() always returns null, so submitting a
// join/quarter/reactivation payment returns 'not_applicable'. There is
// no suspension, no deactivation, no due reminder, and no promo
// tagging. The admin billing override (setBillingStatus) still exists,
// but setting 'active' leaves paid_until NULL.
//
// The old periods are gone, so the BILLING_*_MS env vars now only
// bound the "nothing ever happens" waits below: the tests sleep past
// the old quarter and grace and assert the account is still active.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, BASE, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const QUARTER_MS = Number(process.env.BILLING_QUARTER_MS);
const GRACE_MS = Number(process.env.BILLING_GRACE_MS);
const timeSkip = skip || (!Number.isFinite(QUARTER_MS) && 'needs BILLING_QUARTER_MS on the server');
const graceSkip = timeSkip || (!Number.isFinite(GRACE_MS) && 'needs BILLING_GRACE_MS on the server');
const DUE_MS = Number(process.env.BILLING_DUE_REMINDER_MS);
const dueSkip = timeSkip || (!Number.isFinite(DUE_MS) && 'needs BILLING_DUE_REMINDER_MS on the server');

const run = uniq();
const as = {};
let admin;

async function newLandlord(tag) {
  const u = { name: `Bill ${tag}`, username: `bl${tag}_${run}`, password: 'pw', role: 'landlord' };
  as[tag] = client();
  assert.equal((await signup(as[tag], u)).status, 200, `signed up ${tag}`);
  return u;
}

const me = async (tag) => (await as[tag]('/api/accounts/me')).data.account;

async function pay(tag, kind) {
  return as[tag]('/api/payments', {
    method: 'POST',
    body: { kind, provider: 'moncash', senderPhone: '30000011' },
  });
}

const cron = () =>
  fetch(`${BASE}/api/cron`, { method: 'POST', headers: { 'x-cron-key': process.env.CRON_SECRET || '' } })
    .then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const postListing = (tag, title) =>
  as[tag]('/api/listings', {
    method: 'POST',
    body: { title, commune: 'Delmas', department: 'ouest', price: 25000, purpose: 'rent' },
  });

before(async () => {
  if (skip) return;
  admin = await adminClient();
});

test('a new landlord is active at signup and can post immediately, no payment', { skip }, async () => {
  await newLandlord('A');
  const a = await me('A');
  assert.equal(a.billingStatus, 'active');
  assert.equal(a.activated, true);
  assert.equal(a.paidUntil, null, 'free forever: no expiry');
  assert.equal(a.promoTagged, false, 'no promo tagging any more');
  assert.equal(a.promoUntil, null);
  assert.equal((await postListing('A', `Yes ${run}`)).status, 200, 'can post with no payment');
  // And no payment is waiting: the account owes nothing.
  assert.deepEqual((await as.A('/api/payments')).data.payments, [], 'no payments at all');
});

test('join, quarter and reactivation payments are all not_applicable', { skip }, async () => {
  for (const kind of ['join', 'quarter', 'reactivation']) {
    const r = await pay('A', kind);
    assert.equal(r.status, 400, `${kind} is refused`);
    assert.equal(r.data.error, 'not_applicable', `${kind} is never due`);
  }
  // The legacy activation kind is dead the same way: the account is
  // already active, so there is nothing to activate.
  const act = await pay('A', 'activation');
  assert.equal(act.status, 400);
  assert.equal(act.data.error, 'already_active');
});

test('tenants and partner accounts are never billed', { skip }, async () => {
  const t = client();
  const tu = { name: 'Free Tenant', username: `blten_${run}`, password: 'pw', role: 'tenant' };
  assert.equal((await signup(t, tu)).status, 200);
  const acc = (await t('/api/accounts/me')).data.account;
  assert.equal(acc.billingStatus, 'active', 'active from the start');
  assert.equal(acc.paidUntil, null, 'and never expires');

  const p = await admin('/api/admin/partner', {
    method: 'POST',
    body: { name: 'Partner Co', username: `blpart_${run}`, phone: '+509 3000 0001', passwordHash: 'x'.repeat(64) },
  });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  const list = await admin('/api/accounts');
  const partner = list.data.accounts.find((x) => x.username === `blpart_${run}`);
  assert.equal(partner.billingStatus, 'active');
  assert.equal(partner.paidUntil, null, 'a partner never expires either');
});

test('no suspension or deactivation ever: still active past the old quarter and grace', { skip: graceSkip }, async () => {
  await newLandlord('S');
  const posted = await postListing('S', `Stays ${run}`);
  assert.equal(posted.status, 200);
  const listingId = posted.data.listing.id;

  const anon = client();
  assert.ok(((await anon('/api/listings')).data.listings || []).some((l) => l.id === listingId), 'listed while free');

  // Past the old quarter: the sweep used to suspend here.
  await sleep(QUARTER_MS + 1200);
  for (let i = 0; i < 5; i++) { await cron(); await sleep(250); }
  let a = await me('S');
  assert.equal(a.billingStatus, 'active', 'no suspension after the old quarter');
  assert.equal(a.activated, true);
  assert.equal(a.paidUntil, null);
  assert.ok(((await anon('/api/listings')).data.listings || []).some((l) => l.id === listingId), 'still on the site');
  assert.equal((await postListing('S', `Still ${run}`)).status, 200, 'can still post');

  // Past the old grace too: the sweep used to deactivate here.
  await sleep(GRACE_MS + 1200);
  for (let i = 0; i < 5; i++) { await cron(); await sleep(250); }
  a = await me('S');
  assert.equal(a.billingStatus, 'active', 'no deactivation after the old grace either');
  assert.equal(a.activated, true);
  assert.ok(((await anon('/api/listings')).data.listings || []).some((l) => l.id === listingId), 'still on the site');
});

test('no billing_due_soon reminder is ever sent', { skip: dueSkip }, async () => {
  await newLandlord('W');
  const notes = async () =>
    ((await as.W('/api/notifications')).data.notifications || []).filter((x) => x.kind === 'billing_due_soon');
  assert.equal((await notes()).length, 0, 'nothing before the job runs');
  // Run the job repeatedly, across the old reminder horizon: with no
  // expiry there is no period to warn about, so nothing may ever land.
  for (let i = 0; i < 8; i++) { await cron(); await sleep(400); }
  assert.equal((await notes()).length, 0, 'no due reminder, ever');
  const all = ((await as.W('/api/notifications')).data.notifications || []).map((x) => x.kind);
  assert.ok(!all.includes('billing_suspended') && !all.includes('billing_deactivated'), 'no billing notices at all');
});

test('the admin can override a subscription, and only the admin can — active leaves paid_until NULL', { skip }, async () => {
  await newLandlord('O');
  // Not reachable without the admin cookie.
  assert.equal((await as.O('/api/admin/billing', { method: 'POST', body: { username: `blO_${run}`, status: 'active' } })).status, 401);
  // Nor with a status that is not one of the four.
  assert.equal((await admin('/api/admin/billing', { method: 'POST', body: { username: `blO_${run}`, status: 'free-forever' } })).status, 400);

  // The override can still suspend, and setting active again restores
  // the account — with paid_until NULL, not a fresh expiry.
  const susp = await admin('/api/admin/billing', { method: 'POST', body: { username: `blO_${run}`, status: 'suspended' } });
  assert.equal(susp.status, 200);
  assert.equal(susp.data.account.billingStatus, 'suspended');
  assert.equal(susp.data.account.activated, false);
  assert.equal((await postListing('O', `Nope ${run}`)).status, 403, 'cannot post while suspended by the admin');

  const ok = await admin('/api/admin/billing', { method: 'POST', body: { username: `blO_${run}`, status: 'active' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.account.billingStatus, 'active');
  assert.equal(ok.data.account.activated, true, 'a goodwill activation lets them post');
  assert.equal(ok.data.account.paidUntil, null, 'active leaves paid_until NULL — no expiry is introduced');
  assert.equal((await postListing('O', `Gift ${run}`)).status, 200);
});
