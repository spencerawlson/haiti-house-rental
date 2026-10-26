// Scoped admin accounts (migration 0020): a partner account sees only
// numbers — accounts created, visits per day/week/month/year — and is
// refused everywhere else: no money, no individual accounts, no
// settings, no board. The scope rides inside the signed token, so the
// middleware enforces it without a database lookup.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, BASE, client, adminClient, uniq, haitiDate } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const USERNAME = `partner_${run}`;
const PASSWORD = 'partner-pass-123';
let admin;
let stats;

async function loginRaw(body) {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  return { status: res.status, cookie, data: await res.json().catch(() => null) };
}

before(async () => {
  if (skip) return;
  admin = await adminClient();
  const created = await admin('/api/admin/admin-users', { method: 'POST', body: { username: USERNAME, password: PASSWORD } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const logged = await loginRaw({ username: USERNAME, password: PASSWORD });
  assert.equal(logged.status, 200, JSON.stringify(logged.data));
  assert.equal(logged.data.scope, 'stats');
  stats = client(logged.cookie);
  // One real visit today, so the summary has something to count.
  const anon = client();
  assert.equal((await anon('/api/presence', { method: 'POST', body: { visitor: `partner-test-${run}` } })).status, 200);
});

test('full admin creates, lists and deletes scoped accounts, without ever leaking a hash', { skip }, async () => {
  const name = `partner2_${run}`;
  const created = await admin('/api/admin/admin-users', { method: 'POST', body: { username: name, password: 'partner-pass-123' } });
  assert.equal(created.status, 201);
  assert.equal(created.data.user.scope, 'stats');
  assert.ok(!('password_hash' in created.data.user));
  assert.equal((await admin('/api/admin/admin-users', { method: 'POST', body: { username: name, password: 'partner-pass-123' } })).status, 409, 'duplicate refused');
  assert.equal((await admin('/api/admin/admin-users', { method: 'POST', body: { username: `partner3_${run}`, password: 'short' } })).status, 400, 'short password refused');
  const listed = await admin('/api/admin/admin-users');
  assert.equal(listed.status, 200);
  const found = listed.data.users.find((u) => u.username === name);
  assert.ok(found, 'listed');
  assert.ok(!('password_hash' in found));
  assert.equal((await admin('/api/admin/admin-users', { method: 'DELETE', body: { username: name } })).status, 200);
  assert.equal((await admin('/api/admin/admin-users', { method: 'DELETE', body: { username: name } })).status, 404, 'second delete finds nothing');
});

test('stats login reads only numbers: accounts created and visits per day, week, month, year', { skip }, async () => {
  const r = await stats('/api/admin/stats-summary');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(typeof r.data.accountsCreated, 'number');
  assert.ok(r.data.accountsCreated >= 1, 'at least the accounts this suite made');
  for (const grain of ['daily', 'weekly', 'monthly', 'yearly']) {
    assert.ok(Array.isArray(r.data.visits[grain]), grain);
    for (const row of r.data.visits[grain]) {
      assert.deepEqual(Object.keys(row).sort(), ['period', 'visits'], 'a row is only a period and a count');
    }
  }
  const today = r.data.visits.daily.find((row) => row.period === haitiDate(0));
  assert.ok(today && today.visits >= 1, 'today has the visit this test made');
  const flat = JSON.stringify(r.data);
  for (const leak of ['password_hash', 'revenue', 'HTG', 'senderPhone', 'moncashNumber', 'natcashNumber']) {
    assert.ok(!flat.includes(leak), `no ${leak} in the stats response`);
  }
});

test('stats token is refused everywhere else: money, accounts, settings, user management', { skip }, async () => {
  for (const path of ['/api/admin/payments', '/api/admin/revenue', '/api/admin/settings', '/api/admin/ad-stats', '/api/admin/traffic', '/api/admin/audit', '/api/admin/presence', '/api/admin/reports', '/api/accounts']) {
    assert.equal((await stats(path)).status, 401, `refused: ${path}`);
  }
  assert.equal((await stats('/api/admin/admin-users', { method: 'POST', body: { username: `sneaky_${run}`, password: 'partner-pass-123' } })).status, 401, 'cannot create accounts');
  assert.equal((await stats('/api/admin/admin-users')).status, 401, 'cannot list accounts');
});

test('stats token is redirected off the board to the stats page', { skip }, async () => {
  const logged = await loginRaw({ username: USERNAME, password: PASSWORD });
  const res = await fetch(`${BASE}/ht/admin`, { headers: { Cookie: logged.cookie }, redirect: 'manual' });
  assert.equal(res.status, 307);
  assert.ok(res.headers.get('location').endsWith('/ht/stats'), res.headers.get('location'));
  const ok = await fetch(`${BASE}/ht/stats`, { headers: { Cookie: logged.cookie }, redirect: 'manual' });
  assert.ok([200, 307].includes(ok.status), `stats page reachable: ${ok.status}`);
});

test('full-admin password-only login still works', { skip }, async () => {
  const logged = await loginRaw({ password: ADMIN_PASSWORD });
  assert.equal(logged.status, 200);
  assert.equal(logged.data.scope, 'full');
});

test('wrong credentials fail, and deleting the account revokes the login', { skip }, async () => {
  assert.equal((await loginRaw({ username: USERNAME, password: 'wrong-password' })).status, 401);
  assert.equal((await loginRaw({ username: `nobody_${run}`, password: PASSWORD })).status, 401);
  assert.equal((await admin('/api/admin/admin-users', { method: 'DELETE', body: { username: USERNAME } })).status, 200);
  assert.equal((await loginRaw({ username: USERNAME, password: PASSWORD })).status, 401, 'deleted account cannot sign in');
});
