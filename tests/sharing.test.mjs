// Sharing + data use: link previews (Open Graph) on listings, resized
// photos for cards (/uploads/<file>?w=…), and a home page that no longer
// ships whole listings to the browser for the map.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASE, ADMIN_PASSWORD, client, sha, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
let landlord;
let photo;
let listingId;

before(async () => {
  if (skip) return;
  const admin = await adminClient();
  const u = `share_${run}`;
  assert.equal((await admin('/api/admin/partner', { method: 'POST', body: { name: 'Share Landlord', username: u, passwordHash: sha('pw'), phone: '+509 0000 0000', location: { department: 'ouest', commune: 'Delmas' } } })).status, 200);
  landlord = client();
  assert.equal((await landlord('/api/accounts/signin', { method: 'POST', body: { username: u, passwordHash: sha('pw') } })).status, 200);
  const form = new FormData();
  form.append('file', new Blob([readFileSync(new URL('../public/images/landing-house.jpg', import.meta.url))], { type: 'image/jpeg' }), 'house.jpg');
  const up = await landlord('/api/upload', { method: 'POST', form });
  assert.equal(up.status, 200, JSON.stringify(up.data));
  photo = up.data.url;
  const l = await landlord('/api/listings', { method: 'POST', body: { title: `Share ${run}`, description: `Bel kay ak lakou ${run}.`, commune: 'Delmas', department: 'ouest', price: 50000, priceHTG: 50000, currency: 'HTG', purpose: 'rent', bedrooms: 2, bathrooms: 1, lat: 18.54, lng: -72.3, photos: [photo] } });
  assert.equal(l.status, 200, JSON.stringify(l.data));
  listingId = l.data.listing.id;
});

test('resized photos: much smaller WebP for cards, JPEG for previews, original untouched', { skip }, async () => {
  const orig = await fetch(BASE + photo);
  const origBytes = (await orig.arrayBuffer()).byteLength;
  const card = await fetch(`${BASE}${photo}?w=480`);
  assert.equal(card.headers.get('content-type'), 'image/webp');
  const cardBytes = (await card.arrayBuffer()).byteLength;
  assert.ok(cardBytes < origBytes / 3, `card ${cardBytes} B vs original ${origBytes} B`);
  assert.match(card.headers.get('cache-control') || '', /immutable/);
  const og = await fetch(`${BASE}${photo}?w=1200&f=jpg`);
  assert.equal(og.headers.get('content-type'), 'image/jpeg');
  // Second request is served from the disk cache: same bytes.
  const again = await fetch(`${BASE}${photo}?w=480`);
  assert.equal((await again.arrayBuffer()).byteLength, cardBytes);
  // Sizes outside the list get the original, never an arbitrary resize.
  const odd = await fetch(`${BASE}${photo}?w=7`);
  assert.equal(odd.headers.get('content-type'), 'image/jpeg');
  assert.equal((await odd.arrayBuffer()).byteLength, origBytes);
});

test('a shared listing link carries a preview: photo, title, price, place', { skip }, async () => {
  const html = await (await fetch(`${BASE}/ht/listings/${listingId}`)).text();
  const meta = (p) => (html.match(new RegExp(`<meta[^>]+(?:property|name)="${p}"[^>]+content="([^"]*)"`)) || [])[1];
  assert.match(meta('og:title') || '', new RegExp(`Share ${run} · 50,000 HTG`));
  // Place names come out in the page's language: Kreyol 'Dèlma, Lwès'.
  assert.match(meta('og:description') || '', /Dèlma, Lwès · 2 chanm · 1 twalèt/);
  const image = meta('og:image') || '';
  assert.match(image, /^https?:\/\/.+\/uploads\/.+\?w=1200&(amp;)?f=jpg$/, image);
  assert.equal(meta('twitter:card'), 'summary_large_image');
  // The WhatsApp share button is on the page.
  assert.match(html, /https:\/\/wa\.me\/\?text=/);
});

test('the home page map gets pins only, not whole listings', { skip }, async () => {
  // This listing's description is unique to the run. The home page shows
  // the listing (card + map pin) but must not carry its description or
  // owner in the page data, which is what the old map props did.
  const html = await (await fetch(`${BASE}/ht`)).text();
  assert.ok(html.includes(`Share ${run}`), 'the listing is on the home page');
  assert.ok(!html.includes(`Bel kay ak lakou ${run}`), 'its description leaked into the page data');
  assert.ok(!html.includes(`share_${run}`), 'its owner leaked into the page data');
});

test('deleting a listing also deletes its resized photos', { skip }, async () => {
  assert.equal((await fetch(`${BASE}${photo}?w=320`)).status, 200);
  const del = await landlord('/api/listings/delete', { method: 'POST', body: { id: listingId } });
  assert.equal(del.status, 200, JSON.stringify(del.data));
  assert.equal((await fetch(`${BASE}${photo}?w=320`)).status, 404);
  assert.equal((await fetch(`${BASE}${photo}?w=480`)).status, 404);
  assert.equal((await fetch(BASE + photo)).status, 404);
});

