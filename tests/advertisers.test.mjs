// External advertisers + picture-ad campaigns (migration 0028).
//
// An advertiser signs up with role 'advertiser' (via ?role=advertiser
// on the signup page — there is no advertiser card on the role
// chooser), creates a campaign (title, imageUrl, linkUrl required;
// the link must start http:// or https://), pays 100–1,000 HTG for
// it, and the admin's confirmation sets the view/click budgets (the
// same rate math as listing ads) and flips it to 'active'. Campaigns
// render in the home carousel with data-ad-card="c:<id>", and the
// counting routes accept the c: prefix. The public feed carries no
// counts; the advertiser sees counts only on their own campaigns.
// Free forever: signup is free and active at once, and the
// freeForever copy renders on the landing page and the in-app home
// in all three locales.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const A = { name: 'Ann Advertiser', username: `adv_${run}`, password: 'pw-a', role: 'advertiser' };
const A2 = { name: 'Al Advertiser', username: `adv2_${run}`, password: 'pw-a2', role: 'advertiser' };
const as = { A: client(), A2: client(), anon: client() };
let admin;
let campaignId;

const FREE = {
  ht: 'Kay Ayiti gratis nèt pou tout moun, pou tout tan.',
  fr: 'Kay Ayiti est entièrement gratuit pour tous, pour toujours.',
  en: 'Kay Ayiti is completely free for everyone, forever.',
};

async function confirmPayment(id) {
  const r = await admin('/api/admin/payments', { method: 'POST', body: { id, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
}

async function createCampaign(who, body) {
  return who('/api/advertisers/campaigns', {
    method: 'POST',
    body: { title: `Camp ${run}`, imageUrl: 'https://example.com/ad.png', linkUrl: 'https://example.com/landing', ...body },
  });
}

before(async () => {
  if (skip) return;
  admin = await adminClient();
});

test('advertiser signup stores the role; the account is active and free at once', { skip }, async () => {
  const r = await signup(as.A, A);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.account.role, 'advertiser', 'role stored');
  const me = (await as.A('/api/accounts/me')).data.account;
  assert.equal(me.role, 'advertiser');
  assert.equal(me.activated, true);
  assert.equal(me.billingStatus, 'active');
  assert.equal(me.paidUntil, null);
  // A landlord may not create campaigns.
  const L = client();
  assert.equal((await signup(L, { name: 'Leo Landlord', username: `advland_${run}`, password: 'pw-l', role: 'landlord' })).status, 200);
  assert.equal((await createCampaign(L, {})).status, 403, 'landlords cannot create campaigns');
});

test('campaign creation validates title, image and link', { skip }, async () => {
  assert.equal((await createCampaign(as.A, { title: '' })).data.error, 'invalid_title');
  assert.equal((await createCampaign(as.A, { title: 'x', imageUrl: '' })).data.error, 'invalid_image');
  const badLink = await createCampaign(as.A, { linkUrl: 'example.com/no-scheme' });
  assert.equal(badLink.status, 400);
  assert.equal(badLink.data.error, 'invalid_link');
  const ftp = await createCampaign(as.A, { linkUrl: 'ftp://example.com/x' });
  assert.equal(ftp.data.error, 'invalid_link');
  assert.equal((await as.anon('/api/advertisers/campaigns', { method: 'POST', body: { title: 'x', imageUrl: 'https://example.com/a.png', linkUrl: 'https://example.com' } })).status, 401, 'anonymous cannot create');
});

test('campaign create/list/stats: pending at first, and only the owner sees it', { skip }, async () => {
  const created = await createCampaign(as.A, {});
  assert.equal(created.status, 200, JSON.stringify(created.data));
  campaignId = created.data.campaign.id;
  assert.equal(created.data.campaign.status, 'pending', 'a new campaign waits for payment');
  assert.equal(created.data.campaign.title, `Camp ${run}`);
  assert.equal(created.data.campaign.imageUrl, 'https://example.com/ad.png');
  assert.equal(created.data.campaign.linkUrl, 'https://example.com/landing');

  const mine = (await as.A('/api/advertisers/campaigns')).data.campaigns;
  assert.ok(mine.some((c) => c.id === campaignId), 'owner lists it');
  const stats = (await as.A('/api/advertisers/stats')).data.stats;
  assert.deepEqual(stats, { campaigns: 1, viewsUsed: 0, clicksUsed: 0 }, 'own totals, counts only');

  // A second advertiser sees none of the first's.
  assert.equal((await signup(as.A2, A2)).status, 200);
  assert.deepEqual((await as.A2('/api/advertisers/campaigns')).data.campaigns, [], 'second advertiser lists nothing');
  assert.deepEqual((await as.A2('/api/advertisers/stats')).data.stats, { campaigns: 0, viewsUsed: 0, clicksUsed: 0 }, 'and their totals are their own');
  assert.equal((await as.anon('/api/advertisers/campaigns')).status, 401, 'anonymous cannot list');
  assert.equal((await as.anon('/api/advertisers/stats')).status, 401, 'anonymous cannot read stats');
});

test('campaign payment submit + admin confirm activates it with budgets', { skip }, async () => {
  // Out of range is refused, and a campaign payment never carries a listing.
  assert.equal((await as.A('/api/payments', { method: 'POST', body: { kind: 'advertising', campaignId, amountHTG: 99, provider: 'moncash', senderPhone: '30000055' } })).status, 400);
  assert.equal((await as.A('/api/payments', { method: 'POST', body: { kind: 'advertising', campaignId, amountHTG: 1001, provider: 'moncash', senderPhone: '30000055' } })).status, 400);
  // Another advertiser cannot pay for this campaign.
  assert.equal((await as.A2('/api/payments', { method: 'POST', body: { kind: 'advertising', campaignId, amountHTG: 100, provider: 'moncash', senderPhone: '30000055' } })).status, 403);
  const p = await as.A('/api/payments', { method: 'POST', body: { kind: 'advertising', campaignId, amountHTG: 200, provider: 'moncash', senderPhone: '30000055' } });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  assert.equal(p.data.payment.amountHTG, 200);
  assert.equal(p.data.payment.campaignId, campaignId);
  assert.equal((await as.A('/api/advertisers/campaigns')).data.campaigns.find((c) => c.id === campaignId).status, 'pending', 'still pending before confirmation');
  await confirmPayment(p.data.payment.id);
  const mine = (await as.A('/api/advertisers/campaigns')).data.campaigns.find((c) => c.id === campaignId);
  assert.equal(mine.status, 'active', 'confirmation activates the campaign');
  assert.equal(mine.paused, false);
  assert.equal(mine.amountHTG, 200, 'the paid amount is recorded');
});

test('the public feed shape carries no counts, and the campaign renders in the home carousel', { skip }, async () => {
  const feed = await as.anon('/api/ads/active');
  assert.equal(feed.status, 200);
  const found = (feed.data.campaigns || []).find((c) => c.id === campaignId);
  assert.ok(found, 'active campaign in the public feed');
  assert.deepEqual(Object.keys(found).sort(), ['id', 'imageUrl', 'linkUrl', 'title'], 'four keys only — no counts, no budgets');
  // The home page renders it as a carousel card with the c: prefix.
  const home = await (await fetch(`${BASE}/ht`, { headers: { Cookie: 'kay_locale=ht' } })).text();
  assert.ok(home.includes(`data-ad-card="c:${campaignId}"`), 'carousel card carries data-ad-card="c:<id>"');
  assert.ok(home.includes(`Camp ${run}`), 'carousel shows the campaign title');
});

test('impression and click counting on a campaign via the c: prefix', { skip }, async () => {
  const stats = async () => (await as.A('/api/advertisers/stats')).data.stats;
  const beforeStats = await stats();
  // The carousel's prefixed form, exactly as data-ad-card reports it.
  const imp = await as.anon('/api/ads/impression', { method: 'POST', body: { listingId: `c:${campaignId}` } });
  assert.deepEqual(Object.keys(imp.data).sort(), ['counted'], 'impression returns only {counted}');
  assert.equal(imp.data.counted, true);
  assert.equal((await stats()).viewsUsed, beforeStats.viewsUsed + 1, 'one view counted');
  // The plain campaignId form counts the same way.
  assert.equal((await as.anon('/api/ads/impression', { method: 'POST', body: { campaignId } })).data.counted, true);
  assert.equal((await stats()).viewsUsed, beforeStats.viewsUsed + 2);
  // Clicks count every tap.
  for (let i = 0; i < 3; i++) {
    const click = await as.anon('/api/ads/click', { method: 'POST', body: { listingId: `c:${campaignId}` } });
    assert.deepEqual(Object.keys(click.data).sort(), ['counted'], 'click returns only {counted}');
    assert.equal(click.data.counted, true, `tap ${i + 1} counts`);
  }
  assert.equal((await stats()).clicksUsed, beforeStats.clicksUsed + 3, 'every tap counted');
  // Nothing counts for an unknown campaign.
  assert.equal((await as.anon('/api/ads/impression', { method: 'POST', body: { listingId: 'c:adv-doesnotexist' } })).data.counted, false);
  assert.equal((await as.anon('/api/ads/click', { method: 'POST', body: { campaignId: 'adv-doesnotexist' } })).data.counted, false);
  // The second advertiser's totals never moved.
  assert.deepEqual((await as.A2('/api/advertisers/stats')).data.stats, { campaigns: 0, viewsUsed: 0, clicksUsed: 0 });
});

test('pause and resume by the owner; a non-owner is refused; the admin may also pause', { skip }, async () => {
  // A non-owner gets the shared unauthorized answer (401), the same
  // as pausing somebody else's listing ad.
  assert.equal((await as.A2('/api/ads/pause', { method: 'POST', body: { campaignId, paused: true } })).status, 401, 'a stranger cannot pause it');
  assert.equal((await as.anon('/api/ads/pause', { method: 'POST', body: { campaignId, paused: true } })).status, 401, 'anonymous cannot pause it');
  const stats = async () => (await as.A('/api/advertisers/stats')).data.stats;
  const beforeStats = await stats();
  const paused = await as.A('/api/ads/pause', { method: 'POST', body: { campaignId, paused: true } });
  assert.equal(paused.status, 200);
  assert.equal(paused.data.campaign.paused, true);
  // Paused: out of the public feed, and nothing counts.
  assert.ok(!((await as.anon('/api/ads/active')).data.campaigns || []).some((c) => c.id === campaignId), 'paused campaign leaves the feed');
  assert.equal((await as.anon('/api/ads/impression', { method: 'POST', body: { listingId: `c:${campaignId}` } })).data.counted, false);
  assert.deepEqual(await stats(), beforeStats, 'paused: nothing spent');
  const resumed = await as.A('/api/ads/pause', { method: 'POST', body: { campaignId, paused: false } });
  assert.equal(resumed.status, 200);
  assert.equal(resumed.data.campaign.paused, false);
  assert.ok(((await as.anon('/api/ads/active')).data.campaigns || []).some((c) => c.id === campaignId), 'resumed campaign is back in the feed');
  assert.equal((await as.anon('/api/ads/impression', { method: 'POST', body: { listingId: `c:${campaignId}` } })).data.counted, true, 'counting again after resume');
  // The admin may flip it too.
  const adminPaused = await admin('/api/ads/pause', { method: 'POST', body: { campaignId, paused: true } });
  assert.equal(adminPaused.status, 200);
  assert.equal(adminPaused.data.campaign.paused, true);
  assert.equal((await admin('/api/ads/pause', { method: 'POST', body: { campaignId, paused: false } })).status, 200);
});

test('campaign budgets use the same rate math as listing ads', { skip }, async () => {
  // Drop the rate so the budget is small enough to exhaust: 10 views
  // per 100 HTG means a 100 HTG campaign ends after 10 views.
  await admin('/api/admin/settings', { method: 'POST', body: { adViewsPer100: 10, adClicksPer100: 2 } });
  try {
    const created = await createCampaign(as.A2, { title: `Small Camp ${run}` });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const smallId = created.data.campaign.id;
    const p = await as.A2('/api/payments', { method: 'POST', body: { kind: 'advertising', campaignId: smallId, amountHTG: 100, provider: 'moncash', senderPhone: '30000055' } });
    assert.equal(p.status, 200, JSON.stringify(p.data));
    await confirmPayment(p.data.payment.id);
    for (let i = 0; i < 10; i++) {
      assert.equal((await as.anon('/api/ads/impression', { method: 'POST', body: { listingId: `c:${smallId}` } })).data.counted, true, `view ${i + 1} counts`);
    }
    assert.equal((await as.anon('/api/ads/impression', { method: 'POST', body: { listingId: `c:${smallId}` } })).data.counted, false, '11th view: budget spent');
    assert.ok(!((await as.anon('/api/ads/active')).data.campaigns || []).some((c) => c.id === smallId), 'exhausted campaign leaves the feed');
  } finally {
    await admin('/api/admin/settings', { method: 'POST', body: { adViewsPer100: 1000, adClicksPer100: 200 } });
  }
});

test('public seller signup is closed', { skip }, async () => {
  const r = await signup(client(), { name: 'Sally Seller', username: `sally_${run}`, password: 'pw-s', role: 'seller' });
  assert.equal(r.status, 400);
  assert.equal(r.data.error, 'seller_signup_closed');
});

test('freeForever copy is on the landing page and the in-app home, in all three locales', { skip }, async () => {
  for (const locale of ['ht', 'fr', 'en']) {
    const landing = await (await fetch(`${BASE}/`, { headers: { Cookie: `kay_locale=${locale}` } })).text();
    assert.ok(landing.includes(FREE[locale]), `landing (${locale}) says free forever`);
    const home = await (await fetch(`${BASE}/${locale}`, { headers: { Cookie: `kay_locale=${locale}` } })).text();
    assert.ok(home.includes(FREE[locale]), `in-app home (${locale}) says free forever`);
  }
});
