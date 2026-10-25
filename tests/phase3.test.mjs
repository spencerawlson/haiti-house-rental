// Phase 3 regression tests: structured details (sanitized, owner-only
// edits), admin-only verification, and newest-first default order.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD (activated landlord + admin)';
const run = uniq();
const L = { name: 'Lou Landlord', username: `p3land_${run}`, password: 'pw-l', role: 'landlord' };
const T = { name: 'Tim Tenant', username: `p3ten_${run}`, password: 'pw-t', role: 'tenant' };
const as = { L: client(), T: client() };
let admin;
const base = { commune: 'Delmas', department: 'ouest', price: 3000, purpose: 'rent', lat: 18.5, lng: -72.3 };

before(async () => {
  if (skip) return;
  assert.equal((await signup(as.L, L)).status, 200);
  assert.equal((await signup(as.T, T)).status, 200);
  admin = await adminClient();
  await admin('/api/admin/activate', { method: 'POST', body: { username: L.username, activated: true } });
});

test('details are sanitized on create and editable only by the owner', { skip }, async () => {
  const r = await as.L('/api/listings', { method: 'POST', body: { ...base, title: `Detail ${run}`, verified: true, details: { water: 'cistern', power24: true, security: ['guard', 'laser'], hack: 1 } } });
  assert.equal(r.status, 200);
  const id = r.data.listing.id;
  assert.deepEqual(r.data.listing.details, { water: 'cistern', power24: true, security: ['guard'] });
  assert.equal(r.data.listing.verified, false, 'a landlord cannot self-verify');
  const t = await as.T('/api/listings', { method: 'PATCH', body: { id, title: 'x', commune: 'Delmas', details: { water: 'well' } } });
  assert.equal(t.status, 403);
  const p = await as.L('/api/listings', { method: 'PATCH', body: { id, title: `Detail ${run}`, commune: 'Delmas', verified: true, details: { furnished: 'furnished', parking: 2 } } });
  assert.equal(p.status, 200);
  assert.deepEqual(p.data.listing.details, { furnished: 'furnished', parking: 2 });
  assert.equal(p.data.listing.verified, false);
});

test('only the admin verifies a listing', { skip }, async () => {
  const r = await as.L('/api/listings', { method: 'POST', body: { ...base, title: `Verify ${run}` } });
  const id = r.data.listing.id;
  assert.equal((await as.L('/api/admin/verify', { method: 'POST', body: { id, verified: true } })).status, 401);
  const v = await admin('/api/admin/verify', { method: 'POST', body: { id, verified: true } });
  assert.equal(v.data.listing.verified, true);
  const pub = await as.T(`/api/listings?id=${id}`);
  assert.equal(pub.data.listing.verified, true);
});

test('search shows the newest real listing first by default', { skip }, async () => {
  const older = await as.L('/api/listings', { method: 'POST', body: { ...base, title: `Older-${run}` } });
  await new Promise((r) => setTimeout(r, 20));
  const newer = await as.L('/api/listings', { method: 'POST', body: { ...base, title: `Newer-${run}` } });
  assert.equal(older.status, 200);
  assert.equal(newer.status, 200);
  const html = await (await fetch(`${BASE}/en/listings`)).text();
  const iNew = html.indexOf(`Newer-${run}`);
  const iOld = html.indexOf(`Older-${run}`);
  assert.ok(iNew > -1 && iOld > -1, 'both listings shown');
  assert.ok(iNew < iOld, 'newest first');
  // Real listings come before the demo seeds ("Kay" demos have no owner).
  const api = await as.T('/api/listings');
  const firstSeed = api.data.listings.findIndex((l) => l.seed);
  const lastReal = api.data.listings.map((l) => !l.seed).lastIndexOf(true);
  if (firstSeed !== -1) assert.ok(lastReal < firstSeed);
});

test('demo listings are hidden from search and by direct link', async () => {
  const { SEED_LISTINGS } = await import('../lib/seed-listings.js');
  const api = await (await fetch(`${BASE}/api/listings`)).json();
  assert.ok(!api.listings.some((l) => l.seed), 'no demo listing in search');
  const direct = await fetch(`${BASE}/api/listings?id=${encodeURIComponent(SEED_LISTINGS[0].id)}`);
  assert.equal(direct.status, 404);
  const page = await fetch(`${BASE}/en/listings/${encodeURIComponent(SEED_LISTINGS[0].id)}`);
  assert.equal(page.status, 404);
});
