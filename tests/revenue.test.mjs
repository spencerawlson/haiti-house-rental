// Revenue — free forever (Nov 2026): advertising only.
//
// The only money that moves now is advertising: a listing ad or a
// picture-ad campaign payment (chosen 100–1,000 HTG), confirmed by
// the admin. Join / quarter / reactivation payments are
// 'not_applicable' and can never be confirmed, so they contribute
// nothing. Revni (the Admin Board's revenue section) and the payment
// summary's "confirmed" figure must always agree, and nothing may be
// counted twice. Manual admin activations (no payment) still log the
// old one-time 1000 HTG roster row, once.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
let admin;
const txn = () => `T${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
const totals = async () => {
  const rev = (await admin('/api/admin/revenue')).data;
  const sum = (await admin('/api/admin/payments')).data.summary;
  return { revenue: rev.totalHTG, confirmed: sum.confirmedHTG, rev };
};
async function payAndConfirm(who, body) {
  const r = await who('/api/payments', { method: 'POST', body: { provider: 'moncash', senderPhone: '30000011', ...body } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const c = await admin('/api/admin/payments', { method: 'POST', body: { id: r.data.payment.id, decision: 'confirmed', receiverTxn: txn() } });
  assert.equal(c.status, 200, JSON.stringify(c.data));
  return r.data.payment;
}

before(async () => {
  if (skip) return;
  admin = await adminClient();
});

test('listing advertising 100 + campaign advertising 200: every payment adds its real amount, once', { skip }, async () => {
  const L = client();
  assert.equal((await signup(L, { name: 'Rev Landlord', username: `rev_${run}`, password: 'pw', role: 'landlord' })).status, 200);
  // Free forever: active at signup, no joining fee to pay.
  assert.equal((await L('/api/accounts/me')).data.account.billingStatus, 'active');
  const before = await totals();
  assert.equal(before.revenue, before.confirmed, 'Revni and the summary agree');

  const l = await L('/api/listings', { method: 'POST', body: { title: `Rev ${run}`, commune: 'Delmas', department: 'ouest', price: 1, purpose: 'rent', lat: 18.5, lng: -72.3 } });
  assert.equal(l.status, 200);
  await payAndConfirm(L, { kind: 'advertising', listingId: l.data.listing.id, amountHTG: 100 });
  let now = await totals();
  assert.equal(now.revenue - before.revenue, 100, 'the listing ad adds 100');
  assert.equal(now.confirmed - before.confirmed, 100, 'and the summary adds it once');

  const A = client();
  assert.equal((await signup(A, { name: 'Rev Advertiser', username: `reva_${run}`, password: 'pw', role: 'advertiser' })).status, 200);
  const camp = await A('/api/advertisers/campaigns', {
    method: 'POST',
    body: { title: `Rev Ad ${run}`, imageUrl: 'https://example.com/rev.png', linkUrl: 'https://example.com/rev' },
  });
  assert.equal(camp.status, 200, JSON.stringify(camp.data));
  await payAndConfirm(A, { kind: 'advertising', campaignId: camp.data.campaign.id, amountHTG: 200 });
  now = await totals();
  assert.equal(now.revenue - before.revenue, 300, 'the campaign ad adds 200 more');
  assert.equal(now.confirmed, now.revenue, 'Revni and the summary still agree');

  const mine = now.rev.entries.filter((e) => e.username === `rev_${run}`).map((e) => `${e.kind}:${e.amountHTG}`).sort();
  assert.deepEqual(mine, ['advertising:100'], 'one line per payment, at its amount');
  const campMine = now.rev.entries.filter((e) => e.username === `reva_${run}`).map((e) => `${e.kind}:${e.amountHTG}`).sort();
  assert.deepEqual(campMine, ['advertising:200']);
});

test('join and quarter payments are refused, so they never count as revenue', { skip }, async () => {
  const L = client();
  assert.equal((await signup(L, { name: 'Rev Two', username: `rev2_${run}`, password: 'pw', role: 'landlord' })).status, 200);
  const before = await totals();
  for (const kind of ['join', 'quarter', 'reactivation']) {
    const p = await L('/api/payments', { method: 'POST', body: { kind, provider: 'moncash', senderPhone: '30000012' } });
    assert.equal(p.status, 400, `${kind} refused`);
    assert.equal(p.data.error, 'not_applicable');
  }
  const after = await totals();
  assert.equal(after.revenue, before.revenue, 'refused billing adds nothing');
  assert.equal(after.confirmed, after.revenue);
});

test('rejected and pending advertising payments do not count', { skip }, async () => {
  const L = client();
  assert.equal((await signup(L, { name: 'Rev Three', username: `rev3_${run}`, password: 'pw', role: 'landlord' })).status, 200);
  const before = await totals();
  const l = await L('/api/listings', { method: 'POST', body: { title: `Rev3 ${run}`, commune: 'Delmas', department: 'ouest', price: 1, purpose: 'rent', lat: 18.5, lng: -72.3 } });
  assert.equal(l.status, 200);
  const p = await L('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId: l.data.listing.id, amountHTG: 100, provider: 'moncash', senderPhone: '30000012' } });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  assert.equal((await totals()).revenue, before.revenue, 'pending adds nothing');
  await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'rejected', note: 'not found' } });
  const after = await totals();
  assert.equal(after.revenue, before.revenue, 'rejected adds nothing');
  assert.equal(after.confirmed, after.revenue);
});

test('a manual admin activation counts once; deleting a confirmed payment leaves no phantom', { skip }, async () => {
  // rev2 (whose billing payments were refused above) is activated by
  // hand, with no payment: the old one-time 1000 HTG, listed as manual,
  // counted once.
  const before = await totals();
  await admin('/api/admin/activate', { method: 'POST', body: { username: `rev2_${run}`, activated: true } });
  let now = await totals();
  assert.equal(now.revenue - before.revenue, 1000);
  assert.equal(now.confirmed, now.revenue);
  assert.ok(now.rev.entries.some((e) => e.username === `rev2_${run}` && e.kind === 'manual'));

  // rev's confirmed listing ad (a "test" payment) is deleted: revenue
  // drops by exactly 100, and the roster row that payment wrote is not
  // "manual".
  const adPay = now.rev.entries.find((e) => e.username === `rev_${run}` && e.kind === 'advertising');
  assert.ok(adPay);
  const id = adPay.key.replace(/^pay-/, '');
  assert.equal((await admin('/api/admin/payments', { method: 'DELETE', body: { id, reason: `test payment ${run}` } })).status, 200);
  const after = await totals();
  assert.equal(now.revenue - after.revenue, 100, 'deleted payment removed entirely, no phantom 1000');
  assert.equal(after.confirmed, after.revenue);
  assert.ok(!after.rev.entries.some((e) => e.username === `rev_${run}` && e.kind === 'manual'));
});
