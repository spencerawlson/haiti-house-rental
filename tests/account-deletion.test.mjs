// Account deletion (Apple Guideline 5.1.1(v)): a user deletes their own
// account, and only their own data goes. The money ledger survives:
// deleting an account must never rewrite what was paid.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, ADMIN_PASSWORD, client, signup, adminClient, uniq, sha } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Del Landlord', username: `del_land_${run}`, password: 'pw-l', role: 'landlord' };
const T = { name: 'Dee Tenant', username: `del_ten_${run}`, password: 'pw-t', role: 'tenant' };
const as = { L: client(), T: client(), anon: client() };
let admin;
let listingId;
let paymentId;

before(async () => {
  if (skip) return;
  assert.equal((await signup(as.L, L)).status, 200);
  assert.equal((await signup(as.T, T)).status, 200);
  admin = await adminClient();
  // The landlord must be activated before it can post.
  const p = await as.L('/api/payments', {
    method: 'POST',
    body: { kind: 'activation', provider: 'moncash', senderPhone: '30000020' },
  });
  assert.equal(p.status, 200);
  paymentId = p.data.payment.id;
  await admin('/api/admin/payments', { method: 'POST', body: { id: paymentId, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
  assert.equal((await as.L('/api/accounts/me')).data.account.activated, true);
  const r = await as.L('/api/listings', {
    method: 'POST',
    body: { title: `Del home ${run}`, commune: 'Delmas', department: 'ouest', price: 50000, purpose: 'rent', lat: 18.5, lng: -72.3 },
  });
  assert.equal(r.status, 200, 'created listing');
  listingId = r.data.listing.id;
});

test('unauthenticated deletion is rejected', { skip }, async () => {
  const r = await as.anon('/api/accounts/me', { method: 'DELETE' });
  assert.equal(r.status, 401);
});

test('a tenant deletes their own account and cannot sign in again', { skip }, async () => {
  const r = await as.T('/api/accounts/me', { method: 'DELETE' });
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  assert.equal((await as.T('/api/accounts/me')).status, 401);
  const again = await as.T('/api/accounts/signin', {
    method: 'POST',
    body: { username: T.username, passwordHash: sha(T.password) },
  });
  assert.equal(again.status, 401);
});

test('a landlord deletion removes listings but keeps the ledger', { skip }, async () => {
  const r = await as.L('/api/accounts/me', { method: 'DELETE' });
  assert.equal(r.status, 200);
  assert.equal((await as.L('/api/accounts/me')).status, 401);
  const homes = await as.L(`/api/listings?owner=${encodeURIComponent(L.username)}&all=1`);
  assert.equal((homes.data.listings || []).some((h) => h.id === listingId), false);
  const all = await admin('/api/admin/payments?status=all');
  assert.equal((all.data.payments || []).some((p) => p.id === paymentId), true);
});
