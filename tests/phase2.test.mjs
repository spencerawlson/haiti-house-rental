// Phase 2 regression tests: conversation ids, block, reports with admin
// moderation, and the visit rules (date/time checks, who confirms,
// cancel, reschedule, one active request per tenant).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, haitiDate, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD (activated landlord + admin review)';
const run = uniq();
const L = { name: 'Lea Landlord', username: `p2land_${run}`, password: 'pw-l', role: 'landlord' };
const A = { name: 'Ana Tenant', username: `p2ta_${run}`, password: 'pw-a', role: 'tenant' };
const B = { name: 'Ben Tenant', username: `p2tb_${run}`, password: 'pw-b', role: 'tenant' };
const as = { L: client(), A: client(), B: client(), anon: client() };
let admin;
let listingId;

before(async () => {
  if (skip) return;
  for (const [k, u] of [['L', L], ['A', A], ['B', B]]) assert.equal((await signup(as[k], u)).status, 200);
  admin = await adminClient();
  await admin('/api/admin/activate', { method: 'POST', body: { username: L.username, activated: true } });
  const r = await as.L('/api/listings', { method: 'POST', body: { title: 'P2 home', commune: 'Delmas', department: 'ouest', priceHTG: 2000, purpose: 'rent', lat: 18.5, lng: -72.3 } });
  assert.equal(r.status, 200);
  listingId = r.data.listing.id;
});

test('a conversation gets a stable id on the first message', { skip }, async () => {
  const before = await as.A(`/api/chat?listingId=${listingId}`);
  assert.equal(before.data.conversation, null);
  await as.A('/api/chat', { method: 'POST', body: { listingId, text: 'hi' } });
  const a1 = await as.A(`/api/chat?listingId=${listingId}`);
  assert.match(a1.data.conversation.id, /^conv-/);
  const own = await as.L(`/api/chat?listingId=${listingId}&tenant=${A.username}`);
  assert.equal(own.data.conversation.id, a1.data.conversation.id);
});

test('block stops both sides; only the blocker can unblock', { skip }, async () => {
  assert.equal((await as.L('/api/chat/block', { method: 'POST', body: { listingId, tenant: A.username, blocked: true } })).status, 200);
  assert.equal((await as.A('/api/chat', { method: 'POST', body: { listingId, text: 'still there?' } })).status, 403);
  assert.equal((await as.L('/api/chat', { method: 'POST', body: { listingId, tenant: A.username, text: 'x' } })).status, 403);
  // The tenant cannot lift the owner's block.
  const tryUnblock = await as.A('/api/chat/block', { method: 'POST', body: { listingId, blocked: false } });
  assert.equal(tryUnblock.data.conversation.blocked, true);
  // A different tenant is unaffected.
  assert.equal((await as.B('/api/chat', { method: 'POST', body: { listingId, text: 'hello' } })).status, 200);
  const un = await as.L('/api/chat/block', { method: 'POST', body: { listingId, tenant: A.username, blocked: false } });
  assert.equal(un.data.conversation.blocked, false);
  assert.equal((await as.A('/api/chat', { method: 'POST', body: { listingId, text: 'back' } })).status, 200);
});

test('reports: participants only, deduplicated, reviewed by the admin', { skip }, async () => {
  assert.equal((await as.anon('/api/reports', { method: 'POST', body: { kind: 'listing', listingId, reason: 'scam' } })).status, 401);
  assert.equal((await as.A('/api/reports', { method: 'POST', body: { kind: 'listing', listingId, reason: 'nonsense' } })).status, 400);
  assert.equal((await as.L('/api/reports', { method: 'POST', body: { kind: 'listing', listingId, reason: 'scam' } })).status, 400);
  const r1 = await as.A('/api/reports', { method: 'POST', body: { kind: 'conversation', listingId, reason: 'harassment', details: 'rude' } });
  assert.equal(r1.status, 200);
  const r2 = await as.A('/api/reports', { method: 'POST', body: { kind: 'conversation', listingId, reason: 'harassment' } });
  assert.equal(r2.data.duplicate, true);
  assert.equal(r2.data.report.id, r1.data.report.id);
  const lr = await as.B('/api/reports', { method: 'POST', body: { kind: 'listing', listingId, reason: 'wrong_info' } });
  assert.equal(lr.status, 200);
  // Non-admins cannot see reports or read conversations.
  assert.equal((await as.A('/api/admin/reports')).status, 401);
  const list = await admin('/api/admin/reports');
  const mine = list.data.reports.find((r) => r.id === r1.data.report.id);
  assert.equal(mine.kind, 'conversation');
  const conv = await admin(`/api/admin/conversation?id=${mine.targetId}`);
  assert.ok(conv.data.messages.some((m) => m.text === 'hi'));
  assert.ok(!conv.data.messages.some((m) => m.text === 'hello'), 'only the reported thread');
  assert.equal((await as.A(`/api/admin/conversation?id=${mine.targetId}`)).status, 401);
  assert.equal((await admin('/api/admin/reports', { method: 'POST', body: { id: mine.id } })).status, 200);
  const after = await admin('/api/admin/reports');
  assert.ok(!after.data.reports.some((r) => r.id === mine.id));
});

test('visit dates and times are validated on the server', { skip }, async () => {
  const post = (date, time) => as.B('/api/visits', { method: 'POST', body: { listingId, date, time } });
  assert.equal((await post(haitiDate(-1), '10:00')).data.error, 'past_date');
  assert.equal((await post(haitiDate(400), '10:00')).data.error, 'too_far');
  assert.equal((await post(haitiDate(2), '03:00')).data.error, 'outside_hours');
  assert.equal((await post(haitiDate(2), '10:15')).data.error, 'outside_hours');
  assert.equal((await post('2026-13-45', '10:00')).data.error, 'invalid_date');
});

test('visit flow: one active request, the other side answers, reschedule and cancel', { skip }, async () => {
  const v = await as.B('/api/visits', { method: 'POST', body: { listingId, date: haitiDate(2), time: '10:00' } });
  assert.equal(v.status, 200);
  const id = v.data.visit.id;
  assert.equal((await as.B('/api/visits', { method: 'POST', body: { listingId, date: haitiDate(3), time: '11:00' } })).status, 409);
  // The tenant proposed: the tenant cannot confirm their own proposal.
  assert.equal((await as.B('/api/visits/status', { method: 'POST', body: { id, action: 'confirm' } })).status, 403);
  // Another tenant cannot touch it.
  assert.equal((await as.A('/api/visits/status', { method: 'POST', body: { id, action: 'cancel' } })).status, 403);
  // Owner proposes another time: now the TENANT answers.
  const rs = await as.L('/api/visits/status', { method: 'POST', body: { id, action: 'reschedule', date: haitiDate(4), time: '14:00' } });
  assert.equal(rs.status, 200);
  assert.equal(rs.data.visit.proposedBy, 'owner');
  assert.equal(rs.data.visit.status, 'proposed');
  assert.equal((await as.L('/api/visits/status', { method: 'POST', body: { id, action: 'confirm' } })).status, 403);
  const ok = await as.B('/api/visits/status', { method: 'POST', body: { id, action: 'confirm' } });
  assert.equal(ok.data.visit.status, 'confirmed');
  assert.deepEqual(ok.data.visit.history.map((h) => h.action), ['proposed', 'rescheduled', 'confirmed']);
  const c = await as.B('/api/visits/status', { method: 'POST', body: { id, action: 'cancel' } });
  assert.equal(c.data.visit.status, 'cancelled');
  assert.equal((await as.B('/api/visits/status', { method: 'POST', body: { id, action: 'cancel' } })).status, 400);
  // Cancelled frees the slot for a new request.
  assert.equal((await as.B('/api/visits', { method: 'POST', body: { listingId, date: haitiDate(5), time: '09:00' } })).status, 200);
});
