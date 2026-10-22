// Phase 4 regression tests: manual, auditable payments. Prices come from
// the server, a reference pays once, only the admin confirms, a
// confirmation applies exactly once, advertising gets an end date.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Pat Landlord', username: `p4land_${run}`, password: 'pw-l', role: 'landlord' };
const L2 = { name: 'Max Landlord', username: `p4land2_${run}`, password: 'pw-l2', role: 'landlord' };
const T = { name: 'Ted Tenant', username: `p4ten_${run}`, password: 'pw-t', role: 'tenant' };
const as = { L: client(), L2: client(), T: client() };
let admin;
const ref = (s) => `${s}${run}`.toUpperCase();

before(async () => {
  if (skip) return;
  for (const [k, u] of [['L', L], ['L2', L2], ['T', T]]) assert.equal((await signup(as[k], u)).status, 200);
  admin = await adminClient();
});

test('activation: reference submitted, amount fixed by the server, admin confirms once', { skip }, async () => {
  assert.equal((await as.T('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'moncash', reference: ref('TEN') } })).status, 400);
  assert.equal((await as.L('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'paypal', reference: ref('X') } })).status, 400);
  const p = await as.L('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'moncash', reference: `act-${run}`.toLowerCase(), amountHTG: 1 } });
  assert.equal(p.status, 200);
  assert.equal(p.data.payment.amountHTG, 1000, 'price comes from config, not the client');
  assert.equal(p.data.payment.status, 'pending');
  assert.equal(p.data.payment.reference, ref('ACT'), 'reference normalized');
  assert.equal((await as.L('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'moncash', reference: ref('ACT2') } })).status, 409, 'one pending activation at a time');
  // Submitting is not activating.
  assert.equal((await as.L('/api/accounts/me')).data.account.activated, false);
  // Only the admin reviews.
  assert.equal((await as.L('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed' } })).status, 401);
  const c = await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed' } });
  assert.equal(c.status, 200);
  assert.equal((await as.L('/api/accounts/me')).data.account.activated, true);
  // Double confirmation is refused.
  assert.equal((await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed' } })).status, 409);
  const mine = await as.L('/api/payments');
  assert.deepEqual(mine.data.payments[0].events.map((e) => e.action), ['submitted', 'confirmed']);
});

test('a transfer reference can be used only once, across all users', { skip }, async () => {
  const r = await as.L2('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'moncash', reference: ` ${ref('act')} ` } });
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'duplicate_reference');
  // Same reference on the other provider is a different transaction.
  assert.equal((await as.L2('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'natcash', reference: ref('act') } })).status, 200);
});

test('rejection keeps the account inactive and lets the landlord resubmit', { skip }, async () => {
  const list = await admin('/api/admin/payments');
  const pending = list.data.payments.find((p) => p.username === L2.username);
  const rej = await admin('/api/admin/payments', { method: 'POST', body: { id: pending.id, decision: 'rejected', note: 'not found on statement' } });
  assert.equal(rej.data.payment.status, 'rejected');
  assert.equal((await as.L2('/api/accounts/me')).data.account.activated, false);
  const mine = await as.L2('/api/payments');
  assert.equal(mine.data.payments[0].note, 'not found on statement');
  assert.equal((await as.L2('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'moncash', reference: ref('RETRY') } })).status, 200);
});

test('advertising: owner only, 75 HTG per month, confirmed months set an end date that extends', { skip }, async () => {
  const listing = await as.L('/api/listings', { method: 'POST', body: { title: `Ad ${run}`, commune: 'Delmas', department: 'ouest', priceHTG: 1, purpose: 'rent', lat: 18.5, lng: -72.3 } });
  const id = listing.data.listing.id;
  assert.equal((await as.L2('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId: id, months: 1, provider: 'moncash', reference: ref('ADX') } })).status, 403);
  assert.equal((await as.L('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId: id, months: 5, provider: 'moncash', reference: ref('ADY') } })).status, 400);
  const p = await as.L('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId: id, months: 3, provider: 'natcash', reference: ref('AD1') } });
  assert.equal(p.data.payment.amountHTG, 225);
  assert.equal((await as.T(`/api/listings?id=${id}`)).data.listing.advertised, false, 'not advertised before confirmation');
  await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed' } });
  const after = (await as.T(`/api/listings?id=${id}`)).data.listing;
  assert.equal(after.advertised, true);
  const days = (after.advertisedUntil - Date.now()) / 86400000;
  assert.ok(days > 88 && days < 93, `about 3 months, got ${days.toFixed(1)} days`);
  const p2 = await as.L('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId: id, months: 1, provider: 'natcash', reference: ref('AD2') } });
  await admin('/api/admin/payments', { method: 'POST', body: { id: p2.data.payment.id, decision: 'confirmed' } });
  const extended = (await as.T(`/api/listings?id=${id}`)).data.listing;
  const more = (extended.advertisedUntil - after.advertisedUntil) / 86400000;
  assert.ok(more > 27 && more < 32, `extended by about a month, got ${more.toFixed(1)} days`);
});

test('summary separates confirmed from pending', { skip }, async () => {
  const { summary } = (await admin('/api/admin/payments')).data;
  assert.ok(summary.confirmedHTG >= 1000 + 225 + 75);
  assert.ok(summary.pendingHTG >= 1000, 'the retried activation is pending');
  assert.ok(summary.byKind.advertising.confirmedHTG >= 300);
});
