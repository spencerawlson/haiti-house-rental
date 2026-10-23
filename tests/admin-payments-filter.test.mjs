// The Admin Board payment queue is filterable: a confirmed payment must
// be listable (and deletable) from the board, not only a pending one.
// Before this, the board fetched the default pending list, so the delete
// button never appeared on a confirmed test payment — the exact case the
// deletion feature was built for.
//
// Assertions are per-payment-id, never global counts: test files run
// concurrently against one server and other files submit payments too.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();

let admin;

before(async () => {
  if (skip) return;
  admin = await adminClient();
});

test('a confirmed payment is listable by status and deletable from the board', { skip }, async () => {
  const landlord = client();
  await signup(landlord, { name: 'Filter', username: `filter_${run}`, password: 'pw', role: 'landlord' });
  const sub = await landlord('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'moncash', senderPhone: '30000099' } });
  assert.equal(sub.status, 200, 'activation submitted');
  const id = sub.data.payment.id;

  const c = await admin('/api/admin/payments', { method: 'POST', body: { id, decision: 'confirmed' } });
  assert.equal(c.status, 200, 'admin confirmed it');

  const pending = await admin('/api/admin/payments');
  assert.ok(!pending.data.payments.some((x) => x.id === id), 'confirmed payment leaves the pending queue');
  const confirmed = await admin('/api/admin/payments?status=confirmed');
  assert.ok(confirmed.data.payments.some((x) => x.id === id), 'confirmed filter lists it');
  const all = await admin('/api/admin/payments?status=all');
  assert.ok(all.data.payments.some((x) => x.id === id), 'all lists it');
  assert.equal(typeof all.data.summary.pendingCount, 'number', 'summary carries a pending count');

  const del = await admin('/api/admin/payments', { method: 'DELETE', body: { id, reason: 'test payment cleanup' } });
  assert.equal(del.status, 200, 'confirmed payment deleted from the board list');
  const after = await admin('/api/admin/payments?status=all');
  assert.ok(!after.data.payments.some((x) => x.id === id), 'deleted payment leaves the ledger');
  assert.ok(after.data.deletions.some((d) => d.paymentId === id && d.reason === 'test payment cleanup' && d.status === 'confirmed'), 'deletion recorded with its confirmed status');
});
