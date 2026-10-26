// Public location precision (Stage 2, B1 — owner-approved Oct 26:
// approximate by default, exact on contact; NO consent toggle).
//
// The public shape must not carry the free-text street address or the
// exact coordinates: it carries the commune plus an approximated pin
// (approxLat/approxLng, grid-quantized to ~440 m cells, max displacement
// ~300 m). The exact values stay in the owner and admin shapes, and are
// revealed to a tenant once the landlord replies in chat. No zone /
// neighbourhood field exists in the schema, so the public side publishes
// commune + approximated pin only — no invented field.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';
import { getDict } from '../lib/dictionaries.js';
import { distanceKm } from '../lib/geo.js';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Precision Landlord', username: `prec_${run}`, password: 'pw-l', role: 'landlord' };
const T = { name: 'Precision Tenant', username: `prect_${run}`, password: 'pw-t', role: 'tenant' };
const U = { name: 'Precision Bystander', username: `precu_${run}`, password: 'pw-t', role: 'tenant' };
const asL = client();
const asT = client();
const asU = client();
const anon = client();
let admin;
let id;
// Off-grid coords, so quantization visibly moves the pin.
const EXACT = { lat: 18.54321, lng: -72.34567 };
const ADDRESS = '12 Rue Test, Delmas 95';

async function confirmPayment(pid) {
  const r = await admin('/api/admin/payments', { method: 'POST', body: { id: pid, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
}

before(async () => {
  if (skip) return;
  assert.equal((await signup(asL, L)).status, 200);
  assert.equal((await signup(asT, T)).status, 200);
  assert.equal((await signup(asU, U)).status, 200);
  admin = await adminClient();
  const p = await asL('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'moncash', senderPhone: '30000044' } });
  assert.equal(p.status, 200);
  await confirmPayment(p.data.payment.id);
  assert.equal((await asL('/api/accounts/me')).data.account.activated, true);
  const listing = await asL('/api/listings', { method: 'POST', body: { title: `Precision ${run}`, commune: 'Delmas', department: 'ouest', price: 1, purpose: 'rent', address: ADDRESS, lat: EXACT.lat, lng: EXACT.lng } });
  assert.equal(listing.status, 200, JSON.stringify(listing.data));
  id = listing.data.listing.id;
});

test('anonymous shapes carry commune + approximated pin, never the exact address or coordinates', { skip }, async () => {
  const one = (await anon(`/api/listings?id=${id}`)).data.listing;
  assert.ok(!('address' in one), 'public detail must not carry address');
  assert.ok(!('lat' in one) && !('lng' in one), 'public detail must not carry exact coordinates');
  assert.equal(one.commune, 'Delmas');
  assert.equal(typeof one.approxLat, 'number');
  assert.equal(typeof one.approxLng, 'number');
  assert.ok(one.approxLat !== EXACT.lat || one.approxLng !== EXACT.lng, 'approximated pin differs from the exact pin');
  assert.ok(distanceKm(one.approxLat, one.approxLng, EXACT.lat, EXACT.lng) <= 0.5, 'approximated pin within 500 m of exact');
  const found = (await anon('/api/listings')).data.listings.find((l) => l.id === id);
  assert.ok(found, 'listing present in the anonymous list');
  assert.ok(!('address' in found) && !('lat' in found) && !('lng' in found), 'public list must not carry exact location');
  assert.equal(typeof found.approxLat, 'number');
});

test('owner Library and admin detail keep the exact address and coordinates', { skip }, async () => {
  const lib = (await asL(`/api/listings?owner=${L.username}&all=1`)).data.listings.find((l) => l.id === id);
  assert.ok(lib, 'listing present in the owner Library');
  assert.equal(lib.address, ADDRESS);
  assert.equal(lib.lat, EXACT.lat);
  assert.equal(lib.lng, EXACT.lng);
  const adm = (await admin(`/api/listings?id=${id}`)).data.listing;
  assert.equal(adm.address, ADDRESS);
  assert.equal(adm.lat, EXACT.lat);
  assert.equal(adm.lng, EXACT.lng);
});

test('a tenant sees exact location only after the landlord replies in chat', { skip }, async () => {
  const before = (await asT(`/api/listings?id=${id}`)).data.listing;
  assert.ok(!('address' in before) && !('lat' in before) && !('lng' in before), 'no exact location before any reply');
  assert.equal((await asT('/api/chat', { method: 'POST', body: { listingId: id, text: 'Bonjou, kay la toujou disponib?' } })).status, 200);
  const stillHidden = (await asT(`/api/listings?id=${id}`)).data.listing;
  assert.ok(!('address' in stillHidden), 'tenant message alone reveals nothing');
  assert.equal((await asL('/api/chat', { method: 'POST', body: { listingId: id, tenant: T.username, text: 'Wi, li disponib.' } })).status, 200);
  const after = (await asT(`/api/listings?id=${id}`)).data.listing;
  assert.equal(after.address, ADDRESS, 'exact address revealed after the landlord reply');
  assert.equal(after.lat, EXACT.lat);
  assert.equal(after.lng, EXACT.lng);
  const bystander = (await asU(`/api/listings?id=${id}`)).data.listing;
  assert.ok(!('address' in bystander) && !('lat' in bystander), 'another tenant still sees nothing exact');
});

test('the post/edit form warning exists in all three locales', { skip }, async () => {
  for (const locale of ['ht', 'fr', 'en']) {
    const note = getDict(locale).locationPrivacyNote;
    assert.equal(typeof note, 'string');
    assert.ok(note.length > 20, `${locale} warning is a real sentence`);
  }
});
