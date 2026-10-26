// Phase 4 regression tests: manual, auditable payments. Prices come from
// the server, only the admin confirms, a confirmation applies exactly
// once, advertising gets a budget.
//
// Changed in 0013: the landlord gives the PHONE NUMBER they transferred
// from, not a transaction id. So "a reference pays once" is gone as a
// rule, deliberately — the same phone has to be able to pay again, or no
// landlord could ever renew a quarter from their own phone. What stops a
// double submission is the one-pending-payment-per-account guard, and
// that is what is tested here instead.
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
// Eight local digits, the way a Haitian number is written.
const PHONE = '30000001';
const E164 = '+50930000001';

before(async () => {
  if (skip) return;
  for (const [k, u] of [['L', L], ['L2', L2], ['T', T]]) assert.equal((await signup(as[k], u)).status, 200);
  admin = await adminClient();
});

test('activation: sender phone submitted, amount fixed by the server, admin confirms once', { skip }, async () => {
  assert.equal((await as.T('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'moncash', senderPhone: PHONE } })).status, 400);
  assert.equal((await as.L('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'paypal', senderPhone: PHONE } })).status, 400);
  // A number that is not a number is refused rather than stored.
  const bad = await as.L('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'moncash', senderPhone: 'ABC123' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.data.error, 'invalid_phone');
  // Typed with spaces, as people write it. Stored in E.164 so the admin
  // is not comparing formatting against a statement.
  const p = await as.L('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'moncash', senderPhone: ' 3000 0001 ', amountHTG: 1 } });
  assert.equal(p.status, 200);
  assert.equal(p.data.payment.amountHTG, 1000, 'price comes from config, not the client');
  assert.equal(p.data.payment.status, 'pending');
  assert.equal(p.data.payment.senderPhone, E164, 'phone normalized to E.164');
  assert.equal((await as.L('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'moncash', senderPhone: PHONE } })).status, 409, 'one pending activation at a time');
  // Submitting is not activating.
  assert.equal((await as.L('/api/accounts/me')).data.account.activated, false);
  // Only the admin reviews.
  assert.equal((await as.L('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } })).status, 401);
  const c = await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
  assert.equal(c.status, 200);
  assert.equal((await as.L('/api/accounts/me')).data.account.activated, true);
  // Double confirmation is refused.
  assert.equal((await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } })).status, 409);
  const mine = await as.L('/api/payments');
  assert.deepEqual(mine.data.payments[0].events.map((e) => e.action), ['submitted', 'confirmed']);
});

test('the same phone may pay again; one pending payment per account is the guard', { skip }, async () => {
  // THE point of moving off a transaction id. A phone number is not a
  // one-time token: the same person pays from it every quarter, and a
  // household may well pay for two accounts from one phone. Rejecting a
  // repeat would have broken every renewal.
  const r = await as.L2('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'moncash', senderPhone: PHONE } });
  assert.equal(r.status, 200, 'a phone already used by another account is accepted');
  assert.equal(r.data.payment.senderPhone, E164);

  // What actually stops a double submission is the pending guard.
  const again = await as.L2('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'natcash', senderPhone: PHONE } });
  assert.equal(again.status, 409, 'not while one is already awaiting review');
  assert.equal(again.data.error, 'already_pending');
});

test('rejection keeps the account inactive and lets the landlord resubmit', { skip }, async () => {
  const list = await admin('/api/admin/payments');
  const pending = list.data.payments.find((p) => p.username === L2.username);
  const rej = await admin('/api/admin/payments', { method: 'POST', body: { id: pending.id, decision: 'rejected', note: 'not found on statement' } });
  assert.equal(rej.data.payment.status, 'rejected');
  assert.equal((await as.L2('/api/accounts/me')).data.account.activated, false);
  const mine = await as.L2('/api/payments');
  assert.equal(mine.data.payments[0].note, 'not found on statement');
  assert.equal((await as.L2('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'moncash', senderPhone: PHONE } })).status, 200);
});

test('advertising: owner only, chosen 100–1,000 HTG, confirmation sets view/click budgets from the admin rate', { skip }, async () => {
  const listing = await as.L('/api/listings', { method: 'POST', body: { title: `Ad ${run}`, commune: 'Delmas', department: 'ouest', price: 1, purpose: 'rent', lat: 18.5, lng: -72.3 } });
  const id = listing.data.listing.id;
  assert.equal((await as.L2('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId: id, amountHTG: 100, provider: 'moncash', senderPhone: PHONE } })).status, 403);
  assert.equal((await as.L('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId: id, amountHTG: 99, provider: 'moncash', senderPhone: PHONE } })).status, 400);
  assert.equal((await as.L('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId: id, amountHTG: 1001, provider: 'moncash', senderPhone: PHONE } })).status, 400);
  const p = await as.L('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId: id, amountHTG: 300, provider: 'natcash', senderPhone: PHONE } });
  assert.equal(p.data.payment.amountHTG, 300);
  assert.equal((await as.T(`/api/listings?id=${id}`)).data.listing.advertised, false, 'not advertised before confirmation');
  await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
  const after = (await as.T(`/api/listings?id=${id}`)).data.listing;
  assert.equal(after.advertised, true);
  assert.equal(after.adBalanceHTG, 300, 'full balance at activation');
  const stats = (await admin('/api/admin/ad-stats')).data.stats.find((s) => s.id === id);
  assert.equal(stats.viewsBudget, 3000, 'default rate: 1000 views per 100 HTG');
  assert.equal(stats.clicksBudget, 600, 'default rate: 200 clicks per 100 HTG');
  // A second payment restarts the campaign with fresh budgets.
  const p2 = await as.L('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId: id, amountHTG: 100, provider: 'natcash', senderPhone: PHONE } });
  await admin('/api/admin/payments', { method: 'POST', body: { id: p2.data.payment.id, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
  const restarted = (await admin('/api/admin/ad-stats')).data.stats.find((s) => s.id === id);
  assert.equal(restarted.viewsBudget, 1000);
  assert.equal(restarted.viewsUsed, 0);
});

// Deleting a transaction (0013). Test payments have to be removable, but
// the removal is the thing that gets recorded forever.
test('a transaction cannot be deleted without a reason', { skip }, async () => {
  const listing = await as.L('/api/listings', { method: 'POST', body: { title: `Del ${run}`, commune: 'Delmas', department: 'ouest', price: 1, purpose: 'rent', lat: 18.5, lng: -72.3 } });
  const p = await as.L('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId: listing.data.listing.id, amountHTG: 100, provider: 'moncash', senderPhone: PHONE } });
  const id = p.data.payment.id;

  // No reason, a blank one, and whitespace are all refused — and the
  // payment is still there afterwards.
  for (const body of [{ id }, { id, reason: '' }, { id, reason: '   ' }]) {
    const r = await admin('/api/admin/payments', { method: 'DELETE', body });
    assert.equal(r.status, 400, `refused: ${JSON.stringify(body)}`);
    assert.equal(r.data.error, 'reason_required');
  }
  assert.ok((await admin('/api/admin/payments?status=all')).data.payments.some((x) => x.id === id), 'still in the ledger');

  // Only an admin may delete at all.
  assert.equal((await as.L('/api/admin/payments', { method: 'DELETE', body: { id, reason: 'let me' } })).status, 401);
});

test('deleting a transaction removes it but records it forever', { skip }, async () => {
  const listing = await as.L('/api/listings', { method: 'POST', body: { title: `Del2 ${run}`, commune: 'Delmas', department: 'ouest', price: 1, purpose: 'rent', lat: 18.5, lng: -72.3 } });
  const p = await as.L('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId: listing.data.listing.id, amountHTG: 100, provider: 'moncash', senderPhone: PHONE } });
  const id = p.data.payment.id;
  const amount = p.data.payment.amountHTG;
  // Confirm it first: deleting CONFIRMED money is the case that actually
  // moves the revenue figures, so that is the one worth testing.
  assert.equal((await admin('/api/admin/payments', { method: 'POST', body: { id, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } })).status, 200);
  const confirmedBefore = (await admin('/api/admin/payments')).data.summary.confirmedHTG;

  const why = `test transaction from run ${run}`;
  const del = await admin('/api/admin/payments', { method: 'DELETE', body: { id, reason: why } });
  assert.equal(del.status, 200);
  assert.equal(del.data.reason, why);

  // Gone from the ledger, and out of the money.
  const all = await admin('/api/admin/payments?status=all');
  assert.ok(!all.data.payments.some((x) => x.id === id), 'the payment row is gone');
  assert.equal(all.data.summary.confirmedHTG, confirmedBefore - amount, 'confirmed revenue dropped by its amount');

  // And kept, with everything needed to account for it later.
  const rec = all.data.deletions.find((d) => d.paymentId === id);
  assert.ok(rec, 'the deletion was recorded');
  assert.equal(rec.reason, why, 'with the reason');
  assert.equal(rec.amountHTG, amount);
  assert.equal(rec.status, 'confirmed', 'and the status it was in when deleted');
  assert.equal(rec.username, L.username);
  assert.equal(rec.senderPhone, E164);
  assert.ok(rec.deletedAt > 0 && rec.deletedBy, 'who and when');

  // Deleting the same id twice is a 404, not a second record.
  const again = await admin('/api/admin/payments', { method: 'DELETE', body: { id, reason: 'again' } });
  assert.equal(again.status, 404);
  const after = await admin('/api/admin/payments?status=all');
  assert.equal(after.data.deletions.filter((d) => d.paymentId === id).length, 1, 'still exactly one record');

  // There is no route that removes a deletion record. If one is ever
  // added, this fails and somebody has to come and read the reason why.
  for (const method of ['POST', 'DELETE']) {
    const r = await admin('/api/admin/payment-deletions', { method, body: { id: rec.id } });
    assert.notEqual(r.status, 200, `no ${method} endpoint clears the record`);
  }
});

test('summary separates confirmed from pending', { skip }, async () => {
  const { summary } = (await admin('/api/admin/payments')).data;
  assert.ok(summary.confirmedHTG >= 1000 + 225 + 75);
  assert.ok(summary.pendingHTG >= 1000, 'the retried activation is pending');
  assert.ok(summary.byKind.advertising.confirmedHTG >= 300);
});
