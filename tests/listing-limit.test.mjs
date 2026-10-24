// Per-account listing limit (0015): the admin caps how many homes an
// account (e.g. a partner posting for other people) may have live.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, sha, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const U = `lim_${run}`;
let admin;
let partner;
const home = (n) => ({ title: `Limit ${run} ${n}`, commune: 'Delmas', department: 'ouest', priceHTG: 1, purpose: 'rent', lat: 18.5, lng: -72.3 });
const post = (n) => partner('/api/listings', { method: 'POST', body: home(n) });
const setLimit = (limit, who = admin) => who('/api/admin/listing-limit', { method: 'POST', body: { username: U, limit } });
const usage = async () => (await partner('/api/accounts/me')).data.account.listings;

before(async () => {
  if (skip) return;
  admin = await adminClient();
  // A partner account, as the admin creates them (no sign-up limit, free).
  const made = await admin('/api/admin/partner', { method: 'POST', body: { name: 'Lim Partner', username: U, passwordHash: sha('pw'), phone: '+509 0000 0000', location: { department: 'ouest', commune: 'Delmas' } } });
  assert.equal(made.status, 200, JSON.stringify(made.data));
  partner = client();
  assert.equal((await partner('/api/accounts/signin', { method: 'POST', body: { username: U, passwordHash: sha('pw') } })).status, 200);
});

test('no limit by default: nothing changes until the admin sets one', { skip }, async () => {
  assert.deepEqual(await usage(), { limit: null, used: 0 });
  assert.equal((await post(1)).status, 200);
  assert.deepEqual(await usage(), { limit: null, used: 1 });
});

test('only the admin can set a limit; bad values are refused', { skip }, async () => {
  assert.equal((await setLimit(2, partner)).status, 401);
  assert.equal((await setLimit(-1)).status, 400);
  assert.equal((await setLimit('abc')).status, 400);
  const ok = await setLimit(2);
  assert.equal(ok.status, 200);
  assert.deepEqual({ limit: ok.data.limit, used: ok.data.used }, { limit: 2, used: 1 });
});

test('posting stops at the limit, with a clear error', { skip }, async () => {
  assert.equal((await post(2)).status, 200);
  const third = await post(3);
  assert.equal(third.status, 403);
  assert.deepEqual({ e: third.data.error, l: third.data.limit, u: third.data.used }, { e: 'listing_limit', l: 2, u: 2 });
  assert.deepEqual(await usage(), { limit: 2, used: 2 });
});

test('taking a home down frees a slot; restoring checks the limit again', { skip }, async () => {
  const mine = (await partner(`/api/listings?owner=${U}&all=1`)).data.listings.filter((l) => l.status === 'active');
  assert.equal((await partner('/api/listings/takedown', { method: 'POST', body: { id: mine[0].id } })).status, 200);
  assert.deepEqual(await usage(), { limit: 2, used: 1 });
  assert.equal((await post(4)).status, 200, 'the freed slot can be used');
  // Now full again: restoring the taken-down home is refused for the owner…
  const r = await partner('/api/listings/restore', { method: 'POST', body: { id: mine[0].id } });
  assert.equal(r.status, 403);
  assert.equal(r.data.error, 'listing_limit');
  // …but the admin, who sets limits, may restore it anyway.
  assert.equal((await admin('/api/listings/restore', { method: 'POST', body: { id: mine[0].id } })).status, 200);
  assert.deepEqual(await usage(), { limit: 2, used: 3 });
});

test('lowering a limit removes nothing; clearing it lifts the cap', { skip }, async () => {
  assert.equal((await setLimit(1)).status, 200);
  assert.equal((await usage()).used, 3, 'existing homes stay live');
  assert.equal((await post(5)).status, 403);
  assert.equal((await setLimit(null)).status, 200);
  assert.equal((await post(5)).status, 200);
  assert.deepEqual(await usage(), { limit: null, used: 4 });
});

test('two posts at the same moment cannot both take the last slot', { skip }, async () => {
  const used = (await usage()).used;
  assert.equal((await setLimit(used + 1)).status, 200);
  const [a, b] = await Promise.all([post('race-a'), post('race-b')]);
  assert.deepEqual([a.status, b.status].sort(), [200, 403]);
  assert.equal((await usage()).used, used + 1);
});

test('the admin accounts list shows usage and limit', { skip }, async () => {
  const list = await admin(`/api/accounts?q=${U}`);
  const a = (list.data.accounts || []).find((x) => x.username === U);
  assert.ok(a, JSON.stringify(list.data).slice(0, 200));
  assert.equal(typeof a.liveListings, 'number');
  assert.ok('listingLimit' in a);
});

test('an account location comes back as { department, commune }, not text', { skip }, async () => {
  const me = (await partner('/api/accounts/me')).data.account;
  assert.deepEqual(me.location, { department: 'ouest', commune: 'Delmas' });
});
