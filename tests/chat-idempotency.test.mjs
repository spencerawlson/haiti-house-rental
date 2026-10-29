// Phase 14c-1 — chat sends are idempotent when the device supplies a
// clientId (migration 0025). A resend with the same key — the offline
// outbox replaying a message whose first reply was lost — must not create a
// second message; a send with no key, or a different key, still creates one.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD (activated landlord + listing)';
const run = uniq();
const L = { name: 'Ida Landlord', username: `idc_land_${run}`, password: 'pw-l', role: 'landlord' };
const T = { name: 'Ido Tenant', username: `idc_ten_${run}`, password: 'pw-t', role: 'tenant' };
const as = { L: client(), T: client() };
let listingId;

before(async () => {
  if (skip) return;
  assert.equal((await signup(as.L, L)).status, 200);
  assert.equal((await signup(as.T, T)).status, 200);
  const admin = await adminClient();
  await admin('/api/admin/activate', { method: 'POST', body: { username: L.username, activated: true } });
  const r = await as.L('/api/listings', { method: 'POST', body: { title: 'Idem home', commune: 'Delmas', department: 'ouest', price: 1500, purpose: 'rent', lat: 18.5, lng: -72.3 } });
  assert.equal(r.status, 200);
  listingId = r.data.listing.id;
});

// How many messages in the tenant's own thread carry this exact text.
async function count(text) {
  const r = await as.T(`/api/chat?listingId=${listingId}`);
  return (r.data.messages || []).filter((m) => m.text === text).length;
}

test('a resend with the same clientId creates no duplicate', { skip }, async () => {
  const body = { listingId, text: 'ann pale', clientId: `cid-${run}-a` };
  const first = await as.T('/api/chat', { method: 'POST', body });
  assert.equal(first.status, 200);
  const second = await as.T('/api/chat', { method: 'POST', body });
  assert.equal(second.status, 200, 'a deduplicated retry still succeeds');
  assert.equal(second.data.message.id, first.data.message.id, 'returns the original message');
  assert.equal(await count('ann pale'), 1, 'exactly one message stored');
});

test('without a clientId, two sends are two messages', { skip }, async () => {
  assert.equal((await as.T('/api/chat', { method: 'POST', body: { listingId, text: 'de fwa' } })).status, 200);
  assert.equal((await as.T('/api/chat', { method: 'POST', body: { listingId, text: 'de fwa' } })).status, 200);
  assert.equal(await count('de fwa'), 2, 'no key means no dedup');
});

test('a different clientId is a different message', { skip }, async () => {
  await as.T('/api/chat', { method: 'POST', body: { listingId, text: 'yon lot', clientId: `cid-${run}-b1` } });
  await as.T('/api/chat', { method: 'POST', body: { listingId, text: 'yon lot', clientId: `cid-${run}-b2` } });
  assert.equal(await count('yon lot'), 2);
});
