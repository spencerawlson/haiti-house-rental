// Demo seed data only — not real homes. Replaced by real listings once
// landlord accounts and payment activation ship.
const SEED = [
  { id: 'pap-pv-001', type: 'house', department: 'ouest', commune: 'Pétion-Ville', priceHTG: 75000, bedrooms: 3, bathrooms: 2, title: 'Kay 3 chanm Pétion-Ville', photos: [], videos: [] },
  { id: 'pap-del-001', type: 'apartment', department: 'ouest', commune: 'Delmas', priceHTG: 40000, bedrooms: 2, bathrooms: 1, title: 'Apatman 2 chanm Delmas', photos: [], videos: [] },
  { id: 'pap-ken-001', type: 'house', department: 'ouest', commune: 'Kenscoff', priceHTG: 60000, bedrooms: 4, bathrooms: 3, title: 'Kay 4 chanm Kenscoff', photos: [], videos: [] },
  { id: 'cap-001', type: 'house', department: 'nord', commune: 'Cap-Haïtien', priceHTG: 50000, bedrooms: 3, bathrooms: 2, title: 'Kay 3 chanm Okap', photos: [], videos: [] },
  { id: 'jac-001', type: 'house', department: 'sud-est', commune: 'Jacmel', priceHTG: 35000, bedrooms: 2, bathrooms: 1, title: 'Kay 2 chanm Jakmèl', photos: [], videos: [] },
  { id: 'cay-001', type: 'house', department: 'sud', commune: 'Les Cayes', priceHTG: 30000, bedrooms: 3, bathrooms: 1, title: 'Kay 3 chanm Okay', photos: [], videos: [] },
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

// Centris-style search: text match on commune/title, then hard filters.
export function filterListings(list, f) {
  const q = (f.q || '').trim().toLowerCase();
  return list.filter((l) => {
    if (q && !(l.commune.toLowerCase().includes(q) || l.title.toLowerCase().includes(q))) return false;
    if (f.department && l.department !== f.department) return false;
    if (f.type && l.type !== f.type) return false;
    if (f.minPrice && l.priceHTG < Number(f.minPrice)) return false;
    if (f.maxPrice && l.priceHTG > Number(f.maxPrice)) return false;
    if (f.minBeds && l.bedrooms < Number(f.minBeds)) return false;
    if (f.minBaths && l.bathrooms < Number(f.minBaths)) return false;
    return true;
  });
}

export function sortListings(list, sort) {
  const out = [...list];
  if (sort === 'price-asc') out.sort((a, b) => a.priceHTG - b.priceHTG);
  else if (sort === 'price-desc') out.sort((a, b) => b.priceHTG - a.priceHTG);
  else out.reverse(); // newest first (user-created listings are unshifted)
  return out;
}

export function addListing(data) {
  const listing = {
    id: `user-${Date.now()}`,
    type: data.type || 'house',
    department: data.department || 'ouest',
    commune: data.commune || '',
    priceHTG: Number(data.priceHTG) || 0,
    bedrooms: Number(data.bedrooms) || 0,
    bathrooms: Number(data.bathrooms) || 0,
    title: String(data.title || '').trim(),
    photos: Array.isArray(data.photos) ? data.photos : [],
    videos: Array.isArray(data.videos) ? data.videos : [],
  };
  if (!listing.title || !listing.commune) return null;
  store.unshift(listing);
  return listing;
}
