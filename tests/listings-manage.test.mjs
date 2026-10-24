// Landlord listing management: deleting a home for good, and the view
// counter the landlord sees.
//
// Delete is the one irreversible action in the app, so these tests pin
// down exactly what it removes and what it must NOT remove: the payment
// ledger has to survive, because money is a ledger.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, ADMIN_PASSWORD, client, signup, adminClient, uniq, haitiDate } from './helpers.mjs';

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
    body: { kind: 'activation', provider: 'moncash', senderPhone: '30000020' },
  });
  assert.equal(p.status, 200);
  await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
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

test('deleting leaves the conversation: landlord out, tenant keeps it', { skip }, async () => {
  const id = await newListing(`Chatty ${run}`);
  assert.equal((await as.T('/api/chat', { method: 'POST', body: { listingId: id, text: 'Still available?' } })).status, 200);
  assert.ok(((await as.L('/api/chat/inbox')).data.threads || []).some((th) => th.listingId === id), 'landlord sees the thread');

  const del = await as.L('/api/listings/delete', { method: 'POST', body: { id } });
  assert.equal(del.status, 200);
  assert.ok(del.data.removed.conversationsClosed >= 1, 'the conversation was closed, not deleted');

  // The landlord left: it drops out of THEIR inbox.
  assert.ok(!((await as.L('/api/chat/inbox')).data.threads || []).some((th) => th.listingId === id), 'gone from the landlord inbox');

  // The tenant keeps their history. This is the whole point: a landlord
  // tidying their library must not erase what a tenant wrote.
  const mineThread = ((await as.T('/api/chat/inbox')).data.threads || []).find((th) => th.listingId === id);
  assert.ok(mineThread, 'tenant still has the thread');
  assert.equal(mineThread.closed, true, 'marked closed');
  assert.equal(mineThread.landlordLeft, true, 'landlord is out of the conversation');
  assert.equal(mineThread.listingTitle, `Chatty ${run}`, 'still named, from the conversation');

  // Readable...
  const read = await as.T(`/api/chat?listingId=${encodeURIComponent(id)}`);
  assert.equal(read.status, 200);
  assert.equal(read.data.messages.length, 1);
  assert.equal(read.data.messages[0].text, 'Still available?');
  assert.equal(read.data.landlordLeft, true);
  // ...but closed to new messages, with a reason the UI can show.
  const write = await as.T('/api/chat', { method: 'POST', body: { listingId: id, text: 'hello?' } });
  assert.equal(write.status, 409);
  assert.equal(write.data.error, 'landlord_left');

  // Marking it read still works, and nobody else can reach it.
  assert.equal((await as.T('/api/chat/read', { method: 'POST', body: { listingId: id } })).status, 200);
  const other = client();
  assert.equal((await other('/api/chat', { method: 'POST', body: { listingId: id, text: 'hi' } })).status, 401);
});

test('a deleted home keeps the tenant visit record too', { skip }, async () => {
  const id = await newListing(`Visited ${run}`);
  const v = await as.T('/api/visits', {
    method: 'POST',
    body: { listingId: id, date: haitiDate(3), time: '10:00', message: 'can I see it' },
  });
  assert.equal(v.status, 200);
  assert.equal((await as.L('/api/listings/delete', { method: 'POST', body: { id } })).status, 200);
  // The tenant's own appointment record survives, with the home's name.
  const mine = (await as.T('/api/visits')).data.visits || [];
  const kept = mine.find((x) => x.listingId === id);
  assert.ok(kept, 'visit kept');
  assert.equal(kept.listingTitle, `Visited ${run}`);
});

test('the payment ledger survives a deleted listing', { skip }, async () => {
  const id = await newListing(`Paid ${run}`);
  const pay = await as.L('/api/payments', {
    method: 'POST',
    body: { kind: 'advertising', listingId: id, months: 1, provider: 'natcash', senderPhone: '30000021' },
  });
  assert.equal(pay.status, 200);
  // A pending payment blocks deletion: confirming it later would extend
  // advertising on a home that no longer exists.
  const blocked = await as.L('/api/listings/delete', { method: 'POST', body: { id } });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.data.error, 'payment_pending');

  await admin('/api/admin/payments', { method: 'POST', body: { id: pay.data.payment.id, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
  const before = (await admin('/api/admin/payments')).data.summary.byKind.advertising.confirmedHTG;

  assert.equal((await as.L('/api/listings/delete', { method: 'POST', body: { id } })).status, 200);

  // The money is still counted, and the record is still the landlord's.
  const after = (await admin('/api/admin/payments')).data.summary.byKind.advertising.confirmedHTG;
  assert.equal(after, before, 'confirmed advertising revenue unchanged');
  assert.ok((await as.L('/api/payments')).data.payments.some((p) => p.senderPhone === '+50930000021'));
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

test('view counts are public: everyone sees the number the owner sees', { skip }, async () => {
  const id = await newListing(`Seen-public ${run}`);
  const anon = client();
  await anon('/api/listings/view', { method: 'POST', body: { id, visitor: `v-p-${run}` } });
  // The owner's library and every public shape carry the same number.
  assert.equal((await myHomes()).find((h) => h.id === id)?.views, 1);
  assert.equal((await anon(`/api/listings?id=${id}`)).data.listing.views, 1, 'public detail');
  const pub = (await anon('/api/listings')).data.listings.find((l) => l.id === id);
  assert.equal(pub?.views, 1, 'public list');
  // The detail page shows it; the sold-home deletion clock stays private.
  const page = (await (await fetch(`${BASE}/en/listings/${id}`)).text()).replace(/<!-- -->/g, '');
  assert.match(page, /👁 1 views/);
  assert.equal((await anon(`/api/listings?id=${id}`)).data.listing.deletesAt, undefined);
});
