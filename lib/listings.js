// Demo seed data only — not real homes. Replaced by real listings once
// landlord accounts and payment activation ship.
// Coordinates are approximate commune centers (for the map view only).
const SEED = [
  { id: 'pap-pv-001', type: 'house', department: 'ouest', commune: 'Pétion-Ville', priceHTG: 75000, bedrooms: 3, bathrooms: 2, title: 'Kay 3 chanm Pétion-Ville', photos: [], videos: [], purpose: 'rent', featured: false, lat: 18.512, lng: -72.285, createdAt: 0 },
  { id: 'pap-del-001', type: 'apartment', department: 'ouest', commune: 'Delmas', priceHTG: 40000, bedrooms: 2, bathrooms: 1, title: 'Apatman 2 chanm Delmas', photos: [], videos: [], purpose: 'rent', featured: false, lat: 18.542, lng: -72.299, createdAt: 0 },
  { id: 'pap-ken-001', type: 'house', department: 'ouest', commune: 'Kenscoff', priceHTG: 60000, bedrooms: 4, bathrooms: 3, title: 'Kay 4 chanm Kenscoff', photos: [], videos: [], purpose: 'rent', featured: false, lat: 18.452, lng: -72.287, createdAt: 0 },
  { id: 'cap-001', type: 'house', department: 'nord', commune: 'Cap-Haïtien', priceHTG: 50000, bedrooms: 3, bathrooms: 2, title: 'Kay 3 chanm Okap', photos: [], videos: [], purpose: 'rent', featured: false, lat: 19.757, lng: -72.198, createdAt: 0 },
  { id: 'jac-001', type: 'house', department: 'sud-est', commune: 'Jacmel', priceHTG: 35000, bedrooms: 2, bathrooms: 1, title: 'Kay 2 chanm Jakmèl', photos: [], videos: [], purpose: 'rent', featured: false, lat: 18.238, lng: -72.536, createdAt: 0 },
  { id: 'cay-001', type: 'house', department: 'sud', commune: 'Les Cayes', priceHTG: 30000, bedrooms: 3, bathrooms: 1, title: 'Kay 3 chanm Okay', photos: [], videos: [], purpose: 'rent', featured: false, lat: 18.195, lng: -73.749, createdAt: 0 },
  { id: 'pap-land-001', type: 'land', department: 'ouest', commune: 'Arcahaie', priceHTG: 1500000, bedrooms: 0, bathrooms: 0, areaM2: 1200, title: 'Tèren 1200 m² Akayè', photos: [], videos: [], purpose: 'sale', featured: false, lat: 18.772, lng: -72.514, createdAt: 0 },
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

export function setFeatured(id, value) {
  const l = getListing(id);
  if (!l) return null;
  l.featured = value === true;
  if (value === true) l.featuredRequested = false;
  return l;
}

// Centris-style search: text match on commune/title, then hard filters.
export function filterListings(list, f) {
  const q = (f.q || '').trim().toLowerCase();
  return list.filter((l) => {
    if (q && !(l.commune.toLowerCase().includes(q) || l.title.toLowerCase().includes(q))) return false;
    if (f.department && l.department !== f.department) return false;
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
  // Featured homes (75 HTG/month) always come first, then the chosen order.
  const out = [...list];
  if (sort === 'price-asc') out.sort((a, b) => a.priceHTG - b.priceHTG);
  else if (sort === 'price-desc') out.sort((a, b) => b.priceHTG - a.priceHTG);
  else out.reverse(); // newest first (user-created listings are unshifted)
  out.sort((a, b) => Number(b.featured || false) - Number(a.featured || false));
  return out;
}

export function addListing(data) {
  const listing = {
    id: `user-${Date.now()}`,
    type: ['house', 'apartment', 'land'].includes(data.type) ? data.type : 'house',
    department: data.department || 'ouest',
    commune: data.commune || '',
    priceHTG: Number(data.priceHTG) || 0,
    bedrooms: Number(data.bedrooms) || 0,
    bathrooms: Number(data.bathrooms) || 0,
    title: String(data.title || '').trim(),
    photos: Array.isArray(data.photos) ? data.photos : [],
    videos: Array.isArray(data.videos) ? data.videos : [],
    purpose: data.purpose === 'sale' ? 'sale' : 'rent',
    featured: false, // admin-approved only — never set from the public form
    featuredRequested: data.featuredRequested === true,
    areaM2: Number(data.areaM2) || 0,
    lat: typeof data.lat === 'number' ? data.lat : null,
    lng: typeof data.lng === 'number' ? data.lng : null,
    owner: typeof data.owner === 'string' && data.owner ? data.owner : null,
    createdAt: Date.now(),
  };
  if (!listing.title || !listing.commune) return null;
  store.unshift(listing);
  return listing;
}
