// Ad campaign state belongs to the owner and the admin — never to the
// public listing shape (Stage 2, A2). PR #42's design hid budgets even
// from the landlord (who sees only a money balance in their Library), so
// publishing the remaining balance, pause state, and campaign flag to
// anonymous callers contradicts it.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Ad Shape Landlord', username: `adshape_${run}`, password: 'pw-l', role: 'landlord' };
const asL = client();
const anon = client();
let admin;
let id;

async function confirmPayment(pid) {
  const r = await admin('/api/admin/payments', { method: 'POST', body: { id: pid, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
}

before(async () => {
  if (skip) return;
  assert.equal((await signup(asL, L)).status, 200);
  admin = await adminClient();
  // Free forever: the landlord is active at signup, so they can post
  // with no activation payment.
  assert.equal((await asL('/api/accounts/me')).data.account.activated, true);
  const listing = await asL('/api/listings', { method: 'POST', body: { title: `AdShape ${run}`, commune: 'Delmas', department: 'ouest', price: 1, purpose: 'rent', lat: 18.5, lng: -72.3 } });
  assert.equal(listing.status, 200);
  id = listing.data.listing.id;
  const ap = await asL('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId: id, amountHTG: 500, provider: 'moncash', senderPhone: '30000044' } });
  assert.equal(ap.status, 200, JSON.stringify(ap.data));
  await confirmPayment(ap.data.payment.id);
});

const AD_KEYS = ['adCampaign', 'adPaused', 'adEnded', 'adBalanceHTG'];

test('anonymous shapes carry no ad campaign state, but keep the advertised flag', { skip }, async () => {
  const one = (await anon(`/api/listings?id=${id}`)).data.listing;
  assert.equal(one.advertised, true);
  for (const k of AD_KEYS) assert.ok(!(k in one), `public detail must not carry ${k}`);
  const list = (await anon('/api/listings')).data.listings;
  const found = list.find((l) => l.id === id);
  assert.ok(found, 'listing present in the public list');
  for (const k of AD_KEYS) assert.ok(!(k in found), `public list must not carry ${k}`);
});

test('the owner Library and the admin ad-stats endpoint still show the campaign', { skip }, async () => {
  const lib = (await asL(`/api/listings?owner=${L.username}&all=1`)).data.listings.find((l) => l.id === id);
  assert.ok(lib, 'listing present in the owner Library');
  assert.equal(lib.adCampaign, true);
  assert.equal(lib.adPaused, false);
  assert.equal(lib.adEnded, false);
  assert.equal(lib.adBalanceHTG, 500, 'full balance before any use');
  const stats = (await admin('/api/admin/ad-stats')).data.stats.find((s) => s.id === id);
  assert.ok(stats, 'campaign present in admin ad-stats');
  assert.ok(stats.viewsBudget > 0 && stats.clicksBudget > 0);
});

// Picture-ad campaigns (0028) carry no counts publicly either: the
// public feed shape is id/title/imageUrl/linkUrl only, and the
// advertiser's own campaign shape carries counts only — never budgets.
test('campaign shapes carry no counts publicly and no budgets to the owner', { skip }, async () => {
  const adv = client();
  assert.equal((await signup(adv, { name: 'Ad Shape Advertiser', username: `adshapeadv_${run}`, password: 'pw-a', role: 'advertiser' })).status, 200);
  const camp = await adv('/api/advertisers/campaigns', {
    method: 'POST',
    body: { title: `Shape Camp ${run}`, imageUrl: 'https://example.com/shape.png', linkUrl: 'https://example.com/shape' },
  });
  assert.equal(camp.status, 200, JSON.stringify(camp.data));
  const cid = camp.data.campaign.id;
  const p = await adv('/api/payments', { method: 'POST', body: { kind: 'advertising', campaignId: cid, amountHTG: 100, provider: 'moncash', senderPhone: '30000044' } });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  await confirmPayment(p.data.payment.id);

  // Public feed: exactly four keys, no counts, no budgets.
  const feed = (await anon('/api/ads/active')).data.campaigns || [];
  const found = feed.find((c) => c.id === cid);
  assert.ok(found, 'active campaign in the public feed');
  assert.deepEqual(Object.keys(found).sort(), ['id', 'imageUrl', 'linkUrl', 'title'], 'public feed shape is four keys only');
  // And a campaign never leaks into a listing shape.
  const listings = (await anon('/api/listings')).data.listings || [];
  assert.ok(!listings.some((l) => l.id === cid), 'campaigns are not listings');

  // The owner's own campaign shape: counts only, never budgets.
  const mine = (await adv('/api/advertisers/campaigns')).data.campaigns.find((c) => c.id === cid);
  assert.ok(mine, 'campaign present for its owner');
  assert.ok('viewsUsed' in mine && 'clicksUsed' in mine, 'owner sees the counts');
  for (const k of ['viewsBudget', 'clicksBudget', 'adViewsBudget', 'adClicksBudget']) {
    assert.ok(!(k in mine), `owner shape must not carry ${k}`);
  }
  // Counting through the c: prefix moves the owner's counts, and only those.
  await anon('/api/ads/impression', { method: 'POST', body: { listingId: `c:${cid}` } });
  await anon('/api/ads/click', { method: 'POST', body: { listingId: `c:${cid}` } });
  const after = (await adv('/api/advertisers/campaigns')).data.campaigns.find((c) => c.id === cid);
  assert.equal(after.viewsUsed, 1, 'one view counted');
  assert.equal(after.clicksUsed, 1, 'one click counted');
});
