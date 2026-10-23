// End-to-end journeys, safe to run against PRODUCTION (kayayiti.app).
//
//   BASE_URL=https://kayayiti.app ADMIN_PASSWORD=... node tests/journeys.mjs --yes-production
//
// What it does, using only its own clearly-labeled test data:
// - creates `qa_…` accounts: a tenant, and a landlord as a free PARTNER
//   account (so no activation fee and nothing counted as revenue)
// - the landlord posts "QA test — not a real home"
// - tenant: search finds it, detail + gallery load, chat, visit request
// - landlord: reads and replies, confirms, the visit is rescheduled and
//   cancelled, notifications arrive on both sides
// - an advertising payment is submitted and REJECTED by the admin, and a
//   report is filed and resolved, so both admin queues are exercised
// - cleanup: the listing is taken down (hidden). Accounts stay (there is
//   no account deletion), named qa_… so they are easy to spot.
// Phones are +509 0000 0000 — not a real number, so no SMS reaches anyone.
// It never touches a real user's listing, chat, visit or payment.
import { createHash } from 'node:crypto';

const BASE = (process.env.BASE_URL || '').replace(/\/$/, '');
const ADMIN = process.env.ADMIN_PASSWORD || '';
if (!BASE || !ADMIN) {
  console.error('Set BASE_URL and ADMIN_PASSWORD.');
  process.exit(2);
}
if (/kayayiti\.app/.test(BASE) && !process.argv.includes('--yes-production')) {
  console.error('This writes test data to production. Re-run with --yes-production to confirm.');
  process.exit(2);
}

const sha = (s) => createHash('sha256').update(s).digest('hex');
const id = Date.now().toString(36);
const PHONE = '+509 0000 0000';
let failures = 0;
const results = [];

function client() {
  const jar = {};
  return async (path, { method = 'GET', body } = {}) => {
    const headers = { Origin: BASE };
    if (body) headers['Content-Type'] = 'application/json';
    const c = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    if (c) headers.Cookie = c;
    const t0 = Date.now();
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
    for (const sc of res.headers.getSetCookie?.() || []) {
      const [pair] = sc.split(';');
      const i = pair.indexOf('=');
      const v = pair.slice(i + 1);
      if (v) jar[pair.slice(0, i)] = v; else delete jar[pair.slice(0, i)];
    }
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return { status: res.status, data, text, ms: Date.now() - t0 };
  };
}

async function step(name, fn) {
  try {
    const detail = await fn();
    results.push(['PASS', name, detail || '']);
  } catch (e) {
    failures++;
    results.push(['FAIL', name, e.message]);
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function eventually(fn, tries = 20) {
  for (let i = 0; i < tries; i++) { const v = await fn(); if (v) return v; await wait(250); }
  return null;
}
function haitiDate(days) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Port-au-Prince' });
  return new Date(Date.parse(`${today}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

const admin = client();
const landlord = client();
const tenant = client();
const anon = client();
const L = { username: `qa_landlord_${id}`, password: `qa-${id}-L!`, name: 'QA Landlord' };
const T = { username: `qa_tenant_${id}`, password: `qa-${id}-T!`, name: 'QA Tenant' };
let listingId;
let visitId;

await step('health is ok and fully migrated', async () => {
  const r = await anon('/api/health');
  expect(r.status === 200 && r.data.ok, `health ${r.status} ${r.text}`);
  return `schema ${r.data.schema}`;
});
await step('admin signs in', async () => {
  const r = await admin('/api/admin/login', { method: 'POST', body: { password: ADMIN } });
  expect(r.status === 200, `admin login ${r.status}`);
});
await step('landlord account (free partner, no revenue) is created', async () => {
  const r = await admin('/api/admin/partner', { method: 'POST', body: { name: L.name, username: L.username, passwordHash: sha(L.password), phone: PHONE, location: { department: 'ouest', commune: 'Delmas' } } });
  expect(r.status === 200 && r.data.account.activated, `partner ${r.status} ${r.text}`);
});
await step('landlord signs in', async () => {
  const r = await landlord('/api/accounts/signin', { method: 'POST', body: { username: L.username, passwordHash: sha(L.password) } });
  expect(r.status === 200, `signin ${r.status}`);
  return `${r.ms} ms`;
});
await step('landlord posts a listing with details', async () => {
  const r = await landlord('/api/listings', { method: 'POST', body: {
    title: `QA test — not a real home ${id}`, description: 'Automated test listing. It is taken down when the test ends.',
    commune: 'Delmas', department: 'ouest', priceHTG: 1, purpose: 'rent', type: 'apartment', bedrooms: 1, bathrooms: 1, lat: 18.54, lng: -72.3,
    details: { water: 'city', power24: true, internet: 'included' },
  } });
  expect(r.status === 200, `post ${r.status} ${r.text}`);
  listingId = r.data.listing.id;
  return listingId;
});
await step('tenant signs up (free) and is signed in', async () => {
  const r = await tenant('/api/accounts', { method: 'POST', body: { name: T.name, username: T.username, passwordHash: sha(T.password), phone: PHONE, role: 'tenant' } });
  expect(r.status === 200 && r.data.account.activated, `signup ${r.status} ${r.text}`);
  expect((await tenant('/api/accounts/me')).status === 200, 'no session after signup');
});
await step('search finds the listing; detail and gallery pages load', async () => {
  const s = await tenant('/api/listings');
  expect(s.data.listings.some((l) => l.id === listingId), 'not in search');
  const page = await tenant(`/ht/listings/${listingId}`);
  expect(page.status === 200 && page.text.includes('QA test'), `detail ${page.status}`);
  const gal = await tenant(`/ht/listings/${listingId}/photos`);
  expect([200, 404].includes(gal.status), `gallery ${gal.status}`);
  return `detail ${page.ms} ms`;
});
await step('tenant writes; landlord sees only this conversation and replies', async () => {
  expect((await tenant('/api/chat', { method: 'POST', body: { listingId, text: 'QA: hello, is it available?' } })).status === 200, 'tenant send');
  const own = await landlord(`/api/chat?listingId=${listingId}&tenant=${T.username}`);
  expect(own.data.messages.length === 1, 'landlord does not see the message');
  expect((await landlord('/api/chat', { method: 'POST', body: { listingId, tenant: T.username, text: 'QA: yes, come visit.' } })).status === 200, 'landlord reply');
  const back = await tenant(`/api/chat?listingId=${listingId}`);
  expect(back.data.messages.map((m) => m.sender).join(',') === 'tenant,owner', 'tenant does not see the reply');
});
await step('visit: request → landlord notified → confirm → tenant notified', async () => {
  const v = await tenant('/api/visits', { method: 'POST', body: { listingId, date: haitiDate(3), time: '10:00', message: 'QA visit' } });
  expect(v.status === 200, `visit ${v.status} ${v.text}`);
  visitId = v.data.visit.id;
  const n1 = await eventually(async () => (await landlord('/api/notifications')).data?.notifications?.find((n) => n.kind === 'visit_proposed'));
  expect(n1, 'landlord got no visit notification');
  expect((await landlord('/api/visits/status', { method: 'POST', body: { id: visitId, action: 'confirm' } })).data?.visit?.status === 'confirmed', 'confirm failed');
  const n2 = await eventually(async () => (await tenant('/api/notifications')).data?.notifications?.find((n) => n.kind === 'visit_confirmed'));
  expect(n2, 'tenant got no confirmation notification');
});
await step('visit: tenant reschedules, landlord confirms, tenant cancels', async () => {
  expect((await tenant('/api/visits/status', { method: 'POST', body: { id: visitId, action: 'reschedule', date: haitiDate(4), time: '14:00' } })).status === 200, 'reschedule');
  expect((await landlord('/api/visits/status', { method: 'POST', body: { id: visitId, action: 'confirm' } })).status === 200, 'confirm 2');
  const c = await tenant('/api/visits/status', { method: 'POST', body: { id: visitId, action: 'cancel' } });
  expect(c.data?.visit?.status === 'cancelled', 'cancel');
  return c.data.visit.history.map((h) => h.action).join(' → ');
});
await step('advertising payment submitted, then rejected by the admin (no revenue)', async () => {
  const p = await landlord('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId, months: 1, provider: 'moncash', reference: `QA${id}` } });
  expect(p.status === 200 && p.data.payment.amountHTG === 75, `payment ${p.status} ${p.text}`);
  const r = await admin('/api/admin/payments', { method: 'POST', body: { id: p.data.payment.id, decision: 'rejected', note: 'QA test — not a real payment' } });
  expect(r.data?.payment?.status === 'rejected', 'reject');
});
await step('report filed by the tenant, resolved by the admin', async () => {
  const rp = await tenant('/api/reports', { method: 'POST', body: { kind: 'listing', listingId, reason: 'other', details: 'QA test report' } });
  expect(rp.status === 200, `report ${rp.status}`);
  expect((await admin('/api/admin/reports', { method: 'POST', body: { id: rp.data.report.id } })).status === 200, 'resolve');
});
await step('privacy: a signed-out visitor sees no chat, visits or phone', async () => {
  expect((await anon(`/api/chat?listingId=${listingId}`)).status === 401, 'chat leaked');
  expect((await anon(`/api/visits?listingId=${listingId}`)).data.visits.length === 0, 'visits leaked');
  expect((await anon(`/api/accounts?username=${L.username}`)).data.account.phone === undefined, 'phone leaked');
});
await step('cleanup: the test listing is taken down', async () => {
  const r = await landlord('/api/listings/takedown', { method: 'POST', body: { id: listingId } });
  expect(r.status === 200, `takedown ${r.status}`);
  expect((await anon(`/api/listings?id=${listingId}`)).status === 404, 'still public');
});

for (const [s, name, detail] of results) console.log(`${s === 'PASS' ? '✔' : '✖'} ${name}${detail ? `  (${detail})` : ''}`);
console.log(`\n${results.length - failures}/${results.length} passed. Test accounts: ${L.username}, ${T.username}.`);
process.exit(failures ? 1 : 0);
