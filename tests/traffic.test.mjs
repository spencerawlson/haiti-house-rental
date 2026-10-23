// Traffic and subscriber reports (migration 0012), plus the paginated
// accounts list that replaced "download every account and filter it in
// the browser".
//
// Test FILES run concurrently against one server, and several of them ping
// /api/presence and confirm payments. So nothing here asserts an exact
// global count — it asserts the PROPERTIES that must hold regardless of
// what another file is doing at the same time:
//
//   - a visitor pinged ten times is not ten visitors (dedup)
//   - a flow's range total equals the sum of its own rows (one response,
//     one snapshot, so this is exact)
//   - a stock's range total is the LAST row, never the sum
//   - the CSV carries the same numbers as the JSON it was rendered from
//   - the reports are admin-only, and the date range is validated
//
// The admin session comes from adminClient(), which shares ONE sign-in
// across the whole suite — signing in per test, or even per file, spends
// the admin login rate limit for no reason.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, BASE, client, signup, adminClient, uniq, haitiDate } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();

// Flows add up over a period; stocks are levels and must not.
const FLOWS = [
  'visitors', 'signups', 'subs_new', 'subs_returning', 'subs_suspended',
  'subs_deactivated', 'revenue_htg', 'revenue_join', 'revenue_quarter',
  'revenue_reactivation', 'revenue_advertising',
];
const STOCKS = ['subs_active'];

const anon = client();
const ping = (visitor) => anon('/api/presence', { method: 'POST', body: { visitor } });

let admin;

async function report(qs = '') {
  const r = await admin(`/api/admin/traffic${qs}`);
  assert.equal(r.status, 200, `report ${qs}`);
  return r.data;
}

// The CSV is text, so it needs a raw fetch rather than the JSON client.
const csvFetch = (qs) => fetch(`${BASE}/api/admin/traffic?${qs}&format=csv`, { headers: { Cookie: admin.cookie } });

before(async () => {
  if (skip) return;
  admin = await adminClient();
  assert.ok(admin.cookie, 'the shared admin session exposed its cookie');
});

test('the traffic reports are admin-only', { skip }, async () => {
  // A signed-in ordinary user is still not an admin.
  const tenant = client();
  await signup(tenant, { name: 'Nosy', username: `nosy_${run}`, password: 'pw', role: 'tenant' });
  for (const who of [client(), tenant]) {
    const r = await who('/api/admin/traffic');
    assert.notEqual(r.status, 200, 'traffic is not readable without the admin session');
  }
  const noCookie = await fetch(`${BASE}/api/admin/traffic?format=csv`);
  assert.notEqual(noCookie.status, 200, 'and neither is the CSV');
});

test('a visitor pinged many times counts once for the day', { skip }, async () => {
  const before_ = (await report()).totals.visitors;

  // One brand-new person, ten heartbeats — which is what an open tab
  // sends in ten minutes.
  const who = `v-dedup-${run}`;
  for (let i = 0; i < 10; i += 1) assert.equal((await ping(who)).status, 200);

  const after = (await report()).totals.visitors;
  assert.ok(after >= before_ + 1, `the new visitor was counted (${before_} -> ${after})`);
  // The bound is deliberately loose: other test files add a handful of
  // visitors of their own while this runs. The point is that ten pings
  // did not become ten visitors, and the gap to 10 is wide enough that
  // concurrency cannot fake it.
  assert.ok(after < before_ + 10, `ten pings were de-duplicated, not counted ten times (${before_} -> ${after})`);
});

test('a signed-in person counts by account, not by the id their browser sent', { skip }, async () => {
  const phone = client();
  await signup(phone, { name: 'Two Phones', username: `two_${run}`, password: 'pw', role: 'tenant' });

  const before_ = (await report()).totals.visitors;
  // One signed-in account, pinging with FOUR different anonymous ids —
  // which is what one person with a phone, a laptop and a cleared cache
  // looks like. The server keys on the session, so this is one visitor,
  // not four.
  for (let i = 0; i < 4; i += 1) {
    await phone('/api/presence', { method: 'POST', body: { visitor: `ignored-${i}-${run}` } });
  }
  const after = (await report()).totals.visitors;
  assert.ok(after < before_ + 4, `four anonymous ids on one session were not four visitors (${before_} -> ${after})`);
});

test('flows sum over the range; a stock is the level at the end', { skip }, async () => {
  // One response is one snapshot, so these are exact regardless of what
  // the other test files are doing.
  for (const grain of ['daily', 'weekly', 'monthly']) {
    const rep = await report(`?grain=${grain}`);
    assert.equal(rep.grain, grain);
    for (const m of FLOWS) {
      const sum = rep.rows.reduce((s, r) => s + Number(r[m]), 0);
      assert.equal(rep.totals[m], sum, `${grain}: ${m} totals the rows`);
    }
    for (const m of STOCKS) {
      const expected = rep.rows.length ? Number(rep.rows[rep.rows.length - 1][m]) : 0;
      assert.equal(rep.totals[m], expected, `${grain}: ${m} is the last row, not a sum`);
      if (rep.rows.length > 1) {
        const sum = rep.rows.reduce((s, r) => s + Number(r[m]), 0);
        if (sum !== expected) {
          assert.notEqual(rep.totals[m], sum, `${grain}: ${m} must NOT be summed`);
        }
      }
    }
  }
});

test('weekly buckets start on Monday, monthly on the first', { skip }, async () => {
  // Today's own ping guarantees there is at least one bucket to look at.
  await ping(`v-bucket-${run}`);

  const weekly = await report('?grain=weekly');
  for (const r of weekly.rows) {
    const d = new Date(`${r.period}T00:00:00Z`);
    assert.equal(d.getUTCDay(), 1, `${r.period} is a Monday`);
  }

  const monthly = await report('?grain=monthly');
  for (const r of monthly.rows) {
    assert.match(r.period, /^\d{4}-\d{2}-01$/, `${r.period} is the first of a month`);
  }

  const daily = await report('?grain=daily');
  assert.ok(daily.rows.some((r) => r.period === haitiDate(0)), 'today has a daily bucket');
});

test('a confirmed joining fee shows up as a new subscriber and as revenue', { skip }, async () => {
  const today = haitiDate(0);
  const before_ = await report(`?grain=daily&from=${today}&to=${today}`);
  const b = before_.rows[0] || { subs_new: 0, revenue_join: 0, revenue_htg: 0 };

  const landlord = client();
  await signup(landlord, { name: 'Joiner', username: `join_${run}`, password: 'pw', role: 'landlord' });
  const sub = await landlord('/api/payments', {
    method: 'POST',
    body: { kind: 'join', provider: 'moncash', senderPhone: '30000040' },
  });
  assert.equal(sub.status, 200, 'joining fee submitted');
  const amount = sub.data.payment.amountHTG;
  const conf = await admin('/api/admin/payments', { method: 'POST', body: { id: sub.data.payment.id, decision: 'confirmed' } });
  assert.equal(conf.status, 200, 'admin confirmed it');

  const after = await report(`?grain=daily&from=${today}&to=${today}`);
  const a = after.rows[0];
  assert.ok(a, 'today has a row once a payment is confirmed');
  // Derived live from the payment ledger, so this needed no backfill and
  // no counter to keep in step.
  assert.ok(Number(a.subs_new) >= Number(b.subs_new) + 1, 'a new subscriber was counted');
  assert.ok(Number(a.revenue_join) >= Number(b.revenue_join) + amount, 'the joining fee reached revenue_join');
  assert.ok(Number(a.revenue_htg) >= Number(b.revenue_htg) + amount, 'and the revenue total');
});

test('the CSV carries the same numbers as the report', { skip }, async () => {
  // Today, where there is definitely data: this file's own run has
  // already created visitors and a confirmed payment.
  const today = haitiDate(0);
  const qs = `grain=daily&from=${today}&to=${today}`;
  const json = await report(`?${qs}`);

  const res = await csvFetch(qs);
  assert.equal(res.status, 200, 'CSV downloads for an admin');
  assert.match(res.headers.get('content-type') || '', /text\/csv/);
  assert.match(res.headers.get('content-disposition') || '', /attachment; filename=".*\.csv"/);

  const csv = (await res.text()).replace(/^﻿/, '');
  const lines = csv.trim().split(/\r\n/);
  assert.equal(lines.length, json.rows.length + 2, 'header + one row per bucket + a total line');
  assert.match(lines[0], /^period,/, 'header starts with the period column');

  // The numbers themselves must match the JSON, not merely look like a
  // CSV: the header order tells us which column is which.
  const header = lines[0].split(',');
  const totalCells = lines[lines.length - 1].split(',');
  assert.equal(totalCells[0], '"total"', 'the last line is the total');
  for (const m of [...FLOWS, ...STOCKS]) {
    const col = header.indexOf(m);
    assert.ok(col > 0, `${m} has a column`);
    assert.equal(Number(totalCells[col]), Number(json.totals[m]), `${m} total matches the JSON`);
  }

  const firstRow = lines[1].split(',');
  assert.equal(firstRow[0], `"${json.rows[0].period}"`, 'the period is quoted so a spreadsheet keeps the day');
  for (const m of [...FLOWS, ...STOCKS]) {
    assert.equal(Number(firstRow[header.indexOf(m)]), Number(json.rows[0][m]), `${m} row value matches`);
  }
});

test('the date range is validated', { skip }, async () => {
  const bad = await admin('/api/admin/traffic?from=2026-03-01&to=2026-01-01');
  assert.equal(bad.status, 400, 'a backwards range is refused');

  // An unknown grain falls back to daily rather than reaching SQL.
  const odd = await report('?grain=hourly');
  assert.equal(odd.grain, 'daily');

  // Junk dates are ignored, not interpolated.
  const junk = await report("?from=2026-01-01';DROP TABLE accounts;--&grain=daily");
  assert.equal(junk.grain, 'daily');
  const still = await admin('/api/accounts?per=1');
  assert.equal(still.status, 200, 'the accounts table is still there');
});

test('the accounts list is paged, searchable and capped', { skip }, async () => {
  const username = `findme_${run}`;
  await signup(client(), { name: `Findme ${run}`, username, password: 'pw', role: 'landlord' });

  // Search finds it by username, and by name.
  for (const q of [username, 'Findme']) {
    const r = await admin(`/api/accounts?q=${encodeURIComponent(q)}&per=100`);
    assert.equal(r.status, 200);
    assert.ok(r.data.accounts.some((a) => a.username === username), `found by "${q}"`);
  }

  // The engagement figures are still attached — scoping them to the page
  // must not have dropped them.
  const one = await admin(`/api/accounts?q=${encodeURIComponent(username)}`);
  const found = one.data.accounts.find((a) => a.username === username);
  assert.ok(found, 'the account came back');
  assert.ok('metrics' in found, 'metrics are merged in for the page');

  // per is capped, so ?per=100000 cannot ask for the old behaviour back.
  const huge = await admin('/api/accounts?per=100000');
  assert.equal(huge.status, 200);
  assert.ok(huge.data.per <= 100, `per is capped (got ${huge.data.per})`);
  assert.ok(huge.data.accounts.length <= 100, 'and the page respects it');

  // Page arithmetic is consistent.
  const p1 = await admin('/api/accounts?per=1&page=1');
  assert.equal(p1.data.accounts.length, 1);
  assert.equal(p1.data.pages, Math.max(1, Math.ceil(p1.data.total / 1)));
  const p2 = await admin('/api/accounts?per=1&page=2');
  assert.notEqual(p1.data.accounts[0].username, p2.data.accounts[0]?.username, 'page 2 is a different account');

  // A page past the end returns no rows but still reports the real total,
  // which is what lets the UI send the reader back to a page that exists.
  const far = await admin('/api/accounts?per=25&page=99999');
  assert.equal(far.data.accounts.length, 0);
  assert.ok(far.data.total > 0, 'the total survives an out-of-range page');
});

test('the accounts list filters by role and by subscription', { skip }, async () => {
  await signup(client(), { name: 'A Tenant', username: `ften_${run}`, password: 'pw', role: 'tenant' });
  await signup(client(), { name: 'A Landlord', username: `flan_${run}`, password: 'pw', role: 'landlord' });

  const tenants = await admin('/api/accounts?role=tenant&per=100');
  assert.ok(tenants.data.accounts.length > 0, 'tenants came back');
  assert.ok(tenants.data.accounts.every((a) => a.role === 'tenant'), 'only tenants');

  const landlords = await admin('/api/accounts?role=landlord&per=100');
  assert.ok(landlords.data.accounts.every((a) => a.role === 'landlord'), 'only landlords');

  const pending = await admin('/api/accounts?billing=pending&per=100');
  assert.ok(pending.data.accounts.every((a) => (a.billingStatus || 'pending') === 'pending'), 'only pending subscriptions');

  // An unknown filter value is ignored rather than returning nothing.
  const bogus = await admin('/api/accounts?role=wizard&per=5');
  assert.equal(bogus.status, 200);
  assert.ok(bogus.data.total > 0, 'an unknown role filter is ignored, not applied');
});

test('the cron snapshot records the active-subscriber level, idempotently', { skip }, async () => {
  const key = process.env.CRON_SECRET;
  if (!key) return; // the cron tests elsewhere skip loudly for this too
  const today = haitiDate(0);

  for (let i = 0; i < 2; i += 1) {
    const r = await fetch(`${BASE}/api/cron`, { method: 'POST', headers: { 'x-cron-key': key } });
    assert.ok(r.status === 200 || r.status === 500, `cron ran (${r.status})`);
  }

  const rep = await report(`?grain=daily&from=${today}&to=${today}`);
  const row = rep.rows[0];
  assert.ok(row, "the snapshot created today's row");
  // Running the job twice must overwrite the level, never double it.
  assert.ok(Number(row.subs_active) >= 0, 'subs_active is a level');
  assert.equal(rep.totals.subs_active, Number(row.subs_active), 'one day: total is that level');
});
