// Seller accounts + the structured Shop (Nov 2026, free-forever pivot).
//
// Rules under test: public seller signup is CLOSED — POST /api/accounts
// with role 'seller' returns 400 {error:'seller_signup_closed'}.
// Spencer is the sole seller: his seller account is created by the
// admin partner route (role 'seller', partner=true) and can post
// furniture. A non-partner seller — one that predates the pivot —
// cannot post: 403 {error:'seller_not_allowed'}. Sellers post
// furniture items (kind='furniture') with exactly one section and
// one category, and those items never appear in house search,
// listings, or the map feed; the Shop page shows sections first and
// filters to one section; empty sections say so plainly; no
// furniture purchase payment exists in v1 (browse + contact seller).
// The Shop is visible (SHOW_SHOP=true). Nobody pays anything any
// more: landlords and the founder seller are active at signup /
// creation, with paid_until NULL.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, ADMIN_PASSWORD, client, signup, adminClient, uniq, sha } from './helpers.mjs';
import { createServerAccount } from '../lib/accounts-server.js';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Leo Landlord', username: `leo_${run}`, password: 'pw-l', role: 'landlord' };
// The founder's seller account, created by the admin partner route.
const S = { name: 'Sara Seller', username: `sara_${run}`, password: 'pw-s', role: 'seller' };
const as = { S: client(), L: client() };
let admin;

async function signInRaw(username, password) {
  const res = await fetch(`${BASE}/api/accounts/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, passwordHash: sha(password) }),
  });
  const cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  return { status: res.status, cookie, data: await res.json().catch(() => null) };
}

before(async () => {
  if (skip) return;
  admin = await adminClient();
});

test('public seller signup is closed; the founder seller comes from the admin partner route', { skip }, async () => {
  const closed = await signup(client(), { name: 'Sara Seller', username: S.username, password: S.password, role: 'seller' });
  assert.equal(closed.status, 400, 'seller signup refused');
  assert.equal(closed.data.error, 'seller_signup_closed');

  const founder = await admin('/api/admin/partner', {
    method: 'POST',
    body: { name: S.name, username: S.username, phone: '+509 3000 0002', passwordHash: sha(S.password), role: 'seller' },
  });
  assert.equal(founder.status, 200, JSON.stringify(founder.data));
  assert.equal(founder.data.account.role, 'seller');
  assert.equal(founder.data.account.partner, true, 'the founder seller is a partner account');
  assert.equal(founder.data.account.activated, true, 'active at creation, no payment');
  assert.equal(founder.data.account.billingStatus, 'active');
  assert.equal(founder.data.account.paidUntil, null);
  assert.equal(founder.data.account.promoTagged, false);

  // The partner route does not sign in: sign in for a session.
  const logged = await signInRaw(S.username, S.password);
  assert.equal(logged.status, 200, JSON.stringify(logged.data));
  as.S = client(logged.cookie);

  // And a landlord signs up free and active at once, no payment.
  const landlordRes = await signup(as.L, L);
  assert.equal(landlordRes.status, 200);
  const landlordMe = (await as.L('/api/accounts/me')).data.account;
  assert.equal(landlordMe.role, 'landlord');
  assert.equal(landlordMe.activated, true);
  assert.equal(landlordMe.billingStatus, 'active');
  assert.equal(landlordMe.paidUntil, null);
  assert.equal(landlordMe.promoTagged, false);
});

test('a non-partner seller cannot post furniture; the founder seller can', { skip }, async () => {
  // A public seller predating the pivot: created directly, partner=false.
  // (Public signup is closed, so the HTTP routes cannot make one.)
  const legacy = await createServerAccount({
    name: 'Legacy Seller', username: `legacy_${run}`, passwordHash: sha('pw-legacy'),
    phone: '+509 3000 0003', role: 'seller', partner: false,
  });
  assert.ok(legacy, 'legacy seller created');
  assert.equal(legacy.partner, false);
  const logged = await signInRaw(`legacy_${run}`, 'pw-legacy');
  assert.equal(logged.status, 200, JSON.stringify(logged.data));
  const legacyClient = client(logged.cookie);
  const blocked = await legacyClient('/api/listings', {
    method: 'POST',
    body: {
      title: `Zòrye ansyen ${run}`, description: 'Zòrye fèt alamen', department: 'ouest', commune: 'Pétion-Ville',
      price: 2500, currency: 'HTG', photos: [], videos: [], purpose: 'sale',
      shopSection: 'textiles', shopCategory: 'pillows',
    },
  });
  assert.equal(blocked.status, 403, 'non-partner seller refused');
  assert.equal(blocked.data.error, 'seller_not_allowed');

  // The founder seller posts fine.
  const ok = await as.S('/api/listings', {
    method: 'POST',
    body: {
      title: `Zòrye brode ${run}`, description: 'Zòrye fèt alamen', department: 'ouest', commune: 'Pétion-Ville',
      price: 2500, currency: 'HTG', photos: [], videos: [], purpose: 'sale',
      shopSection: 'textiles', shopCategory: 'pillows',
    },
  });
  assert.equal(ok.status, 200, 'founder seller furniture post succeeds');
  assert.equal(ok.data.listing.kind, 'furniture');
  assert.equal(ok.data.listing.shopSection, 'textiles');
  assert.equal(ok.data.listing.shopCategory, 'pillows');
});

test('seller posts a furniture item; kind is forced server-side and a bad category is rejected', { skip }, async () => {
  // A client-supplied kind is rejected, not trusted.
  const forced = await as.S('/api/listings', {
    method: 'POST',
    body: { title: 'Kind hack', department: 'ouest', commune: 'Delmas', price: 100, currency: 'HTG', photos: [], kind: 'home', shopSection: 'textiles', shopCategory: 'pillows' },
  });
  assert.equal(forced.status, 400);
  assert.equal(forced.data.error, 'kind_forced');
  // A category that does not belong to the section is rejected.
  const badCat = await as.S('/api/listings', {
    method: 'POST',
    body: { title: 'Bad cat', department: 'ouest', commune: 'Delmas', price: 100, currency: 'HTG', photos: [], shopSection: 'furniture', shopCategory: 'pillows' },
  });
  assert.equal(badCat.status, 400);
  assert.equal(badCat.data.error, 'invalid_shop_category');
  // A landlord may not post shop fields at all.
  const landlordPost = await as.L('/api/listings', {
    method: 'POST',
    body: { title: 'House with shop fields', department: 'ouest', commune: 'Delmas', price: 100, currency: 'HTG', photos: [], shopSection: 'furniture', shopCategory: 'tables' },
  });
  assert.equal(landlordPost.status, 400);
  assert.equal(landlordPost.data.error, 'shop_fields_for_sellers_only');
});

test('furniture never appears in house listings; the Shop page filters by section', { skip }, async () => {
  const houses = await (await fetch(`${BASE}/api/listings?limit=100`)).json();
  assert.ok(!houses.listings.some((l) => l.kind === 'furniture'), 'house feed is kind=home only');
  const shopHtml = await (await fetch(`${BASE}/ht/shop?section=textiles`, { headers: { Cookie: 'kay_locale=ht' } })).text();
  assert.ok(shopHtml.includes('Mèble Kay Ou'), 'Shop title renders');
  assert.ok(shopHtml.includes(`Zòrye brode ${run}`), 'textiles section shows the posted item');
  const furnitureHtml = await (await fetch(`${BASE}/ht/shop?section=furniture`, { headers: { Cookie: 'kay_locale=ht' } })).text();
  assert.ok(!furnitureHtml.includes(`Zòrye brode ${run}`), 'furniture section does not show a textiles item');
  assert.ok(furnitureHtml.includes('Pa gen atik nan seksyon sa a pou kounye a'), 'empty section says so plainly');
  const allHtml = await (await fetch(`${BASE}/ht/shop`, { headers: { Cookie: 'kay_locale=ht' } })).text();
  assert.ok(!allHtml.includes(`Zòrye brode ${run}`), 'no uncategorised random feed: sections first, items only inside a section');
  assert.ok(allHtml.includes('Ou jwenn kay la. Kounye a, mèble l.'), 'Shop subline renders');
});

test('the Shop is visible from the landing page', { skip }, async () => {
  const landing = await (await fetch(`${BASE}/`, { headers: { Cookie: 'kay_locale=ht' } })).text();
  assert.ok(landing.includes('Mèble Kay Ou'), 'landing shows the Shop banner');
  assert.ok(landing.includes('/ht/shop'), 'landing links into the Shop');
});

test('the admin sees Shop items to moderate; the admin house feed stays houses-only', { skip }, async () => {
  const shop = await admin('/api/listings?kind=furniture');
  assert.equal(shop.status, 200);
  const item = shop.data.listings.find((l) => l.title === `Zòrye brode ${run}`);
  assert.ok(item, 'admin Shop list includes the seller item');
  assert.ok(shop.data.listings.every((l) => l.kind === 'furniture'), 'admin Shop list is furniture only');
  const houses = await admin('/api/listings');
  assert.ok(!houses.data.listings.some((l) => l.kind === 'furniture'), 'admin house feed (near-me, favorites…) has no furniture');
  // kind=furniture is admin-only: anyone else still gets the house feed.
  const anon = await (await fetch(`${BASE}/api/listings?kind=furniture`)).json();
  assert.ok(!anon.listings.some((l) => l.kind === 'furniture'), 'non-admin never gets the admin Shop list');
});

test('the founder seller is active and free, never billed', { skip }, async () => {
  const me = (await as.S('/api/accounts/me')).data.account;
  assert.equal(me.billingStatus, 'active', 'founder seller is active, not pending');
  assert.equal(me.paidUntil, null, 'never expires');
  assert.equal(me.promoTagged, false, 'no promo tagging');
});
