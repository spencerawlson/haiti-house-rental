// Demo seed data only — not real homes. Replaced by real listings once
// landlord accounts and payment activation ship.
// Coordinates are approximate commune centers (for the map view only).
import { DEPARTMENTS, DEPARTMENT_NAMES, communeName } from './departments';

// Misspelling-tolerant place matching: accents, hyphens, apostrophes and
// spaces are all ignored, so Petionville, Petion-ville, Pétion-Ville and
// Petyonvil resolve to the same place — in French, English and Creole.
export function normalizePlace(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

// Canonical department id from any spelling: the id itself, or any of its
// names in Creole, French or English (Lwès, Ouest, West → ouest).
export function resolveDepartmentId(value) {
  const n = normalizePlace(value);
  if (!n) return '';
  for (const d of DEPARTMENTS) {
    if (d.id === value) return d.id;
    const names = DEPARTMENT_NAMES[d.id];
    if (normalizePlace(d.id) === n) return d.id;
    if (names && Object.values(names).some((nm) => normalizePlace(nm) === n)) return d.id;
  }
  return value; // unknown: passes through and matches nothing
}

// Canonical commune spelling from any variant (Petionville → Pétion-Ville).
// Unknown names pass through unchanged, so a genuinely new place still works.
export function resolveCommune(value) {
  const n = normalizePlace(value);
  if (!n) return '';
  for (const d of DEPARTMENTS) {
    for (const c of d.communes) {
      if (normalizePlace(c) === n) return c;
      if (normalizePlace(communeName(c, 'ht')) === n) return c;
    }
  }
  return value;
}

// Everything one listing can be found by: title + commune (official and
// Creole spellings) + department (id and all three names).
function listingSearchText(l) {
  const names = DEPARTMENT_NAMES[l.department];
  return normalizePlace([l.title, l.commune, communeName(l.commune, 'ht'), l.department, names ? Object.values(names).join(' ') : ''].join(' '));
}

export function matchesQuery(listing, q) {
  const nq = normalizePlace(q);
  if (!nq) return true;
  return listingSearchText(listing).includes(nq);
}

// Stage 2, B2: cross-currency prices. Every price comparison goes
// through here. Bounds are HTG (the app already labels saved-search
// bounds "HTG"); a USD price converts at the live HTG-per-USD rate.
// Unknown currency falls back to the raw price (the CHECK constrains
// to HTG/USD, so this is defensive only, never a third currency).
export function priceInHtg(l, htgPerUsd) {
  if (l.currency === 'USD' && typeof htgPerUsd === 'number') return l.price * htgPerUsd;
  return l.price;
}

// True when every listing is priced in HTG (missing currency counts
// as HTG). Only then is a raw price comparison already correct: bounds
// are HTG, so an all-USD or mixed list needs the rate before any price
// comparison means anything.
export function allPricesHtg(list) {
  return list.every((l) => (l.currency || 'HTG') === 'HTG');
}

// Centris-style search: text match on commune/title, then hard filters.
// The third argument is the live HTG-per-USD rate (or null). WITHOUT a
// rate, price bounds on a non-all-HTG list are IGNORED — never
// raw-compared, which is the exact bug this fixed: raw numbers put a
// 500 USD home below a 60,000 HTG one. The caller must show the
// rate-unavailable notice whenever it passes null with price bounds
// set on such a list. An all-HTG list compares raw, correctly.
export function filterListings(list, f, htgPerUsd = null) {
  const q = f.q || '';
  const dept = resolveDepartmentId(f.department);
  const convert = htgPerUsd !== null || allPricesHtg(list);
  return list.filter((l) => {
    if (q && !matchesQuery(l, q)) return false;
    if (dept && l.department !== dept) return false;
    if (f.type && l.type !== f.type) return false;
    if (f.purpose && l.purpose !== f.purpose) return false;
    if (convert) {
      const p = htgPerUsd !== null ? priceInHtg(l, htgPerUsd) : l.price;
      if (f.minPrice && p < Number(f.minPrice)) return false;
      if (f.maxPrice && p > Number(f.maxPrice)) return false;
    }
    if (f.minBeds && l.bedrooms < Number(f.minBeds)) return false;
    if (f.minBaths && l.bathrooms < Number(f.minBaths)) return false;
    if (f.power24 === '1' && l.details?.power24 !== true) return false;
    if (f.furnished === '1' && !['furnished', 'partly'].includes(l.details?.furnished)) return false;
    if (f.verified === '1' && l.verified !== true) return false;
    return true;
  });
}

export function sortListings(list, sort, htgPerUsd = null) {
  // Fair order for everyone: the chosen sort only. Advertised homes get
  // visibility from the home-page carousel, never a search ranking boost —
  // advertising buys visibility, never rank, whatever the amount.
  // Default = the server's order: real listings newest first, then the
  // demo seeds. (It used to reverse() that list — a leftover from the old
  // in-memory store — which put the oldest demos on top and every new
  // real listing at the bottom.) Ties break newest first, so equal prices
  // never reorder at random.
  // Stage 2, B2: price sorts compare HTG equivalents. WITHOUT a rate, a
  // price sort on a non-all-HTG list keeps server order — never
  // raw-compares (same bug as the bounds); the caller shows the
  // rate-unavailable notice. An all-HTG list sorts raw, correctly.
  const newest = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
  const out = [...list];
  const byPrice = (a, b) => htgPerUsd !== null ? priceInHtg(a, htgPerUsd) - priceInHtg(b, htgPerUsd) : a.price - b.price;
  if (sort === 'price-asc' && (htgPerUsd !== null || allPricesHtg(list))) out.sort((a, b) => byPrice(a, b) || newest(a, b));
  else if (sort === 'price-desc' && (htgPerUsd !== null || allPricesHtg(list))) out.sort((a, b) => byPrice(b, a) || newest(a, b));
  return out;
}

// Rent in Haiti is paid monthly, quarterly, every six months, or yearly.
// Sale listings ignore the period; rent display always uses this label.
export function rentPeriodLabel(period, t) {
  if (period === 'quarterly') return t.periodQuarterly;
  if (period === 'semiannual') return t.periodSemiannual;
  if (period === 'annual') return t.periodAnnual;
  return t.perMonth;
}
