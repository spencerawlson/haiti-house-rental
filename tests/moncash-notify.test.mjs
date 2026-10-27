// MonCash notification intake (phase 1): the endpoint records and
// holds, it never confirms.
//
// Rules under test (do not weaken them): a notification never flips a
// payment's status — only a verified confirm (phase 2) or the admin
// may do that; an unknown reference stores a row but creates no
// payment; a retried MonCash transaction ID is a no-op success;
// malformed JSON stores nothing; the thank-you page serves in all
// three locales.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Mona MonCash', username: `mona_${run}`, password: 'pw-m', role: 'landlord' };
const as = { L: client(), anon: client() };
let admin;
let reference;
let amountHTG;

before(async () => {
  if (skip) return;
  assert.equal((await signup(as.L, L)).status, 200);
  admin = await adminClient();
  // Fresh landlords are promo-tagged while spots remain, so their due
  // kind is 'quarter', not 'join' — try join first, fall back to quarter.
  let sub = await as.L('/api/payments', { method: 'POST', body: { kind: 'join', provider: 'moncash', senderPhone: '+509 3000 0000' } });
  if (sub.data?.error === 'wrong_kind') {
    sub = await as.L('/api/payments', { method: 'POST', body: { kind: 'quarter', provider: 'moncash', senderPhone: '+509 3000 0000' } });
  }
  assert.equal(sub.status, 200, JSON.stringify(sub.data));
  const mine = await as.L('/api/payments');
  const pay = mine.data.payments.find((p) => p.status === 'pending' && p.provider === 'moncash');
  assert.ok(pay, 'pending moncash payment exists');
  reference = pay.reference;
  amountHTG = pay.amountHTG;
});

async function notify(body, raw = false) {
  const res = await fetch(`${BASE}/api/moncash/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? body : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function adminRows() {
  const r = await admin('/api/admin/moncash-notifications');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data.notifications;
}

test('admin notification list requires admin', { skip }, async () => {
  assert.equal((await as.anon('/api/admin/moncash-notifications')).status, 401);
});

test('malformed JSON is refused and stores nothing', { skip }, async () => {
  const before = await adminRows();
  assert.equal((await notify('{not json', true)).status, 400);
  assert.equal((await adminRows()).length, before.length);
});

test('unknown reference is stored as unmatched and creates no payment', { skip }, async () => {
  const before = await adminRows();
  const r = await notify({ reference: `auto-ffff${run}`.slice(0, 25), transactionId: `mn-test-unknown-${run}` });
  assert.equal(r.status, 200);
  assert.equal(r.data.received, true);
  assert.equal(r.data.matched, false);
  assert.equal(r.data.status, 'unmatched');
  assert.equal((await adminRows()).length, before.length + 1);
  const mine = await as.L('/api/payments');
  assert.equal(mine.data.payments.filter((p) => p.status === 'pending').length, 1);
});

test('known pending reference is held, never confirmed', { skip }, async () => {
  const r = await notify({ reference, transactionId: `mn-test-known-${run}`, amount: amountHTG });
  assert.equal(r.status, 200);
  assert.equal(r.data.matched, true);
  assert.equal(r.data.status, 'held');
  const mine = await as.L('/api/payments');
  const pay = mine.data.payments.find((p) => p.reference === reference);
  assert.equal(pay.status, 'pending', 'a notification must not confirm');
  assert.ok(pay.events.some((e) => e.action === 'moncash_notify' && e.verified === false));
});

test('duplicate transaction id is a no-op success', { skip }, async () => {
  const before = await adminRows();
  const r = await notify({ reference, transactionId: `mn-test-known-${run}`, amount: amountHTG });
  assert.equal(r.status, 200);
  assert.equal(r.data.duplicate, true);
  assert.equal((await adminRows()).length, before.length);
});

test('amount mismatch is flagged and still held', { skip }, async () => {
  const r = await notify({ reference, transactionId: `mn-test-mismatch-${run}`, amount: amountHTG + 500 });
  assert.equal(r.status, 200);
  assert.equal(r.data.matched, true);
  assert.equal(r.data.amountMismatch, true);
  const mine = await as.L('/api/payments');
  assert.equal(mine.data.payments.find((p) => p.reference === reference).status, 'pending');
  const row = (await adminRows()).find((n) => n.moncashTxn === `mn-test-mismatch-${run}`);
  assert.ok(row, 'mismatch row visible to admin');
  assert.equal(row.amountMismatch, true);
});

test('thank-you page serves in all three locales', { skip }, async () => {
  for (const [locale, word] of [['ht', 'Mèsi'], ['fr', 'Merci'], ['en', 'Thank you']]) {
    const res = await fetch(`${BASE}/${locale}/moncash/merci`);
    assert.equal(res.status, 200, locale);
    assert.ok((await res.text()).includes(word), locale);
  }
});
