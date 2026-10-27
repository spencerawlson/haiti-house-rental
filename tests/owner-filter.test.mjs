// "My listings" counts only my listings — also in a browser that is
// signed in to the Admin Board. The admin cookie used to make
// /api/listings ignore ?owner=, so the account page of a landlord who
// was also the admin counted every home on the site as theirs.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, sha, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const owners = [`own_a_${run}`, `own_b_${run}`];
let admin;

before(async () => {
  if (skip) return;
  admin = await adminClient();
  for (const [i, u] of owners.entries()) {
    assert.equal((await admin('/api/admin/partner', { method: 'POST', body: { name: `Owner ${i}`, username: u, passwordHash: sha('pw'), phone: '+509 0000 0000', location: { department: 'ouest', commune: 'Delmas' } } })).status, 200);
    const c = client();
    const signin = await c('/api/accounts/signin', { method: 'POST', body: { username: u, passwordHash: sha('pw') } });
    assert.equal(signin.status, 200);
    const l = await c('/api/listings', { method: 'POST', body: { title: `Owner test ${i} ${run}`, description: 'Kay pou tès.', commune: 'Delmas', department: 'ouest', price: 40000, priceHTG: 40000, currency: 'HTG', purpose: 'rent', bedrooms: 1, bathrooms: 1, lat: 18.54, lng: -72.3 } });
    assert.equal(l.status, 200, JSON.stringify(l.data));
  }
});

test('?owner= returns only that owner\'s homes, with or without the admin cookie', { skip }, async () => {
  const anon = await client()(`/api/listings?owner=${owners[0]}`);
  assert.equal(anon.status, 200);
  assert.deepEqual([...new Set(anon.data.listings.map((l) => l.owner))], [owners[0]]);
  assert.equal(anon.data.listings.length, 1);

  // A browser holding the admin cookie (the owner who is also the admin).
  const asAdmin = await client(admin.cookie)(`/api/listings?owner=${owners[0]}`);
  assert.equal(asAdmin.status, 200);
  assert.equal(asAdmin.data.listings.length, 1, `got ${asAdmin.data.listings.length} homes, owners ${[...new Set(asAdmin.data.listings.map((l) => l.owner))]}`);
  assert.equal(asAdmin.data.listings[0].owner, owners[0]);

  // Without ?owner=, the admin still gets the whole site (the Admin Board).
  const all = await client(admin.cookie)('/api/listings');
  const mine = all.data.listings.filter((l) => owners.includes(l.owner));
  assert.equal(mine.length, 2, 'both test owners are in the full admin list');
});
