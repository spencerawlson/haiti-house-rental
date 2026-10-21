// Server-only listing store — Postgres (since Oct 2026). Imported only
// by API routes, server pages and other server modules, never by client
// components: importing pg into a browser bundle breaks the build (pg
// needs Node builtins). Pure helpers (matching, filtering, sorting) stay
// in lib/listings.js, which client components can import safely.
import { query } from './db';
import { resolveDepartmentId, resolveCommune } from './listings';

function mapListing(r) {
  return {
    id: r.id,
    type: r.type,
    department: r.department,
    commune: r.commune,
    priceHTG: Number(r.price_htg),
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    areaM2: r.area_m2,
    title: r.title,
    description: r.description,
    photos: r.photos || [],
    videos: r.videos || [],
    purpose: r.purpose,
    advertised: r.advertised,
    advertisedRequested: r.advertised_requested,
    status: r.status || 'active',
    lat: r.lat,
    lng: r.lng,
    owner: r.owner,
    rentPeriod: r.rent_period,
    createdAt: Number(r.created_at),
  };
}

export async function getListings() {
  const { rows } = await query(
    `SELECT * FROM listings WHERE status = 'active'
     ORDER BY CASE WHEN seed_order IS NULL THEN 0 ELSE 1 END, created_at DESC, seed_order ASC`,
  );
  return rows.map(mapListing);
}

// Every listing a landlord ever posted, live or taken down — the
// library view. Newest first.
export async function getListingsForOwner(owner) {
  const { rows } = await query(
    `SELECT * FROM listings WHERE owner = $1 ORDER BY created_at DESC`,
    [owner],
  );
  return rows.map(mapListing);
}

export async function getListing(id) {
  const { rows } = await query('SELECT * FROM listings WHERE id = $1', [id]);
  return rows[0] ? mapListing(rows[0]) : null;
}

export async function setAdvertised(id, value) {
  const { rows } = await query(
    `UPDATE listings SET advertised = $2, advertised_requested = CASE WHEN $2 THEN FALSE ELSE advertised_requested END
     WHERE id = $1 RETURNING *`,
    [id, value === true],
  );
  return rows[0] ? mapListing(rows[0]) : null;
}

// Take down: hide an active listing from home, search and detail pages.
// The row (and its chats and visits) stays in the database, so a takedown
// is reversible later. Returns null when the listing is not active.
export async function setListingRemoved(id) {
  const { rows } = await query(
    `UPDATE listings SET status = 'removed' WHERE id = $1 AND status = 'active' RETURNING *`,
    [id],
  );
  return rows[0] ? mapListing(rows[0]) : null;
}

// Restore: put a taken-down listing back online. Returns null when the
// listing is not taken down.
export async function setListingActive(id) {
  const { rows } = await query(
    `UPDATE listings SET status = 'active' WHERE id = $1 AND status = 'removed' RETURNING *`,
    [id],
  );
  return rows[0] ? mapListing(rows[0]) : null;
}

// Edit: the owner changes any field the creation form sets. Values pass
// through the same canonicalization and whitelists as creation, so an
// edit cannot smuggle in a bad type, purpose, period or place spelling.
export async function updateListing(id, data) {
  const fields = [];
  const push = (col, val, cast) => fields.push({ col, val, cast: cast || '' });
  if (typeof data.title === 'string') push('title', data.title.trim());
  if (typeof data.description === 'string') push('description', data.description.trim());
  if (data.department) push('department', resolveDepartmentId(data.department) || 'ouest');
  if (data.commune) push('commune', resolveCommune(data.commune));
  if (data.priceHTG !== undefined) push('price_htg', Number(data.priceHTG) || 0);
  if (data.bedrooms !== undefined) push('bedrooms', Number(data.bedrooms) || 0);
  if (data.bathrooms !== undefined) push('bathrooms', Number(data.bathrooms) || 0);
  if (data.areaM2 !== undefined) push('area_m2', Number(data.areaM2) || 0);
  if (['house', 'apartment', 'land'].includes(data.type)) push('type', data.type);
  if (data.purpose === 'sale' || data.purpose === 'rent') push('purpose', data.purpose);
  if (['monthly', 'quarterly', 'semiannual', 'annual'].includes(data.rentPeriod)) push('rent_period', data.rentPeriod);
  if (Array.isArray(data.photos)) push('photos', JSON.stringify(data.photos), '::jsonb');
  if (Array.isArray(data.videos)) push('videos', JSON.stringify(data.videos), '::jsonb');
  if (data.advertisedRequested !== undefined) push('advertised_requested', data.advertisedRequested === true);
  if (typeof data.lat === 'number') push('lat', data.lat);
  if (typeof data.lng === 'number') push('lng', data.lng);
  if (fields.length === 0) return null;
  const sets = fields.map((f, i) => `${f.col} = $${i + 1}${f.cast}`).join(', ');
  const vals = fields.map((f) => f.val);
  vals.push(id);
  const { rows } = await query(
    `UPDATE listings SET ${sets} WHERE id = $${vals.length} AND status = 'active' RETURNING *`,
    vals,
  );
  return rows[0] ? mapListing(rows[0]) : null;
}

export async function addListing(data) {
  const listing = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: ['house', 'apartment', 'land'].includes(data.type) ? data.type : 'house',
    department: resolveDepartmentId(data.department) || 'ouest',
    commune: resolveCommune(data.commune) || '',
    priceHTG: Number(data.priceHTG) || 0,
    bedrooms: Number(data.bedrooms) || 0,
    bathrooms: Number(data.bathrooms) || 0,
    title: String(data.title || '').trim(),
    description: String(data.description || '').trim(),
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
  const { rows } = await query(
    `INSERT INTO listings (id, type, department, commune, price_htg, bedrooms, bathrooms, area_m2, title, description, photos, videos, purpose, advertised, advertised_requested, lat, lng, owner, rent_period, seed_order, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,NULL,$20) RETURNING *`,
    [listing.id, listing.type, listing.department, listing.commune, listing.priceHTG, listing.bedrooms, listing.bathrooms, listing.areaM2, listing.title, listing.description, JSON.stringify(listing.photos), JSON.stringify(listing.videos), listing.purpose, listing.advertised, listing.advertisedRequested, listing.lat, listing.lng, listing.owner, listing.rentPeriod, listing.createdAt],
  );
  return mapListing(rows[0]);
}
