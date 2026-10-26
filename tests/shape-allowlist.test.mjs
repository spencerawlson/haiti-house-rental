// Shape allowlists (Stage 2, A6). The public/owner/admin boundary is
// TEST-enforced, not comment-enforced: these tests fail on any key
// present in a response but absent from the allowlist, so the fourth
// leak cannot slip in unnoticed the way address, lat/lng, and
// adBalanceHTG each did. Widening a shape means editing its allowlist
// deliberately — and only that shape's list.
//
// MERGE ORDER (see the A6 brief): the anonymous and owner listing
// allowlists below are the DESIRED shapes. They cannot go green until
// A2 (strips the ad keys from the public shape) and B1 (strips the
// exact address/coordinates) land — merge order A2, then B1, then A6.
// The profile, me, and admin ad-stats allowlists are independent of
// A2/B1 and go green immediately.
//
// KEY TENSION (resolved in the A6 brief): B1's "round or jitter public
// lat/lng" cannot keep the `lat`/`lng` KEYS, or this allowlist could
// never distinguish an approximated value from an exact one. B1
// therefore publishes approximated coordinates under DISTINCT keys,
// approxLat/approxLng, and the map components that render public pins
// read those keys; exact `lat`/`lng` stay in the owner and admin shapes
// only.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const L = { name: 'Shape Landlord', username: `shape_${run}`, password: 'pw-l', role: 'landlord' };
const T = { name: 'Shape Tenant', username: `shape_t_${run}`, password: 'pw-t', role: 'tenant' };
const asL = client();
const asT = client();
const anon = client();
let admin;
let id;

// Desired public listing keys: everything mapListing returns today,
// minus the exact address, the exact coordinates, and the four ad
// campaign keys, plus the approximated coordinates B1 publishes.
const PUBLIC_LISTING = [
  'views', 'id', 'type', 'department', 'commune', 'price', 'currency',
  'bedrooms', 'bathrooms', 'areaM2', 'title', 'description', 'photos',
  'videos', 'purpose', 'advertised', 'advertisedSince', 'advertisedUntil',
  'advertisedRequested', 'status', 'approxLat', 'approxLng', 'owner',
  'rentPeriod', 'details', 'verified', 'seed', 'createdAt',
];
// Owner shape: the public shape plus the exact address/coordinates, the
// sold countdown, and the ad campaign state.
const OWNER_LISTING = [...PUBLIC_LISTING,
  'address', 'lat', 'lng', 'soldAt', 'deletesAt',
  'adCampaign', 'adPaused', 'adEnded', 'adBalanceHTG',
];
// Revealed shape (B1): the public shape plus the exact address and
// coordinates ONLY — no ad keys, no sold countdown. A tenant sees this
// once the landlord replies in chat.
const REVEALED_LISTING = [...PUBLIC_LISTING,
  'address', 'lat', 'lng',
];
// The admin reads listings with a full-admin cookie (Stage 2, B1),
// so its listing shape IS the owner shape; its campaign view is the
// separate ad-stats row.
const ADMIN_LISTING = OWNER_LISTING;
const ADMIN_AD_STATS = ['id', 'title', 'owner', 'advertised',
  'advertisedRequested', 'paused', 'amountHTG', 'viewsBudget', 'viewsUsed',
  'clicksBudget', 'clicksUsed'];
// getPublicProfile claims "never phone or email" — this is that claim.
const PUBLIC_PROFILE = ['username', 'name', 'role'];
// /api/accounts/me is the caller's OWN full profile (phone, email, and
// billing state included) plus listing usage for landlords.
const ME = ['id', 'name', 'username', 'phone', 'email', 'location',
  'locale', 'listingLimit', 'avatarUrl', 'role', 'activated',
  'billingStatus', 'paidUntil', 'suspendedAt', 'partner', 'transferSent',
  'transferProvider', 'createdAt', 'listings',
  // Fraud private notice (PR #57 rebase): the account's OWN suspension
  // state, shown to the owner only on sign-in + account page. The
  // public profile allowlist above is unchanged — these never go public.
  'fraudSuspended', 'fraudSuspendedAt', 'fraudReason'];

function assertShape(actual, allowlist, label) {
  const keys = Object.keys(actual);
  const extras = keys.filter((k) => !allowlist.includes(k)).sort();
  const missing = allowlist.filter((k) => !keys.includes(k)).sort();
  assert.deepEqual(extras, [], `${label}: unexpected keys: ${extras.join(', ') || '(none)'}`);
  assert.deepEqual(missing, [], `${label}: missing keys: ${missing.join(', ') || '(none)'}`);
}

async function confirmPayment(pid) {
  const r = await admin('/api/admin/payments', { method: 'POST', body: { id: pid, decision: 'confirmed', receiverTxn: `T${Date.now()}${Math.random().toString(36).slice(2, 8)}` } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
}

before(async () => {
  if (skip) return;
  assert.equal((await signup(asL, L)).status, 200);
  admin = await adminClient();
  const p = await asL('/api/payments', { method: 'POST', body: { kind: 'activation', provider: 'moncash', senderPhone: '30000044' } });
  assert.equal(p.status, 200);
  await confirmPayment(p.data.payment.id);
  assert.equal((await asL('/api/accounts/me')).data.account.activated, true);
  const listing = await asL('/api/listings', { method: 'POST', body: { title: `Shape ${run}`, commune: 'Delmas', department: 'ouest', price: 1, purpose: 'rent', lat: 18.5, lng: -72.3, address: '12 Rue Test, Delmas 95' } });
  assert.equal(listing.status, 200);
  id = listing.data.listing.id;
  const ap = await asL('/api/payments', { method: 'POST', body: { kind: 'advertising', listingId: id, amountHTG: 500, provider: 'moncash', senderPhone: '30000044' } });
  assert.equal(ap.status, 200, JSON.stringify(ap.data));
  await confirmPayment(ap.data.payment.id);
  assert.equal((await signup(asT, T)).status, 200);
});

test('anonymous listing shapes match the public allowlist exactly', { skip }, async () => {
  const one = (await anon(`/api/listings?id=${id}`)).data.listing;
  assertShape(one, PUBLIC_LISTING, 'anonymous detail');
  const found = (await anon('/api/listings')).data.listings.find((l) => l.id === id);
  assert.ok(found, 'listing present in the anonymous list');
  assertShape(found, PUBLIC_LISTING, 'anonymous list');
});

test('owner Library shape matches the owner allowlist exactly', { skip }, async () => {
  const lib = (await asL(`/api/listings?owner=${L.username}&all=1`)).data.listings.find((l) => l.id === id);
  assert.ok(lib, 'listing present in the owner Library');
  assertShape(lib, OWNER_LISTING, 'owner Library');
});

test('admin listing shape matches the admin allowlist', { skip }, async () => {
  const found = (await admin('/api/listings')).data.listings.find((l) => l.id === id);
  assert.ok(found, 'listing present in the admin listing fetch');
  assertShape(found, ADMIN_LISTING, 'admin listing');
});

test('revealed shape: a tenant with a landlord reply gets exact location, nothing else extra', { skip }, async () => {
  const before = (await asT(`/api/listings?id=${id}`)).data.listing;
  assert.ok(!('address' in before) && !('lat' in before) && !('lng' in before), 'tenant sees no exact location before a reply');
  const post = await asT('/api/chat', { method: 'POST', body: { listingId: id, text: 'Bonjou, kay la toujou disponib?' } });
  assert.equal(post.status, 200, JSON.stringify(post.data));
  const stillHidden = (await asT(`/api/listings?id=${id}`)).data.listing;
  assert.ok(!('address' in stillHidden), 'tenant message alone does not reveal');
  const reply = await asL('/api/chat', { method: 'POST', body: { listingId: id, tenant: T.username, text: 'Wi, li disponib.' } });
  assert.equal(reply.status, 200, JSON.stringify(reply.data));
  const revealed = (await asT(`/api/listings?id=${id}`)).data.listing;
  assertShape(revealed, REVEALED_LISTING, 'revealed tenant detail');
});

test('admin ad-stats rows match their allowlist', { skip }, async () => {
  const row = (await admin('/api/admin/ad-stats')).data.stats.find((s) => s.id === id);
  assert.ok(row, 'campaign present in admin ad-stats');
  assertShape(row, ADMIN_AD_STATS, 'admin ad-stats row');
});

test('public profile and own me shapes match their allowlists exactly', { skip }, async () => {
  const profile = (await anon(`/api/accounts?username=${L.username}`)).data.account;
  assertShape(profile, PUBLIC_PROFILE, 'public profile');
  const me = (await asL('/api/accounts/me')).data.account;
  assertShape(me, ME, 'own me');
});
