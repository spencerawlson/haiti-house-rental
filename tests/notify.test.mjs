// Notifications: a visit request lands in the landlord's inbox (and only
// theirs), answers land in the tenant's, unread counts and mark-read work.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, haitiDate, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Nora Landlord', username: `nland_${run}`, password: 'pw-l', role: 'landlord' };
const T = { name: 'Nico Tenant', username: `nten_${run}`, password: 'pw-t', role: 'tenant' };
const X = { name: 'Xena Other', username: `nother_${run}`, password: 'pw-x', role: 'tenant' };
const as = { L: client(), T: client(), X: client() };
let listingId;

const waitFor = async (fn) => {
  for (let i = 0; i < 30; i++) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
};

before(async () => {
  if (skip) return;
  for (const [k, u] of [['L', L], ['T', T], ['X', X]]) assert.equal((await signup(as[k], u)).status, 200);
  const admin = await adminClient();
  await admin('/api/admin/activate', { method: 'POST', body: { username: L.username, activated: true } });
  const r = await as.L('/api/listings', { method: 'POST', body: { title: `Notify ${run}`, commune: 'Delmas', department: 'ouest', price: 1, purpose: 'rent', lat: 18.5, lng: -72.3 } });
  listingId = r.data.listing.id;
});

test('visit request and answer notify the right person only', { skip }, async () => {
  const v = await as.T('/api/visits', { method: 'POST', body: { listingId, date: haitiDate(2), time: '10:00' } });
  assert.equal(v.status, 200);
  const inbox = await waitFor(async () => {
    const r = await as.L('/api/notifications');
    return r.data.notifications.find((n) => n.kind === 'visit_proposed') ? r.data : null;
  });
  assert.ok(inbox, 'landlord got visit_proposed');
  assert.equal(inbox.unread, 1);
  const n = inbox.notifications[0];
  assert.equal(n.params.name, 'Nico');
  assert.equal(n.link, `/ht/listings/${listingId}`);
  // Nobody else sees it.
  assert.equal((await as.X('/api/notifications')).data.notifications.length, 0);
  assert.equal((await as.T('/api/notifications')).data.notifications.length, 0);
  // Mark read.
  assert.equal((await as.L('/api/notifications/read', { method: 'POST' })).status, 200);
  assert.equal((await as.L('/api/notifications')).data.unread, 0);
  // The landlord confirms: the tenant is told.
  await as.L('/api/visits/status', { method: 'POST', body: { id: v.data.visit.id, action: 'confirm' } });
  const t = await waitFor(async () => (await as.T('/api/notifications')).data.notifications.find((x) => x.kind === 'visit_confirmed'));
  assert.ok(t, 'tenant got visit_confirmed');
});

test('chat messages do not fill the in-app inbox (the Messages tab counts them)', { skip }, async () => {
  await as.T('/api/chat', { method: 'POST', body: { listingId, text: 'hello' } });
  await new Promise((r) => setTimeout(r, 400));
  const kinds = (await as.L('/api/notifications')).data.notifications.map((n) => n.kind);
  assert.ok(!kinds.includes('chat'));
});

test('signed-out users get an empty inbox; channel status is admin-only', async () => {
  const anon = client();
  assert.deepEqual((await anon('/api/notifications')).data, { notifications: [], unread: 0 });
  assert.equal((await anon('/api/admin/notify-status')).status, 401);
});
