// Authentication + authorization regression tests (Phase 1).
// Run against a running app with a THROWAWAY database — never production:
//
//   BASE_URL=http://host:port ADMIN_PASSWORD=... npm test
//
// Every test here is an attack that worked before Phase 1: acting as
// another user by naming them in a request body, reading other people's
// chats/visits/phones, skipping the activation fee, guessing passwords.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, ADMIN_PASSWORD, sha, client, haitiDate } from './helpers.mjs';

const run = Date.now().toString(36);

const users = {
  landlord: { name: 'Lan Lord', username: `land_${run}`, password: 'pw-landlord-1', phone: '+509 3000 0001', role: 'landlord' },
  t1: { name: 'Tina One', username: `ten1_${run}`, password: 'pw-tenant-1', phone: '+509 3000 0002', role: 'tenant' },
  t2: { name: 'Toni Two', username: `ten2_${run}`, password: 'pw-tenant-2', phone: '+509 3000 0003', role: 'tenant' },
};
const as = { landlord: client(), t1: client(), t2: client(), anon: client(), admin: client() };
let listingId;

async function signup(who) {
  const u = users[who];
  return as[who]('/api/accounts', { method: 'POST', body: { ...u, password: undefined, passwordHash: sha(u.password) } });
}

before(async () => {
  for (const who of ['landlord', 't1', 't2']) assert.equal((await signup(who)).status, 200, `signup ${who}`);
  if (ADMIN_PASSWORD) {
    assert.equal((await as.admin('/api/admin/login', { method: 'POST', body: { password: ADMIN_PASSWORD } })).status, 200);
    assert.equal((await as.admin('/api/admin/activate', { method: 'POST', body: { username: users.landlord.username, activated: true } })).status, 200);
  }
});

test('signup cannot self-grant a free partner account', async () => {
  const c = client();
  const r = await c('/api/accounts', { method: 'POST', body: { name: 'Sneaky', username: `sneak_${run}`, passwordHash: sha('x'), phone: '1', role: 'landlord', partner: true, activated: true } });
  assert.equal(r.status, 200);
  assert.equal(r.data.account.activated, false);
  assert.equal(r.data.account.partner, false);
});

test('public profile lookup hides phone and email', async () => {
  const r = await as.anon(`/api/accounts?username=${users.landlord.username}`);
  assert.equal(r.status, 200);
  assert.equal(r.data.account.phone, undefined);
  assert.equal(r.data.account.email, undefined);
});

test('full accounts list is admin-only', async () => {
  assert.equal((await as.t1('/api/accounts')).status, 401);
});

test('/me needs a session and returns only your own account', async () => {
  assert.equal((await as.anon('/api/accounts/me')).status, 401);
  const r = await as.t1('/api/accounts/me');
  assert.equal(r.data.account.username, users.t1.username);
});

test('stored passwords are not the browser hash (sign-in still works)', async () => {
  const c = client();
  const ok = await c('/api/accounts/signin', { method: 'POST', body: { username: users.t1.username, passwordHash: sha(users.t1.password) } });
  assert.equal(ok.status, 200);
  const bad = await c('/api/accounts/signin', { method: 'POST', body: { username: users.t1.username, passwordHash: sha('wrong') } });
  assert.equal(bad.status, 401);
});

test('only an activated landlord session can post — a body `owner` is ignored', { skip: !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD to activate the landlord' }, async () => {
  const body = { title: 'Test home', commune: 'Delmas', department: 'ouest', priceHTG: 1000, purpose: 'rent', lat: 18.54, lng: -72.3 };
  assert.equal((await as.anon('/api/listings', { method: 'POST', body: { ...body, owner: users.landlord.username } })).status, 403);
  assert.equal((await as.t1('/api/listings', { method: 'POST', body: { ...body, owner: users.landlord.username } })).status, 403);
  const r = await as.landlord('/api/listings', { method: 'POST', body: { ...body, owner: users.t1.username } });
  assert.equal(r.status, 200);
  assert.equal(r.data.listing.owner, users.landlord.username);
  listingId = r.data.listing.id;
});

test('a tenant cannot edit or take down the landlord listing by naming them', { skip: !ADMIN_PASSWORD && 'needs a listing' }, async () => {
  const patch = await as.t1('/api/listings', { method: 'PATCH', body: { id: listingId, username: users.landlord.username, title: 'Hacked', commune: 'Delmas' } });
  assert.equal(patch.status, 403);
  const down = await as.t1('/api/listings/takedown', { method: 'POST', body: { id: listingId, username: users.landlord.username } });
  assert.equal(down.status, 403);
  const lib = await as.t1(`/api/listings?owner=${users.landlord.username}&all=1`);
  assert.deepEqual(lib.data.listings, []);
});

test('chats are private per tenant', { skip: !ADMIN_PASSWORD && 'needs a listing' }, async () => {
  assert.equal((await as.anon(`/api/chat?listingId=${listingId}`)).status, 401);
  assert.equal((await as.anon('/api/chat', { method: 'POST', body: { listingId, text: 'anon' } })).status, 401);
  // A tenant claiming to be the owner still writes as the tenant.
  const m1 = await as.t1('/api/chat', { method: 'POST', body: { listingId, text: 'hello from t1', sender: 'owner', author: users.landlord.username } });
  assert.equal(m1.status, 200);
  assert.equal(m1.data.message.sender, 'tenant');
  assert.equal(m1.data.message.author, users.t1.username);
  await as.t2('/api/chat', { method: 'POST', body: { listingId, text: 'hello from t2' } });
  // t2 asking for t1's thread gets their own.
  const t2view = await as.t2(`/api/chat?listingId=${listingId}&tenant=${users.t1.username}`);
  assert.deepEqual(t2view.data.messages.map((m) => m.text), ['hello from t2']);
  // Owner reads each thread separately and replies into t1's only.
  const own = await as.landlord(`/api/chat?listingId=${listingId}&tenant=${users.t1.username}`);
  assert.deepEqual(own.data.messages.map((m) => m.text), ['hello from t1']);
  assert.equal((await as.landlord('/api/chat', { method: 'POST', body: { listingId, tenant: users.t1.username, text: 'reply to t1' } })).status, 200);
  assert.equal((await as.landlord('/api/chat', { method: 'POST', body: { listingId, tenant: `nobody_${run}`, text: 'x' } })).status, 400);
  const t1view = await as.t1(`/api/chat?listingId=${listingId}`);
  assert.deepEqual(t1view.data.messages.map((m) => m.text), ['hello from t1', 'reply to t1']);
  const t2again = await as.t2(`/api/chat?listingId=${listingId}`);
  assert.ok(!t2again.data.messages.some((m) => m.text === 'reply to t1'));
  // Inbox: owner has two threads, each tenant one; unread is per thread.
  const inbox = await as.landlord('/api/chat/inbox');
  assert.equal(inbox.data.threads.filter((t) => t.listingId === listingId).length, 2);
  const t1inbox = await as.t1('/api/chat/inbox');
  assert.equal(t1inbox.data.threads.find((t) => t.listingId === listingId).unread, 1);
  assert.equal((await as.anon('/api/chat/inbox')).data.threads.length, 0);
});

test('visits are private and only the owner decides', { skip: !ADMIN_PASSWORD && 'needs a listing' }, async () => {
  assert.equal((await as.anon('/api/visits', { method: 'POST', body: { listingId, date: haitiDate(3), time: '10:00' } })).status, 401);
  const v = await as.t1('/api/visits', { method: 'POST', body: { listingId, tenant: users.t2.username, date: haitiDate(3), time: '10:00' } });
  assert.equal(v.status, 200);
  assert.equal(v.data.visit.tenant, users.t1.username);
  assert.deepEqual((await as.t2(`/api/visits?listingId=${listingId}`)).data.visits, []);
  assert.deepEqual((await as.anon(`/api/visits?listingId=${listingId}`)).data.visits, []);
  assert.equal((await as.landlord(`/api/visits?listingId=${listingId}`)).data.visits.length, 1);
  assert.equal((await as.t1('/api/visits/status', { method: 'POST', body: { id: v.data.visit.id, status: 'confirmed', username: users.landlord.username } })).status, 403);
  assert.equal((await as.landlord('/api/visits/status', { method: 'POST', body: { id: v.data.visit.id, status: 'confirmed' } })).status, 200);
});

test('uploads need an activated landlord session and a served format', async () => {
  const form = () => {
    const f = new FormData();
    f.append('file', new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }), 'a.jpg');
    return f;
  };
  assert.equal((await as.anon('/api/upload', { method: 'POST', form: form() })).status, 403);
  assert.equal((await as.t1('/api/upload', { method: 'POST', form: form() })).status, 403);
  if (ADMIN_PASSWORD) {
    const svg = new FormData();
    svg.append('file', new Blob(['<svg onload="alert(1)"/>'], { type: 'image/svg+xml' }), 'x.svg');
    assert.equal((await as.landlord('/api/upload', { method: 'POST', form: svg })).status, 400);
  }
});

test('transfer flag applies to the session account, not a named one', async () => {
  const r = await as.t2('/api/accounts/transfer', { method: 'POST', body: { username: users.landlord.username, provider: 'moncash' } });
  assert.equal(r.data.account.username, users.t2.username);
});

test('phone number alone no longer resets a password', async () => {
  const r = await as.anon('/api/password-reset', { method: 'POST', body: { username: users.t2.username, phone: '30000003', passwordHash: sha('x') } });
  assert.equal(r.status, 400);
  assert.equal((await as.anon('/api/admin/reset-code', { method: 'POST', body: { username: users.t2.username } })).status, 401);
});

test('admin reset code: single use, and the reset signs out every device', { skip: !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD' }, async () => {
  const other = client();
  await other('/api/accounts/signin', { method: 'POST', body: { username: users.t2.username, passwordHash: sha(users.t2.password) } });
  assert.equal((await other('/api/accounts/me')).status, 200);
  const issued = await as.admin('/api/admin/reset-code', { method: 'POST', body: { username: users.t2.username } });
  assert.equal(issued.status, 200);
  assert.match(issued.data.code, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  assert.equal((await as.anon('/api/password-reset', { method: 'POST', body: { username: users.t2.username, code: 'WRONG-CODE0', passwordHash: sha('new-pw') } })).status, 400);
  // Codes are typed by hand: lower case and no dash still work.
  const typed = issued.data.code.toLowerCase().replace('-', '');
  assert.equal((await as.anon('/api/password-reset', { method: 'POST', body: { username: users.t2.username, code: typed, passwordHash: sha('new-pw') } })).status, 200);
  assert.equal((await as.anon('/api/password-reset', { method: 'POST', body: { username: users.t2.username, code: typed, passwordHash: sha('again') } })).status, 400);
  assert.equal((await other('/api/accounts/me')).status, 401);
  assert.equal((await as.t2('/api/accounts/me')).status, 401);
  const c = client();
  assert.equal((await c('/api/accounts/signin', { method: 'POST', body: { username: users.t2.username, passwordHash: sha('new-pw') } })).status, 200);
});

test('admin cookie: the old static SHA-256 value and forged tokens are refused', { skip: !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD' }, async () => {
  const tryCookie = async (value) => (await fetch(`${BASE}/api/admin/revenue`, { headers: { Cookie: `kay_admin=${value}` } })).status;
  assert.equal(await tryCookie(sha(ADMIN_PASSWORD)), 401);
  assert.equal(await tryCookie(`${Date.now() + 1e9}.abcd.${'0'.repeat(64)}`), 401);
  assert.equal((await as.admin('/api/admin/revenue')).status, 200);
});

test('cross-site POSTs are refused', async () => {
  const res = await fetch(`${BASE}/api/accounts/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
    body: JSON.stringify({ username: users.t1.username, passwordHash: sha(users.t1.password) }),
  });
  assert.equal(res.status, 403);
  const same = await fetch(`${BASE}/api/accounts/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: new URL(BASE).origin },
    body: JSON.stringify({ username: users.t1.username, passwordHash: sha(users.t1.password) }),
  });
  assert.equal(same.status, 200);
});

test('upload content must match its extension', { skip: !ADMIN_PASSWORD && 'needs an activated landlord' }, async () => {
  const send = (bytes, type, name) => {
    const f = new FormData();
    f.append('file', new Blob([bytes], { type }), name);
    return as.landlord('/api/upload', { method: 'POST', form: f });
  };
  assert.equal((await send('<html><script>alert(1)</script>', 'image/jpeg', 'fake.jpg')).status, 400);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const ok = await send(png, 'image/png', 'real.png');
  assert.equal(ok.status, 200);
  const served = await fetch(BASE + ok.data.url);
  assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
});

test('sign-out ends the session server-side', async () => {
  const c = client();
  await c('/api/accounts/signin', { method: 'POST', body: { username: users.t1.username, passwordHash: sha(users.t1.password) } });
  assert.equal((await c('/api/accounts/me')).status, 200);
  await c('/api/accounts/signout', { method: 'POST' });
  assert.equal((await c('/api/accounts/me')).status, 401);
});

// Last: it locks this test user out for 15 minutes.
test('password guessing is rate-limited', async () => {
  const c = client();
  let last;
  for (let i = 0; i < 12; i++) {
    last = await c('/api/accounts/signin', { method: 'POST', body: { username: users.t1.username, passwordHash: sha(`guess${i}`) } });
  }
  assert.equal(last.status, 429);
});
