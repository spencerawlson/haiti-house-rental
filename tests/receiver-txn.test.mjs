// The receiver's transaction ID (0014): one real transfer can confirm one
// payment only. IDs come from the ADMIN's statement — MonCash shows the
// sender a different ID — so the landlord never types it.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, sha, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
let admin;
let landlord;
let listingId;

// One admin-created PARTNER landlord (not subject to the sign-up rate
// limit) and one listing; every payment below is an advertising
// payment on it, so the file adds no sign-ups to the suite.
async function pendingAd(provider = 'moncash') {
  const p = await landlord('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId, amountHTG: 100, provider, senderPhone: '+509 3700 0000' } });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  return p.data.payment.id;
}
const confirm = (id, body) => admin('/api/admin/payments', { method: 'POST', body: { id, decision: 'confirmed', ...body } });

before(async () => {
  if (skip) return;
  admin = await adminClient();
  const u = `txn_${run}`;
  const made = await admin('/api/admin/partner', { method: 'POST', body: { name: 'Txn Landlord', username: u, passwordHash: sha('pw'), phone: '+509 0000 0000', location: { department: 'ouest', commune: 'Delmas' } } });
  assert.equal(made.status, 200, JSON.stringify(made.data));
  landlord = client();
  assert.equal((await landlord('/api/accounts/signin', { method: 'POST', body: { username: u, passwordHash: sha('pw') } })).status, 200);
  const l = await landlord('/api/listings', { method: 'POST', body: { title: `Txn ${run}`, commune: 'Delmas', department: 'ouest', price: 1, purpose: 'rent', lat: 18.5, lng: -72.3 } });
  assert.equal(l.status, 200, JSON.stringify(l.data));
  listingId = l.data.listing.id;
});

test('confirming needs a receiver ID, or an explicit "without ID"', { skip }, async () => {
  const id = await pendingAd();
  const r = await confirm(id, {});
  assert.equal(r.status, 400);
  assert.equal(r.data.error, 'txn_required');
  const ok = await confirm(id, { allowNoTxn: true });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.payment.receiverTxn, null);
  const flagged = await admin('/api/admin/payments?status=confirmed');
  assert.ok(flagged.data.payments.some((p) => p.id === id && p.receiverTxn === null));
});

test('the same statement ID cannot confirm two payments (case/spaces/dashes ignored)', { skip }, async () => {
  const a = await pendingAd();
  const b = await pendingAd();
  const txn = `MC-${run}-1234`;
  const first = await confirm(a, { receiverTxn: txn });
  assert.equal(first.status, 200);
  assert.equal(first.data.payment.receiverTxn, txn);
  const again = await confirm(b, { receiverTxn: ` mc ${run} 1234 `.replace(/-/g, '') });
  assert.equal(again.status, 409);
  assert.equal(again.data.error, 'txn_used');
  assert.equal(again.data.usedBy.id, a);
  // b is still pending and can be confirmed with its own, different ID.
  assert.equal((await confirm(b, { receiverTxn: `MC-${run}-5678` })).status, 200);
});

test('the same ID on the other provider is a different transaction', { skip }, async () => {
  const m = await pendingAd('moncash');
  const n = await pendingAd('natcash');
  const txn = `X${run}99`;
  assert.equal((await confirm(m, { receiverTxn: txn })).status, 200);
  assert.equal((await confirm(n, { receiverTxn: txn })).status, 200);
});

test('a rejected payment does not reserve its ID', { skip }, async () => {
  const a = await pendingAd();
  const b = await pendingAd();
  // The admin typed an ID, then rejected instead: nothing is stored.
  const rej = await admin('/api/admin/payments', { method: 'POST', body: { id: a, decision: 'rejected', note: 'not found', receiverTxn: `R${run}` } });
  assert.equal(rej.data.payment.receiverTxn, null);
  assert.equal((await confirm(b, { receiverTxn: `R${run}` })).status, 200);
});

test('two confirmations racing with the same ID: exactly one wins', { skip }, async () => {
  const a = await pendingAd();
  const b = await pendingAd();
  const txn = `RACE${run}`;
  const [ra, rb] = await Promise.all([confirm(a, { receiverTxn: txn }), confirm(b, { receiverTxn: txn })]);
  assert.deepEqual([ra.status, rb.status].sort(), [200, 409]);
});
