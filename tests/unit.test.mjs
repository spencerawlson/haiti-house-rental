// Pure-function tests — no server or database needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortListings, filterListings, priceInHtg } from '../lib/listings.js';
import { sanitizeDetails } from '../lib/listing-details.js';
import { dueReminder, haitiWallClockToMs } from '../lib/reminders-server.js';

const L = (id, price, createdAt, extra = {}) => ({ id, price, createdAt, title: id, commune: 'Delmas', department: 'ouest', type: 'house', purpose: 'rent', bedrooms: 1, bathrooms: 1, ...extra });

test('default order keeps the server order (newest real listings first)', () => {
  const serverOrder = [L('new', 5, 300), L('older', 5, 200), L('demo', 5, 0, { seed: true })];
  assert.deepEqual(sortListings(serverOrder, '').map((l) => l.id), ['new', 'older', 'demo']);
});

test('price sorts break ties newest first', () => {
  const list = [L('a', 100, 1), L('b', 50, 2), L('c', 100, 3)];
  assert.deepEqual(sortListings(list, 'price-asc').map((l) => l.id), ['b', 'c', 'a']);
  assert.deepEqual(sortListings(list, 'price-desc').map((l) => l.id), ['c', 'a', 'b']);
});

test('advertising never changes the order', () => {
  const list = [L('plain', 100, 2), L('paid', 100, 1, { advertised: true })];
  assert.deepEqual(sortListings(list, '').map((l) => l.id), ['plain', 'paid']);
});

test('filters: 24/7 power, furnished, verified', () => {
  const list = [
    L('p', 1, 1, { details: { power24: true } }),
    L('f', 1, 1, { details: { furnished: 'partly' } }),
    L('v', 1, 1, { verified: true }),
  ];
  assert.deepEqual(filterListings(list, { power24: '1' }).map((l) => l.id), ['p']);
  assert.deepEqual(filterListings(list, { furnished: '1' }).map((l) => l.id), ['f']);
  assert.deepEqual(filterListings(list, { verified: '1' }).map((l) => l.id), ['v']);
});

// Stage 2, B2: cross-currency price sort/filter. Rate 130 HTG per USD.
// A 500 USD home is really 65,000 HTG — dearer than a 60,000 HTG home,
// never "cheaper" the way raw numbers (500 < 60,000) claim. Bounds are
// HTG (the app already labels saved-search bounds "HTG").
test('price sorts convert across currencies via the rate', () => {
  const list = [L('usd', 500, 1, { currency: 'USD' }), L('htg', 60000, 2, { currency: 'HTG' })];
  assert.deepEqual(sortListings(list, 'price-asc', 130).map((l) => l.id), ['htg', 'usd']);
  assert.deepEqual(sortListings(list, 'price-desc', 130).map((l) => l.id), ['usd', 'htg']);
});

test('price bounds compare converted HTG values', () => {
  const list = [L('usd', 500, 1, { currency: 'USD' }), L('htg', 60000, 2, { currency: 'HTG' })];
  assert.deepEqual(filterListings(list, { minPrice: '61000' }, 130).map((l) => l.id), ['usd']);
  assert.deepEqual(filterListings(list, { maxPrice: '62000' }, 130).map((l) => l.id), ['htg']);
});

test('without a rate, price bounds are ignored, never raw-compared', () => {
  // Raw comparison would drop the 500 USD home under a 61,000 floor —
  // the exact bug. Ignoring the bound (with a UI notice, see the
  // listings page) is honest; silently raw-comparing is not.
  const list = [L('usd', 500, 1, { currency: 'USD' }), L('htg', 60000, 2, { currency: 'HTG' })];
  assert.deepEqual(filterListings(list, { minPrice: '61000' }, null).map((l) => l.id), ['usd', 'htg']);
});

test('without a rate, an all-USD list also ignores bounds (bounds are HTG)', () => {
  const list = [L('a', 500, 1, { currency: 'USD' }), L('b', 400, 2, { currency: 'USD' })];
  assert.deepEqual(filterListings(list, { minPrice: '61000' }, null).map((l) => l.id), ['a', 'b']);
  assert.deepEqual(sortListings(list, 'price-asc', null).map((l) => l.id), ['a', 'b']);
});

test('without a rate, price sort keeps server order', () => {
  // Input order is the server order; raw comparison would put the
  // 500 USD home first. With no rate, price sort must not reorder.
  const list = [L('htg', 60000, 2, { currency: 'HTG' }), L('usd', 500, 1, { currency: 'USD' })];
  assert.deepEqual(sortListings(list, 'price-asc', null).map((l) => l.id), ['htg', 'usd']);
});

test('priceInHtg leaves HTG untouched and converts USD', () => {
  assert.equal(priceInHtg(L('a', 60000, 1, { currency: 'HTG' }), 130), 60000);
  assert.equal(priceInHtg(L('b', 500, 1, { currency: 'USD' }), 130), 65000);
  assert.equal(priceInHtg(L('c', 700, 1), 130), 700);
});

test('sanitizeDetails keeps only known keys and values', () => {
  const out = sanitizeDetails({
    water: 'city', electricity: 'nuclear', power24: 'yes', internet: 'included',
    security: ['guard', 'moat', 'guard'], amenities: 'pool', parking: '99',
    availableFrom: '2026-12-01', conditions: 'x'.repeat(2000), extraFees: '  ', __proto__: { polluted: 1 }, verified: true,
  });
  assert.deepEqual(Object.keys(out).sort(), ['availableFrom', 'conditions', 'internet', 'parking', 'security', 'water']);
  assert.equal(out.parking, 20);
  assert.deepEqual(out.security, ['guard']);
  assert.equal(out.conditions.length, 1000);
  assert.equal(sanitizeDetails(null) && Object.keys(sanitizeDetails(null)).length, 0);
});

test('Haitian phone numbers become E.164 for SMS', async () => {
  const { toE164 } = await import('../lib/notify-server.js');
  assert.equal(toE164('3217 1628'), '+50932171628');
  assert.equal(toE164('+509 32 17 1628'), '+50932171628');
  assert.equal(toE164('50932171628'), '+50932171628');
  assert.equal(toE164('12'), null);
});

test('notifications render in the account language', async () => {
  const { render } = await import('../lib/notify-server.js');
  const params = { name: 'Ana', title: 'Kay ak lakou', date: '2026-11-02', time: '10:00' };
  assert.equal(render('visit_proposed', params, 'ht'), 'Ana mande vizite "Kay ak lakou" 2026-11-02 a 10:00.');
  assert.match(render('visit_proposed', params, 'fr'), /^Ana demande à visiter « Kay ak lakou »/);
  assert.match(render('visit_proposed', params, 'en'), /^Ana asked to visit "Kay ak lakou"/);
});

// Visit reminder windows. Pure logic, no server: this is where the real
// risk lives, so it must be deterministic rather than depending on the
// clock or on Postgres.
test('visit reminders fire in windows, never stacked', () => {
  const v = { date: '2026-11-02', time: '10:30' };
  const start = haitiWallClockToMs(v.date, v.time);
  const h = (n) => n * 3600000;
  const day = 86400000;
  assert.equal(dueReminder(v, start - 3 * day), null, 'too early for anything');
  assert.equal(dueReminder(v, start - h(47)), 'two_days');
  assert.equal(dueReminder(v, start - h(25)), 'two_days', 'still the 2-day window at 25h');
  assert.equal(dueReminder(v, start - h(23)), 'one_day');
  assert.equal(dueReminder(v, haitiWallClockToMs(v.date, '06:00')), 'morning', '6 a.m. on the day');
  assert.equal(dueReminder(v, start - h(0.5)), 'morning', 'half an hour before');
  assert.equal(dueReminder(v, start + h(1)), null, 'nothing after it has started');
});

test('a visit confirmed at the last minute gets one reminder, not three', () => {
  // The whole point of windows: the 2-day and 1-day moments are long
  // past, and sending all three at once would be absurd.
  const v = { date: '2026-11-02', time: '18:00' };
  const start = haitiWallClockToMs(v.date, v.time);
  assert.equal(dueReminder(v, start - 600000), 'morning', '10 minutes before -> morning only');
});

test('Haiti wall-clock honours daylight saving', () => {
  // Haiti is UTC-5 in winter and UTC-4 in summer; the offset is read from
  // the date rather than hardcoded.
  assert.equal(new Date(haitiWallClockToMs('2026-01-15', '10:00')).toISOString(), '2026-01-15T15:00:00.000Z');
  assert.equal(new Date(haitiWallClockToMs('2026-07-15', '10:00')).toISOString(), '2026-07-15T14:00:00.000Z');
});

test('photo room tags: uploaded photos and known rooms only', () => {
  const out = sanitizeDetails({ photoTags: { '/uploads/a.jpg': 'inside', '/uploads/b.jpg': 'garage', 'https://evil.example/x.jpg': 'outside', '/uploads/../etc/passwd': 'area' } });
  assert.deepEqual(out.photoTags, { '/uploads/a.jpg': 'inside' });
  assert.equal(sanitizeDetails({ photoTags: 'nope' }).photoTags, undefined);
});
