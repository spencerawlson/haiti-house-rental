// Listing addresses (migration 0018).
//
// Landlords living abroad cannot use "use my location" for the property,
// so they type its address: it is stored, shown on the detail page, and
// used to place the map pin (address first, commune as a fallback) when
// no explicit pin was placed. An explicit pin always wins, and an
// address that does not geocode never blocks posting.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Addr Landlord', username: `addrland_${run}`, password: 'pw-l', role: 'landlord' };
const asL = client();
let admin;

async function postListing(body) {
  const r = await asL('/api/listings', {
    method: 'POST',
    body: { commune: 'Delmas', department: 'ouest', purpose: 'rent', ...body },
  });
  assert.equal(r.status, 200, `created ${body.title}`);
  return r.data.listing;
}

before(async () => {
  if (skip) return;
  assert.equal((await signup(asL, L)).status, 200);
  admin = await adminClient();
  const p = await asL('/api/payments', {
    method: 'POST',
    body: { kind: 'activation', provider: 'moncash', senderPhone: '30000022' },
  });
  assert.equal(p.status, 200);
  await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
  assert.equal((await asL('/api/accounts/me')).data.account.activated, true);
});

test('an address is stored and returned, and an explicit pin wins', { skip }, async () => {
  const l = await postListing({ title: `Addr ${run}`, price: 50000, address: 'Rue Louverture 12, Delmas', lat: 18.54, lng: -72.3 });
  assert.equal(l.address, 'Rue Louverture 12, Delmas');
  assert.equal(l.lat, 18.54);
  assert.equal(l.lng, -72.3);
  const again = await asL(`/api/listings?id=${l.id}`);
  assert.equal(again.data.listing.address, 'Rue Louverture 12, Delmas');
});

test('no address means an empty address, and posting without a pin still works', { skip }, async () => {
  const plain = await postListing({ title: `NoAddr ${run}`, price: 40000, lat: 18.5, lng: -72.3 });
  assert.equal(plain.address, '');
  // No coordinates at all: the server geocodes (address, then commune)
  // and must still create the listing even if geocoding fails outright.
  const ungeocoded = await postListing({ title: `NoPin ${run}`, price: 30000, address: 'Somewhere that does not geocode, Delmas' });
  assert.equal(ungeocoded.address, 'Somewhere that does not geocode, Delmas');
});

test('editing changes the address, capped at 500 chars', { skip }, async () => {
  const l = await postListing({ title: `EditAddr ${run}`, price: 45000, address: 'Old address', lat: 18.5, lng: -72.3 });
  const r = await asL('/api/listings', {
    method: 'PATCH',
    body: { id: l.id, title: l.title, commune: 'Delmas', address: 'New address 45' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.listing.address, 'New address 45');
  const long = await asL('/api/listings', {
    method: 'PATCH',
    body: { id: l.id, title: l.title, commune: 'Delmas', address: 'x'.repeat(600) },
  });
  assert.equal(long.status, 200);
  assert.equal(long.data.listing.address.length, 500);
});

test('the forward-geocode endpoint requires an address and answers in shape', { skip }, async () => {
  const missing = await asL('/api/geocode');
  assert.equal(missing.status, 400);
  const found = await asL('/api/geocode?address=Delmas%2C%20Haiti');
  assert.equal(found.status, 200);
  assert.ok('lat' in found.data && 'lng' in found.data);
});
