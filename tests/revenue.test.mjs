// Revenue = every confirmed payment at its real amount (join 1500, each
// quarter 1000, reactivation 1500, advertising chosen 100–1,000), plus manual
// admin activations made without a payment. Revni (the Admin Board's
// revenue section) and the payment summary's "confirmed" figure must
// always agree, and nothing may be counted twice.
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

test('join 1500 + quarter 1000 + advertising 100: every payment adds its real amount, once', { skip }, async () => {
  const L = client();
  assert.equal((await signup(L, { name: 'Rev Landlord', username: `rev_${run}`, password: 'pw', role: 'landlord' })).status, 200);
  const before = await totals();
  assert.equal(before.revenue, before.confirmed, 'Revni and the summary agree');

  const join = await payAndConfirm(L, { kind: 'join' });
  assert.equal(join.amountHTG, 1500);
  let now = await totals();
  assert.equal(now.revenue - before.revenue, 1500, 'the joining fee adds 1500, not 1000');
  assert.equal(now.confirmed - before.confirmed, 1500, 'and the summary adds it once, not 1500 + 1000');

  const q = await payAndConfirm(L, { kind: 'quarter' });
  assert.equal(q.amountHTG, 1000);
  now = await totals();
  assert.equal(now.revenue - before.revenue, 2500, 'the quarter adds 1000 more');

  const l = await L('/api/listings', { method: 'POST', body: { title: `Rev ${run}`, commune: 'Delmas', department: 'ouest', price: 1, purpose: 'rent', lat: 18.5, lng: -72.3 } });
  assert.equal(l.status, 200);
  await payAndConfirm(L, { kind: 'advertising', listingId: l.data.listing.id, amountHTG: 100 });
  now = await totals();
  assert.equal(now.revenue - before.revenue, 2600, 'advertising adds 100');
  assert.equal(now.confirmed, now.revenue, 'Revni and the summary still agree');

  const mine = now.rev.entries.filter((e) => e.username === `rev_${run}`).map((e) => `${e.kind}:${e.amountHTG}`).sort();
  assert.deepEqual(mine, ['advertising:100', 'join:1500', 'quarter:1000'], 'one line per payment, at its amount');
});

test('rejected and pending payments do not count', { skip }, async () => {
  const L = client();
  assert.equal((await signup(L, { name: 'Rev Two', username: `rev2_${run}`, password: 'pw', role: 'landlord' })).status, 200);
  const before = await totals();
  const p = await L('/api/payments', { method: 'POST', body: { kind: 'join', provider: 'moncash', senderPhone: '30000012' } });
  assert.equal((await totals()).revenue, before.revenue, 'pending adds nothing');
  await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'rejected', note: 'not found' } });
  const after = await totals();
  assert.equal(after.revenue, before.revenue, 'rejected adds nothing');
  assert.equal(after.confirmed, after.revenue);
});

test('a manual admin activation counts once; deleting a confirmed payment leaves no phantom', { skip }, async () => {
  // rev2 (whose join was rejected above) is activated by hand, with no
  // payment: the old one-time 1000 HTG, listed as manual, counted once.
  const before = await totals();
  await admin('/api/admin/activate', { method: 'POST', body: { username: `rev2_${run}`, activated: true } });
  let now = await totals();
  assert.equal(now.revenue - before.revenue, 1000);
  assert.equal(now.confirmed, now.revenue);
  assert.ok(now.rev.entries.some((e) => e.username === `rev2_${run}` && e.kind === 'manual'));

  // rev's confirmed join (a "test" payment) is deleted: revenue drops by
  // exactly 1500, and the roster row that payment wrote is not "manual".
  const joinPay = now.rev.entries.find((e) => e.username === `rev_${run}` && e.kind === 'join');
  assert.ok(joinPay);
  const id = joinPay.key.replace(/^pay-/, '');
  assert.equal((await admin('/api/admin/payments', { method: 'DELETE', body: { id, reason: `test payment ${run}` } })).status, 200);
  const after = await totals();
  assert.equal(now.revenue - after.revenue, 1500, 'deleted payment removed entirely, no phantom 1000');
  assert.equal(after.confirmed, after.revenue);
  assert.ok(!after.rev.entries.some((e) => e.username === `rev_${run}` && e.kind === 'manual'));
});
