// Pure-function tests — no server or database needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortListings, filterListings } from '../lib/listings.js';
import { sanitizeDetails } from '../lib/listing-details.js';

const L = (id, priceHTG, createdAt, extra = {}) => ({ id, priceHTG, createdAt, title: id, commune: 'Delmas', department: 'ouest', type: 'house', purpose: 'rent', bedrooms: 1, bathrooms: 1, ...extra });

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
