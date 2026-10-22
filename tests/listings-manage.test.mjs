// Landlord listing management: deleting a home for good, and the view
// counter the landlord sees.
//
// Delete is the one irreversible action in the app, so these tests pin
// down exactly what it removes and what it must NOT remove: the payment
// ledger has to survive, because money is a ledger.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Del Landlord', username: `dmland_${run}`, password: 'pw-l', role: 'landlord' };
const T = { name: 'Dee Tenant', username: `dmten_${run}`, password: 'pw-t', role: 'tenant' };
const as = { L: client(), T: client() };
let admin;

const ref = (s) => `${s}${run}`.toUpperCase();

async function newListing(title) {
  const r = await as.L('/api/listings', {
    method: 'POST',
    body: { title, commune: 'Delmas', department: 'ouest', priceHTG: 50000, purpose: 'rent', lat: 18.5, lng: -72.3 },
  });
  assert.equal(r.status, 200, `created ${title}`);
  return r.data.listing.id;
}

async function myHomes() {
  const r = await as.L(`/api/listings?owner=${encodeURIComponent(L.username)}&all=1`);
  return r.data.listings || [];
}

before(async () => {
  if (skip) return;
  assert.equal((await signup(as.L, L)).status, 200);
  assert.equal((await signup(as.T, T)).status, 200);
  admin = await adminClient();
  // The landlord must be activated before it can post.
  const p = await as.L('/api/payments', {
    method: 'POST',
    body: { kind: 'activation', provider: 'moncash', reference: ref('DMACT') },
  });
  assert.equal(p.status, 200);
  await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed' } });
  assert.equal((await as.L('/api/accounts/me')).data.account.activated, true);
});

test('only the owner may delete a listing', { skip }, async () => {
  const id = await newListing(`Perms ${run}`);
  const anon = client();
  assert.equal((await anon('/api/listings/delete', { method: 'POST', body: { id } })).status, 403);
  assert.equal((await as.T('/api/listings/delete', { method: 'POST', body: { id } })).status, 403);
  // Still there after both refusals.
  assert.equal((await as.T(`/api/listings?id=${id}`)).status, 200);
});

test('delete removes the listing for good, and a taken-down home can be deleted', { skip }, async () => {
  const id = await newListing(`Gone ${run}`);
  // Take it down first — the usual path for a home that is no longer free.
  assert.equal((await as.L('/api/listings/takedown', { method: 'POST', body: { id } })).status, 200);
  assert.ok((await myHomes()).some((h) => h.id === id), 'taken down, still in the library');

  const del = await as.L('/api/listings/delete', { method: 'POST', body: { id } });
  assert.equal(del.status, 200);
  assert.equal(del.data.removed.listing, 1);

  // Gone from the library, from the public API, and not restorable.
  assert.ok(!(await myHomes()).some((h) => h.id === id), 'left the library');
  assert.equal((await as.T(`/api/listings?id=${id}`)).status, 404);
  assert.equal((await as.L('/api/listings/restore', { method: 'POST', body: { id } })).status, 404);
  assert.equal((await as.L('/api/listings/delete', { method: 'POST', body: { id } })).status, 404);
});

test('deleting takes its conversations and visits with it', { skip }, async () => {
  const id = await newListing(`Chatty ${run}`);
  // A tenant writes, and asks to visit.
  assert.equal((await as.T('/api/chat', { method: 'POST', body: { listingId: id, text: 'Still available?' } })).status, 200);
  const inboxBefore = (await as.L('/api/chat/inbox')).data.threads || [];
  assert.ok(inboxBefore.some((th) => th.listingId === id), 'landlord sees the thread');

  const del = await as.L('/api/listings/delete', { method: 'POST', body: { id } });
  assert.equal(del.status, 200);
  assert.ok(del.data.removed.messages >= 1, 'messages deleted');

  // Gone for BOTH sides — the tenant loses the history too.
  assert.ok(!((await as.L('/api/chat/inbox')).data.threads || []).some((th) => th.listingId === id));
  assert.ok(!((await as.T('/api/chat/inbox')).data.threads || []).some((th) => th.listingId === id));
});

test('the payment ledger survives a deleted listing', { skip }, async () => {
  const id = await newListing(`Paid ${run}`);
  const pay = await as.L('/api/payments', {
    method: 'POST',
    body: { kind: 'advertising', listingId: id, months: 1, provider: 'natcash', reference: ref('DMAD') },
  });
  assert.equal(pay.status, 200);
  // A pending payment blocks deletion: confirming it later would extend
  // advertising on a home that no longer exists.
  const blocked = await as.L('/api/listings/delete', { method: 'POST', body: { id } });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.data.error, 'payment_pending');

  await admin('/api/admin/payments', { method: 'POST', body: { id: pay.data.payment.id, decision: 'confirmed' } });
  const before = (await admin('/api/admin/payments')).data.summary.byKind.advertising.confirmedHTG;

  assert.equal((await as.L('/api/listings/delete', { method: 'POST', body: { id } })).status, 200);

  // The money is still counted, and the record is still the landlord's.
  const after = (await admin('/api/admin/payments')).data.summary.byKind.advertising.confirmedHTG;
  assert.equal(after, before, 'confirmed advertising revenue unchanged');
  assert.ok((await as.L('/api/payments')).data.payments.some((p) => p.reference === ref('DMAD')));
});

test('views: counted once per viewer, never the owner', { skip }, async () => {
  const id = await newListing(`Seen ${run}`);
  const views = async () => (await myHomes()).find((h) => h.id === id)?.views;
  assert.equal(await views(), 0, 'starts at zero');

  // The owner looking at their own home is not traffic.
  await as.L('/api/listings/view', { method: 'POST', body: { id, visitor: 'owner-box' } });
  assert.equal(await views(), 0, 'owner view ignored');

  // A tenant counts once, then is de-duplicated inside the window.
  await as.T('/api/listings/view', { method: 'POST', body: { id, visitor: 'v-tenant' } });
  assert.equal(await views(), 1);
  await as.T('/api/listings/view', { method: 'POST', body: { id, visitor: 'v-tenant' } });
  assert.equal(await views(), 1, 'same viewer does not count twice');

  // A different anonymous visitor is a different person.
  const anon = client();
  await anon('/api/listings/view', { method: 'POST', body: { id, visitor: `v-anon-${run}` } });
  assert.equal(await views(), 2);

  // A missing or unknown listing is accepted silently, never an error.
  assert.equal((await anon('/api/listings/view', { method: 'POST', body: { id: 'nope' } })).status, 200);
});

test('view counts are private to the owner', { skip }, async () => {
  const id = await newListing(`Private ${run}`);
  const anon = client();
  await anon('/api/listings/view', { method: 'POST', body: { id, visitor: `v-p-${run}` } });
  // The public shapes must not carry the number.
  assert.equal((await as.T(`/api/listings?id=${id}`)).data.listing.views, undefined);
  const pub = (await as.T('/api/listings')).data.listings.find((l) => l.id === id);
  assert.equal(pub?.views, undefined, 'not in the public list either');
  // The owner does see it.
  assert.equal((await myHomes()).find((h) => h.id === id)?.views, 1);
});
