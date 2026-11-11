// Payment-confirm atomicity (Stage 2, A1): a confirmed payment must
// always carry its billing/revenue/ad effect, and a failure mid-confirm
// must leave the payment pending (recoverable), never confirmed-but-
// unapplied. The fault test uses a test-only hook on reviewPayment
// (__testFailAfterFlip) that no HTTP route forwards, so it cannot be
// triggered from outside the test process.
//
// Free forever (Nov 2026): there are no join/quarter billing payments
// any more — the atomicity cases run on advertising payments (listing
// ads and picture-ad campaigns), the only payments left.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';
import { reviewPayment } from '../lib/payments-server.js';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const txn = (p) => `${p}${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

const as = {};
let admin;

async function newLandlord(tag) {
  const u = { name: `Atom ${tag}`, username: `atom${tag}_${run}`, password: 'pw-a', role: 'landlord' };
  as[tag] = client();
  assert.equal((await signup(as[tag], u)).status, 200, `signed up ${tag}`);
  return u;
}

async function newAdvertiser(tag) {
  const u = { name: `Atom Adv ${tag}`, username: `atoma${tag}_${run}`, password: 'pw-a', role: 'advertiser' };
  as[tag] = client();
  assert.equal((await signup(as[tag], u)).status, 200, `signed up ${tag}`);
  return u;
}

async function submit(tag, body) {
  const r = await as[tag]('/api/payments', { method: 'POST', body });
  assert.equal(r.status, 200, `submitted ${JSON.stringify(body)}`);
  return r.data.payment;
}

async function confirm(id) {
  const c = await admin('/api/admin/payments', { method: 'POST', body: { id, decision: 'confirmed', receiverTxn: txn('AT') } });
  assert.equal(c.status, 200, 'confirmed');
  return c.data.payment;
}

const pendingPayment = async (id) => {
  const list = await admin('/api/admin/payments?status=pending');
  return (list.data.payments || []).find((p) => p.id === id);
};

async function postListing(tag, title) {
  const made = await as[tag]('/api/listings', {
    method: 'POST',
    body: { title, commune: 'Delmas', department: 'ouest', price: 30000, purpose: 'rent' },
  });
  assert.equal(made.status, 200, 'listing posted');
  return made.data.listing.id;
}

before(async () => {
  if (skip) return;
  admin = await adminClient();
});

test('a failure mid-confirm leaves the payment pending, never confirmed-but-unapplied', { skip }, async () => {
  const u = await newLandlord('F');
  const listingId = await postListing('F', `Atom Ad ${run}`);
  const p = await submit('F', { kind: 'advertising', listingId, amountHTG: 500, provider: 'moncash', senderPhone: '30000021' });
  const libBefore = (await as.F(`/api/listings?owner=${encodeURIComponent(u.username)}&all=1`)).data.listings.find((l) => l.id === listingId);
  assert.equal(libBefore.advertised, false, 'not advertised before confirm');

  // The fault fires after the status flip but before any side effect.
  // Before the A1 fix this call succeeds (the hook is ignored) and the
  // assertion below fails; after the fix it throws and rolls back.
  await assert.rejects(
    reviewPayment(p.id, 'confirmed', '', 'admin', { receiverTxn: txn('ATF'), __testFailAfterFlip: true }),
    /test fault/,
    'mid-confirm failure throws',
  );

  assert.ok(await pendingPayment(p.id), 'still pending after the failed confirm');
  const libAfter = (await as.F(`/api/listings?owner=${encodeURIComponent(u.username)}&all=1`)).data.listings.find((l) => l.id === listingId);
  assert.equal(libAfter.advertised, false, 'no ad effect applied');

  // The state is recoverable: the same payment confirms normally now.
  await confirm(p.id);
  const libDone = (await as.F(`/api/listings?owner=${encodeURIComponent(u.username)}&all=1`)).data.listings.find((l) => l.id === listingId);
  assert.equal(libDone.advertised, true, 'advertised after re-confirm');
  assert.equal(libDone.adBalanceHTG, 500, 'budgets applied after re-confirm');
});

test('a confirmed advertising payment carries its ad budgets and revenue effect', { skip }, async () => {
  const u = await newLandlord('A');
  const listingId = await postListing('A', `Atom Ad ${run}`);
  const p = await submit('A', { kind: 'advertising', listingId, amountHTG: 500, provider: 'moncash', senderPhone: '30000023' });
  await confirm(p.id);
  const mine = (await as.A(`/api/listings?owner=${encodeURIComponent(u.username)}&all=1`)).data.listings || [];
  const lib = mine.find((l) => l.id === listingId);
  assert.ok(lib.advertised, 'campaign shows in the Library');
  assert.equal(lib.adBalanceHTG, 500, 'full balance before any consumption');
  const stats = await admin('/api/admin/ad-stats');
  const row = (stats.data.stats || []).find((s) => s.id === listingId);
  assert.ok(row, 'admin ad-stats carries the campaign');
  assert.ok(row.viewsBudget > 0 && row.clicksBudget > 0, 'budgets set from the admin rate');
  const rev = await admin('/api/admin/revenue');
  const revRow = (rev.data.entries || []).find((e) => e.username === u.username && e.kind === 'advertising' && e.amountHTG === 500);
  assert.ok(revRow, 'revenue roster carries the advertising payment');
});

test('a confirmed campaign payment carries its campaign budgets', { skip }, async () => {
  const u = await newAdvertiser('C');
  const camp = await as.C('/api/advertisers/campaigns', {
    method: 'POST',
    body: { title: `Atom Camp ${run}`, imageUrl: 'https://example.com/atom.png', linkUrl: 'https://example.com/atom' },
  });
  assert.equal(camp.status, 200, JSON.stringify(camp.data));
  const campaignId = camp.data.campaign.id;
  assert.equal(camp.data.campaign.status, 'pending', 'pending before payment');
  const p = await submit('C', { kind: 'advertising', campaignId, amountHTG: 200, provider: 'moncash', senderPhone: '30000024' });
  await confirm(p.id);
  const mine = (await as.C('/api/advertisers/campaigns')).data.campaigns || [];
  const row = mine.find((c) => c.id === campaignId);
  assert.ok(row, 'campaign still listed for its owner');
  assert.equal(row.status, 'active', 'confirmation activates the campaign');
  assert.equal(row.paused, false);
  const feed = (await client()('/api/ads/active')).data.campaigns || [];
  assert.ok(feed.some((c) => c.id === campaignId), 'active campaign reaches the public feed');
  const rev = await admin('/api/admin/revenue');
  const revRow = (rev.data.entries || []).find((e) => e.username === u.username && e.kind === 'advertising' && e.amountHTG === 200);
  assert.ok(revRow, 'revenue roster carries the campaign payment');
});
