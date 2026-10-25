// Listings priced in HTG or USD (migration 0017).
//
// The posting form carries a currency selector above the price; the API
// stores the amount in price plus its currency. Existing homes are HTG,
// an invalid currency falls back to HTG, and the pre-rename priceHTG
// field is still accepted so pages loaded before the change keep working.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Cur Landlord', username: `curland_${run}`, password: 'pw-l', role: 'landlord' };
const asL = client();
let admin;

async function postListing(body) {
  const r = await asL('/api/listings', {
    method: 'POST',
    body: { commune: 'Delmas', department: 'ouest', purpose: 'rent', lat: 18.5, lng: -72.3, ...body },
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
    body: { kind: 'activation', provider: 'moncash', senderPhone: '30000021' },
  });
  assert.equal(p.status, 200);
  await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
  assert.equal((await asL('/api/accounts/me')).data.account.activated, true);
});

test('a USD listing keeps its currency end to end', { skip }, async () => {
  const l = await postListing({ title: `USD Home ${run}`, price: 500, currency: 'USD' });
  assert.equal(l.currency, 'USD');
  assert.equal(l.price, 500);
  const again = await asL(`/api/listings?id=${l.id}`);
  assert.equal(again.data.listing.currency, 'USD');
  assert.equal(again.data.listing.price, 500);
});

test('no currency means HTG, and a bogus currency falls back to HTG', { skip }, async () => {
  const plain = await postListing({ title: `Plain ${run}`, price: 75000 });
  assert.equal(plain.currency, 'HTG');
  const bogus = await postListing({ title: `Bogus ${run}`, price: 100, currency: 'EUR' });
  assert.equal(bogus.currency, 'HTG');
  assert.equal(bogus.price, 100);
});

test('editing changes the currency, and a bogus edit leaves it alone', { skip }, async () => {
  const l = await postListing({ title: `Edit ${run}`, price: 400, currency: 'USD' });
  const r = await asL('/api/listings', {
    method: 'PATCH',
    body: { id: l.id, title: l.title, commune: 'Delmas', price: 450, currency: 'HTG' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.listing.currency, 'HTG');
  assert.equal(r.data.listing.price, 450);
  const bad = await asL('/api/listings', {
    method: 'PATCH',
    body: { id: l.id, title: l.title, commune: 'Delmas', currency: 'EUR' },
  });
  assert.equal(bad.status, 200);
  assert.equal(bad.data.listing.currency, 'HTG');
});

test('the pre-rename priceHTG field is still accepted', { skip }, async () => {
  const r = await asL('/api/listings', {
    method: 'POST',
    body: { title: `Legacy ${run}`, commune: 'Delmas', department: 'ouest', priceHTG: 60000, purpose: 'rent', lat: 18.5, lng: -72.3 },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.listing.price, 60000);
  assert.equal(r.data.listing.currency, 'HTG');
});
