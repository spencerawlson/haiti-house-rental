import { getListings, getListing, getPublicListing, getListingsForOwner, addListing, updateListing, withListingSlot } from '@/lib/listings-server';
import { resolveCommune } from '@/lib/listings';
import { isAdminCookie } from '@/lib/admin-auth';
import { getSessionAccount } from '@/lib/session-server';

// Live data: never serve a build-time snapshot of the listings.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const id = params.get('id') || '';
  if (id) {
    // Public read: also gone if the landlord's subscription has lapsed.
    const listing = await getPublicListing(id);
    // Sold and leased homes are still served: they stay on the site with
    // their tag until the 48-hour sweep removes them.
    if (!listing || !['active', 'sold', 'leased'].includes(listing.status)) {
      return Response.json({ error: 'Listing not found' }, { status: 404 });
    }
    return Response.json({ listing });
  }
  const owner = params.get('owner') || '';
  // A landlord's library includes taken-down homes: only for themselves.
  if (owner && params.get('all') === '1') {
    const me = await getSessionAccount(request);
    if (!me || me.username !== owner) return Response.json({ listings: [] });
    return Response.json({ listings: await getListingsForOwner(owner) });
  }
  const listings = await getListings();
  return Response.json({ listings: owner ? listings.filter((l) => l.owner === owner) : listings });
}

// Geocode the commune via OpenStreetMap Nominatim (free, no key) so new
// listings appear on the map. Failure is non-fatal: the listing is created
// without coordinates and shows in list view only.
async function geocode(commune) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(commune + ', Haiti')}`,
      { headers: { 'User-Agent': 'KayAyiti/1.0' }, signal: AbortSignal.timeout(5000) },
    );
    const data = await res.json();
    if (data[0]) return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  } catch {
    // fall through — no coordinates
  }
  return null;
}

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  // Only an activated landlord account can post. Tenants explore; they
  // never create listings — enforced here, not just in the form, so a
  // direct API call cannot bypass it. The owner is the session account;
  // an `owner` sent in the body is ignored.
  const owner = await getSessionAccount(request);
  if (!owner || owner.role !== 'landlord' || !owner.activated) {
    return Response.json({ error: 'Only activated landlord accounts can post listings' }, { status: 403 });
  }
  data.owner = owner.username;
  if (data.commune && typeof data.lat !== 'number') {
    const coords = await geocode(data.commune);
    if (coords) Object.assign(data, coords);
  }
  // The account's listing limit (0015), checked atomically with the insert.
  const slot = await withListingSlot(owner.username, (db) => addListing(data, db));
  if (slot.error) return Response.json({ error: slot.error, limit: slot.limit, used: slot.used }, { status: 403 });
  const listing = slot.value;
  if (!listing) return Response.json({ error: 'Title and commune are required' }, { status: 400 });
  return Response.json({ listing });
}

// Edit a listing: the listing owner (or the admin) can change every
// field the creation form sets — title, description, place, price, rooms,
// photos, videos, purpose, rent period. Advertised status itself stays
// admin-only (see /api/admin/advertised); the landlord can only request it.
export async function PATCH(request) {
  const data = await request.json().catch(() => ({}));
  const listing = await getListing(data.id);
  if (!listing || listing.status !== 'active') {
    return Response.json({ error: 'Listing not found' }, { status: 404 });
  }
  const admin = await isAdminCookie(request.cookies.get('kay_admin')?.value);
  const me = admin ? null : await getSessionAccount(request);
  if (!admin && (!me || !listing.owner || listing.owner !== me.username)) {
    return Response.json({ error: 'Not allowed' }, { status: 403 });
  }
  if (!String(data.title || '').trim() || !String(data.commune || '').trim()) {
    return Response.json({ error: 'Title and commune are required' }, { status: 400 });
  }
  // New commune, new map pin: re-geocode only when the commune changed
  // and no explicit pin was placed — an explicit pin always wins.
  if (data.commune && resolveCommune(data.commune) !== listing.commune && typeof data.lat !== 'number') {
    const coords = await geocode(data.commune);
    if (coords) Object.assign(data, coords);
  }
  const updated = await updateListing(data.id, data);
  if (!updated) return Response.json({ error: 'Update failed' }, { status: 400 });
  return Response.json({ listing: updated });
}
