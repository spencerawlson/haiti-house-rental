// Seller accounts + the structured Shop (Nov 2026).
//
// Rules under test: sellers pay 50% of landlord prices (750 join /
// 500 quarter / 750 reactivation, server-decided); the first 2000
// sellers get a free year from a SEPARATE pool — a seller tag must
// not consume a landlord spot, and vice versa; sellers post
// furniture items (kind='furniture') with exactly one section and
// one category, and those items never appear in house search,
// listings, or the map feed; the Shop page shows sections first and
// filters to one section; empty sections say so plainly; no
// furniture purchase payment exists in v1 (browse + contact seller).
//
// Ordering: runs after 00, so the landlord promo is FULL here — a
// landlord signed up in this file is pending and pays normally,
// which is exactly what the seller-pool isolation test needs: the
// seller pool is still open (00 only tagged landlords), so a seller
// here is promo-tagged and activated at once.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';
import { billingFeesFor } from '../lib/config.js';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const S = { name: 'Sara Seller', username: `sara_${run}`, password: 'pw-s', role: 'seller' };
const L = { name: 'Leo Landlord', username: `leo_${run}`, password: 'pw-l', role: 'landlord' };
const as = { S: client(), L: client() };
let admin;

before(async () => { admin = await adminClient(); });

async function promoCounts() {
  const r = await admin('/api/admin/promo');
  assert.equal(r.status, 200);
  return r.data;
}

test('seller signup costs half the landlord price, from the seller pool only', { skip }, async () => {
  // The server price table itself: seller = exactly 50% of landlord.
  // The payments route and the reminder path both read this table
  // (billingFeesForAccount / billingFeesFor(role)), never the client.
  assert.deepEqual(billingFeesFor('seller'), { join: 750, quarter: 500, reactivation: 750 });
  assert.deepEqual(billingFeesFor('landlord'), { join: 1500, quarter: 1000, reactivation: 1500 });
  const beforeCounts = await promoCounts();
  const sellerRes = await signup(as.S, S);
  assert.equal(sellerRes.status, 200, 'seller signup succeeds');
  const sellerMe = (await as.S('/api/accounts/me')).data.account;
  assert.equal(sellerMe.role, 'seller');
  assert.equal(sellerMe.promoTagged, true, 'seller promo still open, so tagged');
  assert.equal(sellerMe.activated, true, 'promo seller activated at once');
  const after = await promoCounts();
  assert.equal(after.sellerTagged, beforeCounts.sellerTagged + 1, 'one seller spot consumed');
  assert.equal(after.sellerRemaining, beforeCounts.sellerRemaining - 1);
  assert.equal(after.tagged, beforeCounts.tagged, 'landlord pool untouched by a seller tag');
  // And the landlord join fee is still 1500, server-decided (no
  // amount is sent in the payment request below).
  const landlordRes = await signup(as.L, L);
  assert.equal(landlordRes.status, 200);
  const landlordMe = (await as.L('/api/accounts/me')).data.account;
  assert.equal(landlordMe.promoTagged, false, 'landlord promo full after 00, so untagged');
  // Activate the landlord so the shop-fields rejection below is
  // reached (an unactivated landlord gets 403 first, correctly).
  assert.equal((await admin('/api/admin/activate', { method: 'POST', body: { username: L.username, activated: true } })).status, 200);
  const landlordPay = await as.L('/api/payments', { method: 'POST', body: { kind: 'join', provider: 'moncash', senderPhone: '30000044' } });
  assert.equal(landlordPay.status, 200);
  assert.equal(landlordPay.data.payment.amountHTG, 1500, 'landlord join fee unchanged');
});

test('seller posts a furniture item; kind is forced server-side and a bad category is rejected', { skip }, async () => {
  const ok = await as.S('/api/listings', {
    method: 'POST',
    body: {
      title: `Zòrye brode ${run}`, description: 'Zòrye fèt alamen', department: 'ouest', commune: 'Pétion-Ville',
      price: 2500, currency: 'HTG', photos: [], videos: [], purpose: 'sale',
      shopSection: 'textiles', shopCategory: 'pillows',
    },
  });
  assert.equal(ok.status, 200, 'seller furniture post succeeds');
  assert.equal(ok.data.listing.kind, 'furniture');
  assert.equal(ok.data.listing.shopSection, 'textiles');
  assert.equal(ok.data.listing.shopCategory, 'pillows');
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
  assert.ok(furnitureHtml.includes('Poko gen atik nan seksyon sa a'), 'empty section says so plainly');
  const allHtml = await (await fetch(`${BASE}/ht/shop`, { headers: { Cookie: 'kay_locale=ht' } })).text();
  assert.ok(!allHtml.includes(`Zòrye brode ${run}`), 'no uncategorised random feed: sections first, items only inside a section');
  assert.ok(allHtml.includes('Ou jwenn kay la. Kounye a, mèble l.'), 'Shop subline renders');
});

test('seller quarter reminder amount is 500, not the landlord 1000', { skip }, async () => {
  // A promo seller is active, so no live reminder is due here; the
  // reminder path reads the same server table asserted above
  // (billing-server due reminders use billingFeesFor(r.role).quarter),
  // so a seller reminder says 500 HTG, never the landlord 1000.
  assert.equal(billingFeesFor('seller').quarter, 500);
  const me = (await as.S('/api/accounts/me')).data.account;
  assert.equal(me.billingStatus, 'active', 'promo seller is active, not pending');
});
