// Account engagement figures on the Admin Board (migration 0008).
//
// These are the numbers the admin reads to decide who is active, so the
// tests pin down both that they are counted and that they are admin-only:
// a login history is a behavioural record, not public profile data.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq, haitiDate, sha } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Met Landlord', username: `mtland_${run}`, password: 'pw-l', role: 'landlord' };
const T = { name: 'Met Tenant', username: `mtten_${run}`, password: 'pw-t', role: 'tenant' };
const as = { L: client(), T: client() };
let admin;

const metricsFor = async (username) => {
  const r = await admin('/api/accounts');
  const a = (r.data.accounts || []).find((x) => x.username === username);
  return a ? a.metrics : undefined;
};

before(async () => {
  if (skip) return;
  assert.equal((await signup(as.L, L)).status, 200);
  assert.equal((await signup(as.T, T)).status, 200);
  admin = await adminClient();
});

test('signing up counts as a login and sets last seen', { skip }, async () => {
  const m = await metricsFor(T.username);
  assert.ok(m, 'metrics present on the admin list');
  assert.equal(m.logins, 1, 'the signup session counted once');
  assert.equal(m.activeSessions, 1, 'and it is still open');
  assert.ok(m.lastSeenAt > 0, 'last seen recorded');
  assert.ok(Date.now() - m.lastSeenAt < 120000, 'and it is recent');
});

test('each sign-in adds a login; signing out closes it', { skip }, async () => {
  const before = (await metricsFor(T.username)).logins;
  const second = client();
  assert.equal((await second('/api/accounts/signin', { method: 'POST', body: { username: T.username, passwordHash: sha(T.password) } })).status, 200);
  const after = await metricsFor(T.username);
  assert.equal(after.logins, before + 1, 'counted the new sign-in');
  assert.equal(after.activeSessions, 2, 'two sessions open');

  assert.equal((await second('/api/accounts/signout', { method: 'POST' })).status, 200);
  const closed = await metricsFor(T.username);
  assert.equal(closed.logins, before + 1, 'signing out does not erase the history');
  assert.equal(closed.activeSessions, 1, 'but the session is no longer open');
  assert.ok(closed.avgSessionMs !== null, 'a finished session gives an average length');
});

test('the presence ping keeps last seen moving', { skip }, async () => {
  const before = (await metricsFor(T.username)).lastSeenAt;
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal((await as.T('/api/presence', { method: 'POST', body: { visitor: `v-${run}` } })).status, 200);
  const after = (await metricsFor(T.username)).lastSeenAt;
  assert.ok(after > before, `last seen advanced (${before} -> ${after})`);
});

test('visit appointments are counted for both sides, live and not', { skip }, async () => {
  // Activate the landlord so it can post.
  const pay = await as.L('/api/payments', {
    method: 'POST',
    body: { kind: 'activation', provider: 'moncash', senderPhone: '30000010' },
  });
  await admin('/api/admin/payments', { method: 'POST', body: { id: pay.data.payment.id, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
  const made = await as.L('/api/listings', {
    method: 'POST',
    body: { title: `Metrics ${run}`, commune: 'Delmas', department: 'ouest', price: 1000, purpose: 'rent' },
  });
  const id = made.data.listing.id;

  const v = await as.T('/api/visits', { method: 'POST', body: { listingId: id, date: haitiDate(4), time: '11:00' } });
  assert.equal(v.status, 200);

  // The tenant who asked and the landlord who owns it both show one.
  const mt = await metricsFor(T.username);
  const ml = await metricsFor(L.username);
  assert.equal(mt.visits, 1, 'tenant side counted');
  assert.equal(mt.visitsActive, 1, 'and it is still open');
  assert.equal(ml.visits, 1, 'landlord side counted');

  // Cancelling keeps it in the total but drops it from the live count —
  // "live or not" means the total does not shrink.
  const cancel = await as.T('/api/visits/status', { method: 'POST', body: { id: v.data.visit.id, action: 'cancel' } });
  assert.equal(cancel.status, 200);
  const after = await metricsFor(T.username);
  assert.equal(after.visits, 1, 'still counted in the total');
  assert.equal(after.visitsActive, 0, 'no longer live');
});

test('engagement figures are admin-only', { skip }, async () => {
  // The public profile lookup must not carry them...
  const pub = await as.T(`/api/accounts?username=${encodeURIComponent(L.username)}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.data.account.metrics, undefined, 'not in a public profile');
  assert.equal(pub.data.account.phone, undefined, 'and still no phone');
  // ...nor your own profile, which is not where this belongs.
  assert.equal((await as.T('/api/accounts/me')).data.account.metrics, undefined, 'not in /me');
  // The full list stays gated.
  assert.equal((await as.T('/api/accounts')).status, 401, 'full list needs the admin gate');
  assert.equal((await client()('/api/accounts')).status, 401);
});
