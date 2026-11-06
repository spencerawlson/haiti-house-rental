// Rent price caps (Spencer, 2026-11-05): USD ≤ $5,000 per year,
// HTG ≤ 100,000 per 6 months, on new rent listings. The pure helper
// runs without a server; the API tests below prove the refusal end to
// end (400 price_cap) and that sales are never capped.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { rentPriceCapExceeded } from '../lib/listings.js';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const rent = (price, currency = 'HTG', rentPeriod = 'monthly', extra = {}) => ({
  kind: 'home', purpose: 'rent', price, currency, rentPeriod, ...extra,
});

test('USD cap is $5,000 per year, in every period', () => {
  assert.equal(rentPriceCapExceeded(rent(5000, 'USD', 'annual')), false);
  assert.equal(rentPriceCapExceeded(rent(5001, 'USD', 'annual')), true);
  assert.equal(rentPriceCapExceeded(rent(416, 'USD', 'monthly')), false); // 4,992/yr
  assert.equal(rentPriceCapExceeded(rent(417, 'USD', 'monthly')), true); // 5,004/yr
  assert.equal(rentPriceCapExceeded(rent(1250, 'USD', 'quarterly')), false); // 5,000/yr
  assert.equal(rentPriceCapExceeded(rent(2500, 'USD', 'semiannual')), false); // 5,000/yr
  assert.equal(rentPriceCapExceeded(rent(2501, 'USD', 'semiannual')), true);
});

test('HTG cap is 100,000 per 6 months, in every period', () => {
  assert.equal(rentPriceCapExceeded(rent(100000, 'HTG', 'semiannual')), false);
  assert.equal(rentPriceCapExceeded(rent(100001, 'HTG', 'semiannual')), true);
  assert.equal(rentPriceCapExceeded(rent(16666, 'HTG', 'monthly')), false); // 199,992/yr
  assert.equal(rentPriceCapExceeded(rent(16667, 'HTG', 'monthly')), true); // 200,004/yr
  assert.equal(rentPriceCapExceeded(rent(50000, 'HTG', 'quarterly')), false); // 200,000/yr
  assert.equal(rentPriceCapExceeded(rent(200000, 'HTG', 'annual')), false);
  assert.equal(rentPriceCapExceeded(rent(200001, 'HTG', 'annual')), true);
});

test('sales and Shop items are never capped; missing currency counts as HTG', () => {
  assert.equal(rentPriceCapExceeded(rent(100000, 'USD', 'annual', { purpose: 'sale' })), false);
  assert.equal(rentPriceCapExceeded(rent(1000000, 'HTG', 'monthly', { purpose: 'sale' })), false);
  assert.equal(rentPriceCapExceeded(rent(1000000, 'HTG', 'monthly', { kind: 'furniture' })), false);
  assert.equal(rentPriceCapExceeded({ purpose: 'rent', price: 100000, rentPeriod: 'semiannual' }), false);
  assert.equal(rentPriceCapExceeded({ purpose: 'rent', price: 100001, rentPeriod: 'semiannual' }), true);
});

// ---- API tests: need a live app with a throwaway database. ----

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Cap Landlord', username: `capland_${run}`, password: 'pw-l', role: 'landlord' };
const asL = client();
let admin;

before(async () => {
  if (skip) return;
  assert.equal((await signup(asL, L)).status, 200);
  admin = await adminClient();
  const p = await asL('/api/payments', {
    method: 'POST',
    body: { kind: 'activation', provider: 'moncash', senderPhone: '30000021' },
  });
  assert.equal(p.status, 200);
  await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
  assert.equal((await asL('/api/accounts/me')).data.account.activated, true);
});

async function postRent(body) {
  return asL('/api/listings', {
    method: 'POST',
    body: { title: `Cap ${run} ${Math.random().toString(36).slice(2, 6)}`, commune: 'Delmas', department: 'ouest', purpose: 'rent', lat: 18.5, lng: -72.3, ...body },
  });
}

test('a rent over the cap is refused with price_cap; at the cap it posts', { skip }, async () => {
  const overUsd = await postRent({ price: 5001, currency: 'USD', rentPeriod: 'annual' });
  assert.equal(overUsd.status, 400);
  assert.equal(overUsd.data.error, 'price_cap');
  const atUsd = await postRent({ price: 5000, currency: 'USD', rentPeriod: 'annual' });
  assert.equal(atUsd.status, 200);
  const overHtg = await postRent({ price: 100001, currency: 'HTG', rentPeriod: 'semiannual' });
  assert.equal(overHtg.status, 400);
  assert.equal(overHtg.data.error, 'price_cap');
  const atHtg = await postRent({ price: 100000, currency: 'HTG', rentPeriod: 'semiannual' });
  assert.equal(atHtg.status, 200);
});

test('a sale over the rent cap still posts', { skip }, async () => {
  const r = await asL('/api/listings', {
    method: 'POST',
    body: { title: `Cap sale ${run}`, commune: 'Delmas', department: 'ouest', purpose: 'sale', price: 100000, currency: 'USD', rentPeriod: 'annual', lat: 18.5, lng: -72.3 },
  });
  assert.equal(r.status, 200);
});

test('raising a rent over the cap by edit is refused; a title-only edit passes', { skip }, async () => {
  const created = await postRent({ price: 4000, currency: 'USD', rentPeriod: 'annual' });
  assert.equal(created.status, 200);
  const l = created.data.listing;
  const over = await asL('/api/listings', {
    method: 'PATCH',
    body: { id: l.id, title: l.title, commune: 'Delmas', price: 6000, currency: 'USD', rentPeriod: 'annual' },
  });
  assert.equal(over.status, 400);
  assert.equal(over.data.error, 'price_cap');
  const titleOnly = await asL('/api/listings', {
    method: 'PATCH',
    body: { id: l.id, title: `${l.title} (edited)`, commune: 'Delmas' },
  });
  assert.equal(titleOnly.status, 200);
});
