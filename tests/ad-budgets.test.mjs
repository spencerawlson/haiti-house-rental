// Advertising budgets (migration 0019).
//
// Months are gone: a landlord chooses 100–1,000 HTG, and the admin's
// confirmation turns that amount into view and click budgets at the
// admin-set rate (default 1000 views + 200 clicks per 100 HTG). The
// budgets are hidden from landlords — they see only a money balance
// that falls as the ad is consumed — while the admin sees the counts.
// A paused ad shows nothing and consumes nothing; an exhausted ad
// stops on its own; budgets survive subscription renewal untouched
// (billing never writes the ad columns).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Ad Budget Landlord', username: `adbud_${run}`, password: 'pw-l', role: 'landlord' };
const L2 = { name: 'Ad Budget Other', username: `adbud2_${run}`, password: 'pw-l', role: 'landlord' };
const asL = client();
const asL2 = client();
let admin;

async function confirmPayment(id) {
  const r = await admin('/api/admin/payments', { method: 'POST', body: { id, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
}

async function activateListing(amountHTG) {
  const listing = await asL('/api/listings', { method: 'POST', body: { title: `AdBud ${run} ${amountHTG}`, commune: 'Delmas', department: 'ouest', price: 1, purpose: 'rent', lat: 18.5, lng: -72.3 } });
  assert.equal(listing.status, 200);
  const id = listing.data.listing.id;
  const p = await asL('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId: id, amountHTG, provider: 'moncash', senderPhone: '30000044' } });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  await confirmPayment(p.data.payment.id);
  return id;
}

before(async () => {
  if (skip) return;
  assert.equal((await signup(asL, L)).status, 200);
  assert.equal((await signup(asL2, L2)).status, 200);
  admin = await adminClient();
  // Activate the landlord (activation payment) so they can post.
  const p = await asL('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'moncash', senderPhone: '30000044' } });
  assert.equal(p.status, 200);
  await confirmPayment(p.data.payment.id);
  assert.equal((await asL('/api/accounts/me')).data.account.activated, true);
});

test('the admin rate is settable and applies to the next activation, not a running campaign', { skip }, async () => {
  const before = await admin('/api/admin/settings');
  assert.equal(before.data.adViewsPer100, 1000);
  assert.equal(before.data.adClicksPer100, 200);
  // The public settings endpoint must not leak the rate.
  const pub = await asL('/api/settings');
  assert.ok(!('adViewsPer100' in pub.data) && !('adClicksPer100' in pub.data));

  const id = await activateListing(100);
  const running = (await admin('/api/admin/ad-stats')).data.stats.find((s) => s.id === id);
  assert.equal(running.viewsBudget, 1000);
  // Change the rate: the running campaign keeps its budgets.
  await admin('/api/admin/settings', { method: 'POST', body: { adViewsPer100: 5000, adClicksPer100: 1000 } });
  const kept = (await admin('/api/admin/ad-stats')).data.stats.find((s) => s.id === id);
  assert.equal(kept.viewsBudget, 1000);
  // But the next activation uses the new rate.
  const id2 = await activateListing(200);
  const next = (await admin('/api/admin/ad-stats')).data.stats.find((s) => s.id === id2);
  assert.equal(next.viewsBudget, 10000, '200 HTG at 5000 per 100');
  assert.equal(next.clicksBudget, 2000);
  // Restore the default rate for the rest of the suite.
  await admin('/api/admin/settings', { method: 'POST', body: { adViewsPer100: 1000, adClicksPer100: 200 } });
  assert.equal((await admin('/api/admin/settings')).data.adViewsPer100, 1000);
});

test('views and clicks consume the budget, the landlord sees only a money balance', { skip }, async () => {
  const id = await activateListing(100);
  const pub0 = (await asL(`/api/listings?id=${id}`)).data.listing;
  assert.equal(pub0.advertised, true);
  assert.equal(pub0.adBalanceHTG, 100);
  assert.ok(!('viewsBudget' in pub0) && !('viewsUsed' in pub0), 'counts hidden from the public shape');
  for (let i = 0; i < 250; i++) {
    const r = await asL('/api/ads/impression', { method: 'POST', body: { listingId: id } });
    assert.equal(r.data.counted, true);
  }
  const click = await asL('/api/ads/click', { method: 'POST', body: { listingId: id } });
  assert.equal(click.data.counted, true);
  const pub1 = (await asL(`/api/listings?id=${id}`)).data.listing;
  assert.equal(pub1.adBalanceHTG, 75, '250 of 1000 views spent = 75 HTG left');
  const stats = (await admin('/api/admin/ad-stats')).data.stats.find((s) => s.id === id);
  assert.equal(stats.viewsUsed, 250);
  assert.equal(stats.clicksUsed, 1);
});

test('pausing hides the ad, freezes the budget, and only the owner (or admin) may do it', { skip }, async () => {
  const id = await activateListing(100);
  assert.equal((await asL2('/api/ads/pause', { method: 'POST', body: { id, paused: true } })).status, 401, 'a stranger cannot pause it');
  await asL('/api/ads/impression', { method: 'POST', body: { listingId: id } });
  const paused = await asL('/api/ads/pause', { method: 'POST', body: { id, paused: true } });
  assert.equal(paused.status, 200);
  assert.equal(paused.data.listing.advertised, false, 'paused ad shows nothing');
  assert.equal(paused.data.listing.adPaused, true);
  const blocked = await asL('/api/ads/impression', { method: 'POST', body: { listingId: id } });
  assert.equal(blocked.data.counted, false, 'a paused ad consumes nothing');
  const resumed = await asL('/api/ads/pause', { method: 'POST', body: { id, paused: false } });
  assert.equal(resumed.data.listing.advertised, true);
  const stats = (await admin('/api/admin/ad-stats')).data.stats.find((s) => s.id === id);
  assert.equal(stats.viewsUsed, 1, 'the one pre-pause view is still the only one spent');
});

test('exhausting either budget stops the ad on its own', { skip }, async () => {
  await admin('/api/admin/settings', { method: 'POST', body: { adViewsPer100: 10, adClicksPer100: 2 } });
  const id = await activateListing(100);
  try {
    assert.equal((await asL(`/api/listings?id=${id}`)).data.listing.advertised, true);
    assert.equal((await asL('/api/ads/click', { method: 'POST', body: { listingId: id } })).data.counted, true);
    assert.equal((await asL('/api/ads/click', { method: 'POST', body: { listingId: id } })).data.counted, true);
    const ended = (await asL(`/api/listings?id=${id}`)).data.listing;
    assert.equal(ended.advertised, false, 'clicks spent: ad stops');
    assert.equal(ended.adEnded, true);
    assert.equal(ended.adBalanceHTG, 0);
    assert.equal((await asL('/api/ads/click', { method: 'POST', body: { listingId: id } })).data.counted, false, 'nothing counts after the end');
  } finally {
    await admin('/api/admin/settings', { method: 'POST', body: { adViewsPer100: 1000, adClicksPer100: 200 } });
  }
});
