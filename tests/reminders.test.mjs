// Visit reminders and the scheduled job that sends them.
//
// The window logic itself is covered deterministically in
// unit.test.mjs — it needs no server and must never be flaky. This file
// covers the parts that need the real app: who may trigger the job, and
// that a due reminder reaches BOTH sides exactly once.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, BASE, client, signup, adminClient, uniq, haitiDate } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const CRON_SECRET = process.env.CRON_SECRET || '';
const cronSkip = skip || (!CRON_SECRET && 'needs CRON_SECRET on the server');

// Fake clock (Stage 2, A3). These tests run under a pinned "now" —
// today 11:00 Haiti wall-clock — that ONLY the reminder path reads
// (KAY_FAKE_NOW_MS, set by the suite runner and by CI; see
// app/api/cron/route.js). Tomorrow's visits then always sit in their
// two_days window whatever the real hour, so the tests never skip on
// the clock again. Without the var they fail loudly outside the
// windows instead of skipping — that is the contract, not a flake.
// Midnight-rollover caveat: a run crossing Haiti midnight makes fake
// today older than real today and visit creation rejects the date as
// past (~1/1440 runs, same class as existing flakiness).
const run = uniq();
const L = { name: 'Rem Landlord', username: `rmland_${run}`, password: 'pw-l', role: 'landlord' };
const T = { name: 'Rem Tenant', username: `rmten_${run}`, password: 'pw-t', role: 'tenant' };
const as = { L: client(), T: client() };
let admin;

const cron = (key, method = 'POST') =>
  fetch(`${BASE}/api/cron`, { method, headers: key ? { 'x-cron-key': key } : {} })
    .then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));

const inbox = async (who) => (await as[who]('/api/notifications')).data.notifications || [];
const reminders = async (who, title = null) =>
  (await inbox(who)).filter((n) => n.kind.startsWith('visit_reminder') && (!title || n.params.title === title));

// notify() is fire-and-forget by design, so the cron endpoint returns
// before the inbox rows land. Wait for the count rather than racing it.
async function waitForReminders(who, want, title = null, ms = 8000) {
  const until = Date.now() + ms;
  let got = await reminders(who, title);
  while (got.length < want && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 150));
    got = await reminders(who, title);
  }
  return got;
}

before(async () => {
  if (skip) return;
  assert.equal((await signup(as.L, L)).status, 200);
  assert.equal((await signup(as.T, T)).status, 200);
  admin = await adminClient();
  const p = await as.L('/api/payments', {
    method: 'POST',
    body: { kind: 'activation', provider: 'moncash', senderPhone: '30000012' },
  });
  await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
});

test('the scheduled job refuses anyone without the secret', { skip: cronSkip }, async () => {
  assert.equal((await cron(null)).status, 401, 'no key');
  assert.equal((await cron('wrong-key-entirely')).status, 401, 'wrong key');
  // A key of the right length but wrong content must also fail — the
  // compare is constant-time, not a length check.
  assert.equal((await cron('x'.repeat(CRON_SECRET.length))).status, 401, 'right length, wrong value');
  const ok = await cron(CRON_SECRET);
  assert.equal(ok.status, 200, 'the real key works');
  assert.ok(typeof ok.data.remindersSent === 'number', 'reports what it did');
  assert.ok(typeof ok.data.deletedListings === 'number');
});

test('a confirmed visit reminds both sides, exactly once', { skip: cronSkip }, async () => {
  const made = await as.L('/api/listings', {
    method: 'POST',
    body: { title: `Remind ${run}`, commune: 'Delmas', department: 'ouest', price: 30000, purpose: 'rent' },
  });
  const listingId = made.data.listing.id;
  // Tomorrow at noon: under the fake clock (today 11:00 Haiti) this sits
  // in its two_days window, whatever the real hour.
  const v = await as.T('/api/visits', {
    method: 'POST',
    body: { listingId, date: haitiDate(1), time: '12:00', message: 'tomorrow please' },
  });
  assert.equal(v.status, 200, 'visit requested');
  const visitId = v.data.visit.id;

  // Nothing goes out while it is only proposed: a reminder for a time
  // nobody agreed to is noise.
  await cron(CRON_SECRET);
  const beforeL = (await inbox('L')).filter((n) => n.kind.startsWith('visit_reminder')).length;
  assert.equal(beforeL, 0, 'no reminder for an unconfirmed visit');

  // The landlord confirms (the tenant proposed, so the other side answers).
  assert.equal((await as.L('/api/visits/status', { method: 'POST', body: { id: visitId, action: 'confirm' } })).status, 200);

  const first = await cron(CRON_SECRET);
  assert.equal(first.status, 200);
  assert.ok(first.data.remindersSent >= 1, `sent something, got ${first.data.remindersSent}`);

  // Both sides, in their own inbox — and the kind pins the fake clock:
  // under real time this visit's kind would vary or nothing would fire.
  const forL = await waitForReminders('L', 1);
  const forT = await waitForReminders('T', 1);
  assert.equal(forL.length, 1, 'landlord reminded once');
  assert.equal(forT.length, 1, 'tenant reminded once');
  assert.equal(forL[0].kind, 'visit_reminder_two_days', 'fake clock puts tomorrow noon in two_days');
  assert.equal(forT[0].kind, 'visit_reminder_two_days');
  assert.equal(forL[0].params.title, `Remind ${run}`, 'names the home');

  // Running again must not repeat it — this is the claim doing its job.
  await cron(CRON_SECRET);
  await cron(CRON_SECRET);
  await new Promise((r) => setTimeout(r, 600)); // let any stray write land
  assert.equal((await reminders('L')).length, 1, 'still once after three runs');
  assert.equal((await reminders('T')).length, 1);
});

test('rescheduling clears the record so the new date reminds again', { skip: cronSkip }, async () => {
  const made = await as.L('/api/listings', {
    method: 'POST',
    body: { title: `Reschedule ${run}`, commune: 'Delmas', department: 'ouest', price: 30000, purpose: 'rent' },
  });
  const listingId = made.data.listing.id;
  const v = await as.T('/api/visits', { method: 'POST', body: { listingId, date: haitiDate(1), time: '12:30' } });
  const visitId = v.data.visit.id;
  await as.L('/api/visits/status', { method: 'POST', body: { id: visitId, action: 'confirm' } });

  const title = `Reschedule ${run}`;

  await cron(CRON_SECRET);
  const first = await waitForReminders('T', 1, title);
  assert.equal(first.length, 1, 'reminded for the original time');
  assert.equal(first[0].kind, 'visit_reminder_two_days', 'fake clock pins the original reminder kind');

  // Move it to another slot tomorrow and confirm again.
  assert.equal(
    (await as.L('/api/visits/status', { method: 'POST', body: { id: visitId, action: 'reschedule', date: haitiDate(1), time: '13:00' } })).status,
    200,
  );
  assert.equal((await as.T('/api/visits/status', { method: 'POST', body: { id: visitId, action: 'confirm' } })).status, 200);

  await cron(CRON_SECRET);
  const both = await waitForReminders('T', 2, title);
  assert.equal(both.length, 2, 'the new time gets its own reminder');
  assert.equal(both[1].kind, 'visit_reminder_two_days', 'fake clock pins the rescheduled reminder kind');
});

test('the job also deletes sold homes whose time is up', { skip: cronSkip }, async () => {
  const made = await as.L('/api/listings', {
    method: 'POST',
    body: { title: `CronSweep ${run}`, commune: 'Delmas', department: 'ouest', price: 30000, purpose: 'sale' },
  });
  const id = made.data.listing.id;
  await as.L('/api/listings/sold', { method: 'POST', body: { id, status: 'sold' } });
  const mine = async () =>
    ((await as.L(`/api/listings?owner=${encodeURIComponent(L.username)}&all=1`)).data.listings || []).find((h) => h.id === id);
  assert.ok(await mine(), 'still here while the window is open');

  const wait = Number(process.env.SOLD_DELETE_AFTER_MS);
  if (!Number.isFinite(wait)) return; // the 48 h default cannot be waited out
  await new Promise((r) => setTimeout(r, wait + 1500));
  // Other test files share this endpoint, so one of their cron calls may
  // already have swept it. Assert it is GONE, not that this call is the
  // one that removed it.
  for (let i = 0; i < 20 && (await mine()); i++) {
    await cron(CRON_SECRET);
    await new Promise((r) => setTimeout(r, 400));
  }
  assert.equal(await mine(), undefined, 'the scheduled job deleted it');
});
