// Sold / leased tags and the auto-deletion they schedule.
//
// The real delay is 48 hours, which no test can wait for. The server
// reads it from SOLD_DELETE_AFTER_MS (lib/config.js), so the suite starts
// the app with a couple of seconds instead. The sweep test skips when
// that variable is unset, rather than silently passing without having
// checked the thing it is named after.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const SWEEP_MS = Number(process.env.SOLD_DELETE_AFTER_MS);
const sweepSkip = skip || (!Number.isFinite(SWEEP_MS) && 'needs SOLD_DELETE_AFTER_MS on the server');

const run = uniq();
const L = { name: 'Sold Landlord', username: `slland_${run}`, password: 'pw-l', role: 'landlord' };
const T = { name: 'Sal Tenant', username: `sllten_${run}`, password: 'pw-t', role: 'tenant' };
const as = { L: client(), T: client() };
let admin;

async function newListing(title, purpose = 'rent') {
  const r = await as.L('/api/listings', {
    method: 'POST',
    body: { title, commune: 'Delmas', department: 'ouest', priceHTG: 40000, purpose, lat: 18.5, lng: -72.3 },
  });
  assert.equal(r.status, 200, `created ${title}`);
  return r.data.listing.id;
}

const myHomes = async () => (await as.L(`/api/listings?owner=${encodeURIComponent(L.username)}&all=1`)).data.listings || [];
const mine = async (id) => (await myHomes()).find((h) => h.id === id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  if (skip) return;
  assert.equal((await signup(as.L, L)).status, 200);
  assert.equal((await signup(as.T, T)).status, 200);
  admin = await adminClient();
  const p = await as.L('/api/payments', {
    method: 'POST',
    body: { kind: 'activation', provider: 'moncash', reference: `SLL${run}`.toUpperCase() },
  });
  await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed' } });
  assert.equal((await as.L('/api/accounts/me')).data.account.activated, true);
});

test('marking a home sold hides it from tenants at once and sets a deadline', { skip }, async () => {
  const id = await newListing(`Sold ${run}`, 'sale');
  const r = await as.L('/api/listings/sold', { method: 'POST', body: { id, status: 'sold' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.listing.status, 'sold');
  assert.ok(r.data.listing.soldAt > 0, 'soldAt recorded');
  assert.ok(r.data.listing.deletesAt > r.data.listing.soldAt, 'deletion is scheduled after the tag');

  // Gone for tenants immediately — no wasted mobile data on a sold home.
  assert.equal((await as.T(`/api/listings?id=${id}`)).status, 404);
  assert.ok(!((await as.T('/api/listings')).data.listings || []).some((l) => l.id === id), 'out of search');
  // Still the landlord's, with the countdown.
  assert.equal((await mine(id))?.status, 'sold');
});

test('leased is the same tag for a rental', { skip }, async () => {
  const id = await newListing(`Leased ${run}`);
  const r = await as.L('/api/listings/sold', { method: 'POST', body: { id, status: 'leased' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.listing.status, 'leased');
  assert.equal((await as.T(`/api/listings?id=${id}`)).status, 404);
});

test('only the owner may tag, and only with sold or leased', { skip }, async () => {
  const id = await newListing(`Perm ${run}`);
  assert.equal((await as.T('/api/listings/sold', { method: 'POST', body: { id, status: 'sold' } })).status, 403);
  assert.equal((await client()('/api/listings/sold', { method: 'POST', body: { id, status: 'sold' } })).status, 403);
  // Not a free-text status field: 'deleted' must not be reachable here.
  assert.equal((await as.L('/api/listings/sold', { method: 'POST', body: { id, status: 'deleted' } })).status, 400);
  assert.equal((await as.L('/api/listings/sold', { method: 'POST', body: { id, status: 'removed' } })).status, 400);
  assert.equal((await mine(id))?.status, 'active', 'still live after every refusal');
});

test('undo puts it back online and cancels the deletion', { skip }, async () => {
  const id = await newListing(`Undo ${run}`);
  await as.L('/api/listings/sold', { method: 'POST', body: { id, status: 'leased' } });
  const back = await as.L('/api/listings/restore', { method: 'POST', body: { id } });
  assert.equal(back.status, 200);
  assert.equal(back.data.listing.status, 'active');
  assert.equal(back.data.listing.soldAt, null, 'the clock is cleared, not just the status');
  assert.equal(back.data.listing.deletesAt, null);
  // Visible to tenants again.
  assert.equal((await as.T(`/api/listings?id=${id}`)).status, 200);
});

test('re-tagging does not restart the 48 hours', { skip }, async () => {
  const id = await newListing(`Retag ${run}`, 'sale');
  const first = await as.L('/api/listings/sold', { method: 'POST', body: { id, status: 'sold' } });
  const firstDue = first.data.listing.deletesAt;
  await sleep(1100);
  const second = await as.L('/api/listings/sold', { method: 'POST', body: { id, status: 'leased' } });
  assert.equal(second.data.listing.status, 'leased', 'the tag changed');
  assert.equal(second.data.listing.deletesAt, firstDue, 'but the deadline did not move');
});

test('the deadline passes and the home is deleted for good', { skip: sweepSkip }, async () => {
  const id = await newListing(`Sweep ${run}`, 'sale');
  // A tenant conversation, so we can see it go with the listing.
  assert.equal((await as.T('/api/chat', { method: 'POST', body: { listingId: id, text: 'Is it still free?' } })).status, 200);
  await as.L('/api/listings/sold', { method: 'POST', body: { id, status: 'sold' } });
  assert.ok(await mine(id), 'present while the window is open');

  await sleep(SWEEP_MS + 1500);
  // The sweep runs from the listing read paths, throttled to once a
  // minute — force it past the throttle by reading as the owner, which is
  // what a landlord opening their library does.
  for (let i = 0; i < 12 && (await mine(id)); i++) await sleep(5000);

  assert.equal(await mine(id), undefined, 'gone from the library');
  assert.equal((await as.T(`/api/listings?id=${id}`)).status, 404);
  // And it really was deleted, not just hidden: nothing to restore.
  assert.equal((await as.L('/api/listings/restore', { method: 'POST', body: { id } })).status, 404);
  assert.ok(!((await as.T('/api/chat/inbox')).data.threads || []).some((th) => th.listingId === id), 'its chat went too');
});

test('a home with a pending payment survives its deadline', { skip: sweepSkip }, async () => {
  const id = await newListing(`Pending ${run}`);
  const pay = await as.L('/api/payments', {
    method: 'POST',
    body: { kind: 'advertising', listingId: id, months: 1, provider: 'natcash', reference: `SLLAD${run}`.toUpperCase() },
  });
  assert.equal(pay.status, 200);
  await as.L('/api/listings/sold', { method: 'POST', body: { id, status: 'leased' } });
  await sleep(SWEEP_MS + 1500);
  // Several sweeps go by; the listing must still be here, because
  // deleting it would leave a payment the admin is about to review
  // pointing at nothing.
  for (let i = 0; i < 3; i++) { await myHomes(); await sleep(1200); }
  assert.ok(await mine(id), 'kept while a payment is pending review');

  // Once the admin rejects it, the next sweep may take the listing.
  await admin('/api/admin/payments', { method: 'POST', body: { id: pay.data.payment.id, decision: 'rejected' } });
  for (let i = 0; i < 12 && (await mine(id)); i++) await sleep(5000);
  assert.equal(await mine(id), undefined, 'deleted once nothing is pending');
});
