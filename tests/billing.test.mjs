// The landlord subscription: 1500 HTG to join, 1000 HTG a quarter,
// suspension when a quarter lapses, deactivation a month later, and 1500
// HTG to come back.
//
// This is money and access, so the tests pin down the whole state machine
// AND its enforcement — a status that does not actually stop somebody
// posting is just a label.
//
// The real periods are three months and thirty days, which no test can
// wait for, so the server is started with BILLING_QUARTER_MS /
// BILLING_GRACE_MS set to a few seconds. The expiry tests skip loudly
// when they are unset rather than passing without having checked.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, BASE, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const QUARTER_MS = Number(process.env.BILLING_QUARTER_MS);
const GRACE_MS = Number(process.env.BILLING_GRACE_MS);
const timeSkip = skip || (!Number.isFinite(QUARTER_MS) && 'needs BILLING_QUARTER_MS on the server');
const graceSkip = timeSkip || (!Number.isFinite(GRACE_MS) && 'needs BILLING_GRACE_MS on the server');
const DUE_MS = Number(process.env.BILLING_DUE_REMINDER_MS);
const dueSkip = timeSkip || (!Number.isFinite(DUE_MS) && 'needs BILLING_DUE_REMINDER_MS on the server');

const JOIN = 1500;
const QUARTER = 1000;
const REACTIVATION = 1500;

const run = uniq();
const as = {};
let admin;
let n = 0;

async function newLandlord(tag) {
  const u = { name: `Bill ${tag}`, username: `bl${tag}_${run}`, password: 'pw', role: 'landlord' };
  as[tag] = client();
  assert.equal((await signup(as[tag], u)).status, 200, `signed up ${tag}`);
  return u;
}

const me = async (tag) => (await as[tag]('/api/accounts/me')).data.account;

async function pay(tag, kind, amountGuess) {
  n += 1;
  const r = await as[tag]('/api/payments', {
    method: 'POST',
    body: { kind, provider: 'moncash', senderPhone: '30000011' },
  });
  return r;
}

async function payAndConfirm(tag, kind) {
  const r = await pay(tag, kind);
  assert.equal(r.status, 200, `${kind} submitted`);
  const c = await admin('/api/admin/payments', { method: 'POST', body: { id: r.data.payment.id, decision: 'confirmed' } });
  assert.equal(c.status, 200, `${kind} confirmed`);
  return r.data.payment;
}

const cron = () =>
  fetch(`${BASE}/api/cron`, { method: 'POST', headers: { 'x-cron-key': process.env.CRON_SECRET || '' } })
    .then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Test FILES run concurrently and all share one /api/cron, so another
// file's call may already have done the work this one was about to
// trigger. Assert on the end state, never on the count a particular
// invocation happened to return.
// notify() is fire-and-forget, so a reminder lands a moment after the
// cron call returns.
async function waitForNotes(tag, want, kind = 'billing_due_soon', ms = 25000) {
  const until = Date.now() + ms;
  const read = async () =>
    ((await as[tag]('/api/notifications')).data.notifications || []).filter((x) => x.kind === kind);
  let got = await read();
  // The job has to be RUN while we wait: a reminder is not due until the
  // account crosses into the horizon, which happens as time passes.
  while (got.length < want && Date.now() < until) {
    await cron();
    await sleep(400);
    got = await read();
  }
  return got;
}

// Keep running the job and confirm the count does not grow — "exactly
// once" has to mean once across many runs, not merely "not yet twice".
async function stillOnce(tag, want, kind = 'billing_due_soon') {
  for (let i = 0; i < 5; i++) { await cron(); await sleep(250); }
  const got = ((await as[tag]('/api/notifications')).data.notifications || []).filter((x) => x.kind === kind);
  assert.equal(got.length, want, `still ${want} after repeated runs`);
  return got;
}

async function waitForStatus(tag, want, ms = 25000) {
  const until = Date.now() + ms;
  let a = await me(tag);
  while (a.billingStatus !== want && Date.now() < until) {
    await cron();
    await sleep(400);
    a = await me(tag);
  }
  return a;
}

const postListing = (tag, title) =>
  as[tag]('/api/listings', {
    method: 'POST',
    body: { title, commune: 'Delmas', department: 'ouest', priceHTG: 25000, purpose: 'rent' },
  });

before(async () => {
  if (skip) return;
  admin = await adminClient();
});

test('a new landlord owes the joining fee and cannot post yet', { skip }, async () => {
  await newLandlord('A');
  const a = await me('A');
  assert.equal(a.billingStatus, 'pending');
  assert.equal(a.activated, false);
  assert.equal(a.paidUntil, null);
  assert.equal((await postListing('A', `No ${run}`)).status, 403, 'cannot post while pending');

  // The server decides what is owed: the cheaper quarter cannot be
  // substituted for the joining fee.
  const wrong = await pay('A', 'quarter');
  assert.equal(wrong.status, 400);
  assert.equal(wrong.data.error, 'wrong_kind');
  const alsoWrong = await pay('A', 'reactivation');
  assert.equal(alsoWrong.data.error, 'wrong_kind');

  const join = await pay('A', 'join');
  assert.equal(join.status, 200);
  assert.equal(join.data.payment.amountHTG, JOIN, 'price comes from the server');
  // One subscription payment in flight at a time.
  assert.equal((await pay('A', 'join')).data.error, 'already_pending');
});

test('the confirmed joining fee activates the account for a quarter', { skip }, async () => {
  const list = await admin('/api/admin/payments');
  const pending = list.data.payments.find((p) => p.username === `blA_${run}` && p.status === 'pending');
  assert.ok(pending, 'the join payment is waiting');
  assert.equal((await admin('/api/admin/payments', { method: 'POST', body: { id: pending.id, decision: 'confirmed' } })).status, 200);

  const a = await me('A');
  assert.equal(a.billingStatus, 'active');
  assert.equal(a.activated, true);
  assert.ok(a.paidUntil > Date.now(), 'paid into the future');
  assert.equal((await postListing('A', `Yes ${run}`)).status, 200, 'can post now');
});

test('paying early adds to the period instead of restarting it', { skip }, async () => {
  const before = (await me('A')).paidUntil;
  const q = await pay('A', 'quarter');
  assert.equal(q.status, 200);
  assert.equal(q.data.payment.amountHTG, QUARTER, 'the renewal price, not the joining price');
  await admin('/api/admin/payments', { method: 'POST', body: { id: q.data.payment.id, decision: 'confirmed' } });
  const after = (await me('A')).paidUntil;
  assert.ok(after > before, `extended (${before} -> ${after})`);
});

test('a rejected payment neither activates nor suspends', { skip }, async () => {
  await newLandlord('R');
  const r = await pay('R', 'join');
  await admin('/api/admin/payments', { method: 'POST', body: { id: r.data.payment.id, decision: 'rejected', note: 'not on the statement' } });
  const a = await me('R');
  assert.equal(a.billingStatus, 'pending', 'still owes the joining fee');
  assert.equal(a.activated, false);
  // And can try again with a corrected reference.
  assert.equal((await pay('R', 'join')).status, 200);
});

test('tenants and partner accounts are never billed', { skip }, async () => {
  const t = client();
  const tu = { name: 'Free Tenant', username: `blten_${run}`, password: 'pw', role: 'tenant' };
  assert.equal((await signup(t, tu)).status, 200);
  const acc = (await t('/api/accounts/me')).data.account;
  assert.equal(acc.billingStatus, 'active', 'active from the start');
  assert.equal(acc.paidUntil, null, 'and never expires');

  const p = await admin('/api/admin/partner', {
    method: 'POST',
    body: { name: 'Partner Co', username: `blpart_${run}`, phone: '+509 3000 0001', passwordHash: 'x'.repeat(64) },
  });
  if (p.status === 200) {
    const list = await admin('/api/accounts');
    const partner = list.data.accounts.find((x) => x.username === `blpart_${run}`);
    assert.equal(partner.paidUntil, null, 'a partner never expires either');
  }
});

test('when the quarter lapses the account is suspended and its homes come down', { skip: timeSkip }, async () => {
  await newLandlord('S');
  await payAndConfirm('S', 'join');
  const posted = await postListing('S', `Suspend ${run}`);
  assert.equal(posted.status, 200);
  const listingId = posted.data.listing.id;

  // Visible while paid.
  const anon = client();
  assert.ok(((await anon('/api/listings')).data.listings || []).some((l) => l.id === listingId), 'listed while paid');

  await sleep(QUARTER_MS + 1200);
  const a = await waitForStatus('S', 'suspended');
  assert.equal(a.billingStatus, 'suspended', 'the scheduled job suspended it');
  assert.equal(a.activated, false, 'activated follows the subscription');
  assert.ok(a.suspendedAt > 0);

  // The teeth: off the site, and no new postings.
  assert.ok(!((await anon('/api/listings')).data.listings || []).some((l) => l.id === listingId), 'taken off the site');
  assert.equal((await anon(`/api/listings?id=${listingId}`)).status, 404);
  assert.equal((await postListing('S', `Nope ${run}`)).status, 403);
  // But the landlord still sees it in their own library, so paying brings
  // it back rather than losing it.
  const mine = (await as.S(`/api/listings?owner=${encodeURIComponent(`blS_${run}`)}&all=1`)).data.listings || [];
  assert.ok(mine.some((l) => l.id === listingId), 'still in the library');
});

test('paying the quarter lifts the suspension and relists the homes', { skip: timeSkip }, async () => {
  const due = await pay('S', 'quarter');
  assert.equal(due.status, 200);
  assert.equal(due.data.payment.amountHTG, QUARTER, 'the quarter price, not the joining price');
  await admin('/api/admin/payments', { method: 'POST', body: { id: due.data.payment.id, decision: 'confirmed' } });

  const a = await me('S');
  assert.equal(a.billingStatus, 'active');
  assert.equal(a.activated, true);
  assert.equal(a.suspendedAt, null, 'the countdown to deactivation is cleared');
  const anon = client();
  assert.ok(((await anon('/api/listings')).data.listings || []).some((l) => l.title === `Suspend ${run}`), 'back on the site');
});

test('a month of silence deactivates the account, and coming back costs the joining price', { skip: graceSkip }, async () => {
  await newLandlord('D');
  await payAndConfirm('D', 'join');
  await sleep(QUARTER_MS + 1200);
  assert.equal((await waitForStatus('D', 'suspended')).billingStatus, 'suspended');

  await sleep(GRACE_MS + 1200);
  const a = await waitForStatus('D', 'deactivated');
  assert.equal(a.billingStatus, 'deactivated', 'the scheduled job deactivated it');
  assert.equal(a.activated, false);

  // Now the quarter is not enough — it is the joining price again.
  assert.equal((await pay('D', 'quarter')).data.error, 'wrong_kind');
  const back = await pay('D', 'reactivation');
  assert.equal(back.status, 200);
  assert.equal(back.data.payment.amountHTG, REACTIVATION, 'reactivation costs the joining price');
  await admin('/api/admin/payments', { method: 'POST', body: { id: back.data.payment.id, decision: 'confirmed' } });
  const after = await me('D');
  assert.equal(after.billingStatus, 'active');
  assert.equal(after.activated, true);
  assert.equal((await postListing('D', `Back ${run}`)).status, 200, 'can post again');
});

test('a landlord is warned before the quarter ends, once', { skip: dueSkip }, async () => {
  await newLandlord('W');
  await payAndConfirm('W', 'join');
  // With the test-length quarter, paid_until is already inside the
  // reminder horizon, so the next run is due to warn.
  const notes = async () =>
    ((await as.W('/api/notifications')).data.notifications || []).filter((x) => x.kind === 'billing_due_soon');

  assert.equal((await notes()).length, 0, 'nothing before the job runs');

  // Wait for the account to cross into the reminder horizon.
  const got = await waitForNotes('W', 1);
  assert.equal(got.length, 1, 'warned once the quarter is nearly up');
  assert.ok(got[0].params.amount, 'says what is owed');
  assert.ok(got[0].params.date, 'and by when');
  // The warning arrives while the account is still ACTIVE — before the
  // homes come down, which is the whole point of it.
  assert.equal((await me('W')).billingStatus, 'active');

  // The claim is what stops five minutes of cron being five reminders.
  await stillOnce('W', 1);
});

test('renewing earns a fresh warning for the new period', { skip: dueSkip }, async () => {
  // Same account: paying moves paid_until, so the next period is warned
  // about separately instead of being treated as already-warned.
  const q = await pay('W', 'quarter');
  assert.equal(q.status, 200);
  await admin('/api/admin/payments', { method: 'POST', body: { id: q.data.payment.id, decision: 'confirmed' } });
  const got = await waitForNotes('W', 2);
  assert.equal(got.length, 2, 'one warning per billing period');
  await stillOnce('W', 2);
});

test('the admin can override a subscription, and only the admin can', { skip }, async () => {
  await newLandlord('O');
  // Not reachable without the admin cookie.
  assert.equal((await as.O('/api/admin/billing', { method: 'POST', body: { username: `blO_${run}`, status: 'active' } })).status, 401);
  // Nor with a status that is not one of the four.
  assert.equal((await admin('/api/admin/billing', { method: 'POST', body: { username: `blO_${run}`, status: 'free-forever' } })).status, 400);

  const ok = await admin('/api/admin/billing', { method: 'POST', body: { username: `blO_${run}`, status: 'active' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.account.billingStatus, 'active');
  assert.equal(ok.data.account.activated, true, 'a goodwill activation lets them post');
  assert.equal((await postListing('O', `Gift ${run}`)).status, 200);
});
