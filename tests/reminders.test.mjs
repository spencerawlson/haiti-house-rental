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

// The end-to-end test uses a visit later TODAY, which only sits inside a
// reminder window between 06:00 and 20:00 Haiti time. Outside that it
// skips loudly rather than failing by the clock.
const haitiHour = Number(
  new Date().toLocaleString('en-US', { timeZone: 'America/Port-au-Prince', hour: '2-digit', hour12: false }),
);
const windowSkip = cronSkip || ((haitiHour < 6 || haitiHour >= 19) && `Haiti time is ${haitiHour}:00, outside 06:00-19:00`);

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

test('a confirmed visit reminds both sides, exactly once', { skip: windowSkip }, async () => {
  const made = await as.L('/api/listings', {
    method: 'POST',
    body: { title: `Remind ${run}`, commune: 'Delmas', department: 'ouest', priceHTG: 30000, purpose: 'rent' },
  });
  const listingId = made.data.listing.id;
  // Later today, on the half hour, inside 06:00-20:00.
  const slot = `${String(Math.min(20, haitiHour + 1)).padStart(2, '0')}:00`;
  const v = await as.T('/api/visits', {
    method: 'POST',
    body: { listingId, date: haitiDate(0), time: slot, message: 'today please' },
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

  // Both sides, in their own inbox.
  const forL = await waitForReminders('L', 1);
  const forT = await waitForReminders('T', 1);
  assert.equal(forL.length, 1, 'landlord reminded once');
  assert.equal(forT.length, 1, 'tenant reminded once');
  assert.equal(forL[0].kind, forT[0].kind, 'the same reminder');
  assert.equal(forL[0].params.title, `Remind ${run}`, 'names the home');

  // Running again must not repeat it — this is the claim doing its job.
  await cron(CRON_SECRET);
  await cron(CRON_SECRET);
  await new Promise((r) => setTimeout(r, 600)); // let any stray write land
  assert.equal((await reminders('L')).length, 1, 'still once after three runs');
  assert.equal((await reminders('T')).length, 1);
});

test('rescheduling clears the record so the new date reminds again', { skip: windowSkip }, async () => {
  const made = await as.L('/api/listings', {
    method: 'POST',
    body: { title: `Reschedule ${run}`, commune: 'Delmas', department: 'ouest', priceHTG: 30000, purpose: 'rent' },
  });
  const listingId = made.data.listing.id;
  const slot = `${String(Math.min(20, haitiHour + 1)).padStart(2, '0')}:30`;
  const v = await as.T('/api/visits', { method: 'POST', body: { listingId, date: haitiDate(0), time: slot } });
  const visitId = v.data.visit.id;
  await as.L('/api/visits/status', { method: 'POST', body: { id: visitId, action: 'confirm' } });

  const title = `Reschedule ${run}`;

  await cron(CRON_SECRET);
  assert.equal((await waitForReminders('T', 1, title)).length, 1, 'reminded for the original time');

  // Move it to another slot today and confirm again.
  const slot2 = `${String(Math.min(20, haitiHour + 2)).padStart(2, '0')}:00`;
  assert.equal(
    (await as.L('/api/visits/status', { method: 'POST', body: { id: visitId, action: 'reschedule', date: haitiDate(0), time: slot2 } })).status,
    200,
  );
  assert.equal((await as.T('/api/visits/status', { method: 'POST', body: { id: visitId, action: 'confirm' } })).status, 200);

  await cron(CRON_SECRET);
  assert.equal((await waitForReminders('T', 2, title)).length, 2, 'the new time gets its own reminder');
});

test('the job also deletes sold homes whose time is up', { skip: cronSkip }, async () => {
  const made = await as.L('/api/listings', {
    method: 'POST',
    body: { title: `CronSweep ${run}`, commune: 'Delmas', department: 'ouest', priceHTG: 30000, purpose: 'sale' },
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
