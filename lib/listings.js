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
const SEED = [
  { id: 'pap-pv-001', type: 'house', department: 'ouest', commune: 'Pétion-Ville', priceHTG: 75000, bedrooms: 3, bathrooms: 2, title: 'Kay 3 chanm Petyonvil', photos: [], videos: [], purpose: 'rent', advertised: false, lat: 18.512, lng: -72.285, createdAt: 0 },
  { id: 'pap-del-001', type: 'apartment', department: 'ouest', commune: 'Delmas', priceHTG: 40000, bedrooms: 2, bathrooms: 1, title: 'Apatman 2 chanm Dèlma', photos: [], videos: [], purpose: 'rent', advertised: false, lat: 18.542, lng: -72.299, createdAt: 0 },
  { id: 'pap-ken-001', type: 'house', department: 'ouest', commune: 'Kenscoff', priceHTG: 60000, bedrooms: 4, bathrooms: 3, title: 'Kay 4 chanm Kenskòf', photos: [], videos: [], purpose: 'rent', advertised: false, lat: 18.452, lng: -72.287, createdAt: 0 },
  { id: 'cap-001', type: 'house', department: 'nord', commune: 'Cap-Haïtien', priceHTG: 50000, bedrooms: 3, bathrooms: 2, title: 'Kay 3 chanm Okap', photos: [], videos: [], purpose: 'rent', advertised: false, lat: 19.757, lng: -72.198, createdAt: 0 },
  { id: 'jac-001', type: 'house', department: 'sud-est', commune: 'Jacmel', priceHTG: 35000, bedrooms: 2, bathrooms: 1, title: 'Kay 2 chanm Jakmèl', photos: [], videos: [], purpose: 'rent', advertised: false, lat: 18.238, lng: -72.536, createdAt: 0 },
  { id: 'cay-001', type: 'house', department: 'sud', commune: 'Les Cayes', priceHTG: 30000, bedrooms: 3, bathrooms: 1, title: 'Kay 3 chanm Okay', photos: [], videos: [], purpose: 'rent', advertised: false, lat: 18.195, lng: -73.749, createdAt: 0 },
  { id: 'pap-land-001', type: 'land', department: 'ouest', commune: 'Arcahaie', priceHTG: 1500000, bedrooms: 0, bathrooms: 0, areaM2: 1200, title: 'Tèren 1200 m² Akayè', photos: [], videos: [], purpose: 'sale', advertised: false, lat: 18.772, lng: -72.514, createdAt: 0 },
];

// v0 store: seed + landlord-created listings, in server memory (same
// honest limits as chat — resets on restart; a database comes later).
const store = [...SEED];

export const LISTINGS = store;

export function getListings() {
  return store;
}

export function getListing(id) {
  return store.find((l) => l.id === id) || null;
}

export function setAdvertised(id, value) {
  const l = getListing(id);
  if (!l) return null;
  l.advertised = value === true;
  if (value === true) l.advertisedRequested = false;
  return l;
}

// Centris-style search: text match on commune/title, then hard filters.
export function filterListings(list, f) {
  const q = f.q || '';
  const dept = resolveDepartmentId(f.department);
  return list.filter((l) => {
    if (q && !matchesQuery(l, q)) return false;
    if (dept && l.department !== dept) return false;
    if (f.type && l.type !== f.type) return false;
    if (f.purpose && l.purpose !== f.purpose) return false;
    if (f.minPrice && l.priceHTG < Number(f.minPrice)) return false;
    if (f.maxPrice && l.priceHTG > Number(f.maxPrice)) return false;
    if (f.minBeds && l.bedrooms < Number(f.minBeds)) return false;
    if (f.minBaths && l.bathrooms < Number(f.minBaths)) return false;
    return true;
  });
}

export function sortListings(list, sort) {
  // Fair order for everyone: the chosen sort only. Advertised homes get
  // visibility from the home-page carousel, never a search ranking boost —
  // every advertiser pays the same 75 HTG, so none can be "first".
  const out = [...list];
  if (sort === 'price-asc') out.sort((a, b) => a.priceHTG - b.priceHTG);
  else if (sort === 'price-desc') out.sort((a, b) => b.priceHTG - a.priceHTG);
  else out.reverse(); // newest first (user-created listings are unshifted)
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

export function addListing(data) {
  const listing = {
    id: `user-${Date.now()}`,
    type: ['house', 'apartment', 'land'].includes(data.type) ? data.type : 'house',
    department: resolveDepartmentId(data.department) || 'ouest',
    commune: resolveCommune(data.commune) || '',
    priceHTG: Number(data.priceHTG) || 0,
    bedrooms: Number(data.bedrooms) || 0,
    bathrooms: Number(data.bathrooms) || 0,
    title: String(data.title || '').trim(),
    photos: Array.isArray(data.photos) ? data.photos : [],
    videos: Array.isArray(data.videos) ? data.videos : [],
    purpose: data.purpose === 'sale' ? 'sale' : 'rent',
    advertised: false, // admin-approved only — never set from the public form
    advertisedRequested: data.advertisedRequested === true,
    areaM2: Number(data.areaM2) || 0,
    lat: typeof data.lat === 'number' ? data.lat : null,
    lng: typeof data.lng === 'number' ? data.lng : null,
    owner: typeof data.owner === 'string' && data.owner ? data.owner : null,
    rentPeriod: ['monthly', 'quarterly', 'semiannual', 'annual'].includes(data.rentPeriod) ? data.rentPeriod : 'monthly',
    createdAt: Date.now(),
  };
  if (!listing.title || !listing.commune) return null;
  store.unshift(listing);
  return listing;
}
