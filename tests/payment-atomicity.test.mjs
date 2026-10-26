// Payment-confirm atomicity (Stage 2, A1): a confirmed payment must
// always carry its billing/revenue/ad effect, and a failure mid-confirm
// must leave the payment pending (recoverable), never confirmed-but-
// unapplied. The fault test uses a test-only hook on reviewPayment
// (__testFailAfterFlip) that no HTTP route forwards, so it cannot be
// triggered from outside the test process.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';
import { reviewPayment } from '../lib/payments-server.js';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const txn = (p) => `${p}${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

const as = {};
let admin;

async function newLandlord(tag) {
  const u = { name: `Atom ${tag}`, username: `atom${tag}_${run}`, password: 'pw-a', role: 'landlord' };
  as[tag] = client();
  assert.equal((await signup(as[tag], u)).status, 200, `signed up ${tag}`);
  return u;
}

async function submit(tag, body) {
  const r = await as[tag]('/api/payments', { method: 'POST', body });
  assert.equal(r.status, 200, `submitted ${JSON.stringify(body)}`);
  return r.data.payment;
}

async function confirm(id) {
  const c = await admin('/api/admin/payments', { method: 'POST', body: { id, decision: 'confirmed', receiverTxn: txn('AT') } });
  assert.equal(c.status, 200, 'confirmed');
  return c.data.payment;
}

const me = async (tag) => (await as[tag]('/api/accounts/me')).data.account;
const pendingPayment = async (id) => {
  const list = await admin('/api/admin/payments?status=pending');
  return (list.data.payments || []).find((p) => p.id === id);
};

before(async () => {
  if (skip) return;
  admin = await adminClient();
});

test('a failure mid-confirm leaves the payment pending, never confirmed-but-unapplied', { skip }, async () => {
  const u = await newLandlord('F');
  const p = await submit('F', { kind: 'join', provider: 'moncash', senderPhone: '30000021' });
  assert.equal((await me('F')).billingStatus, 'pending', 'not active before confirm');

  // The fault fires after the status flip but before any side effect.
  // Before the A1 fix this call succeeds (the hook is ignored) and the
  // assertion below fails; after the fix it throws and rolls back.
  await assert.rejects(
    reviewPayment(p.id, 'confirmed', '', 'admin', { receiverTxn: txn('ATF'), __testFailAfterFlip: true }),
    /test fault/,
    'mid-confirm failure throws',
  );

  assert.ok(await pendingPayment(p.id), 'still pending after the failed confirm');
  assert.equal((await me('F')).billingStatus, 'pending', 'no billing effect applied');

  // The state is recoverable: the same payment confirms normally now.
  await confirm(p.id);
  assert.equal((await me('F')).billingStatus, 'active', 'active after re-confirm');
});

test('a confirmed join payment carries its billing and revenue effect', { skip }, async () => {
  const u = await newLandlord('J');
  const p = await submit('J', { kind: 'join', provider: 'moncash', senderPhone: '30000022' });
  await confirm(p.id);
  assert.equal((await me('J')).billingStatus, 'active', 'billing applied');
  const rev = await admin('/api/admin/revenue');
  const row = (rev.data.entries || []).find((e) => e.username === u.username && e.kind === 'join');
  assert.ok(row, 'revenue roster carries the join payment');
  assert.equal(row.amountHTG, 1500, 'at the real amount');
});

test('a confirmed advertising payment carries its ad budgets', { skip }, async () => {
  const u = await newLandlord('A');
  const p = await submit('A', { kind: 'join', provider: 'moncash', senderPhone: '30000023' });
  await confirm(p.id);
  const made = await as.A('/api/listings', {
    method: 'POST',
    body: { title: `Atom Ad ${run}`, commune: 'Delmas', department: 'ouest', price: 30000, purpose: 'rent' },
  });
  assert.equal(made.status, 200, 'listing posted');
  const listingId = made.data.listing.id;
  const ad = await submit('A', { kind: 'advertising', provider: 'moncash', senderPhone: '30000023', listingId, amountHTG: 500 });
  await confirm(ad.id);
  const mine = (await as.A(`/api/listings?owner=${encodeURIComponent(u.username)}&all=1`)).data.listings || [];
  const lib = mine.find((l) => l.id === listingId);
  assert.ok(lib.advertised, 'campaign shows in the Library');
  assert.equal(lib.adBalanceHTG, 500, 'full balance before any consumption');
  const stats = await admin('/api/admin/ad-stats');
  const row = (stats.data.stats || []).find((s) => s.id === listingId);
  assert.ok(row, 'admin ad-stats carries the campaign');
  assert.ok(row.viewsBudget > 0 && row.clicksBudget > 0, 'budgets set from the admin rate');
});
