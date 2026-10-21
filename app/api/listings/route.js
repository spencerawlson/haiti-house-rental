import { getListings, getListing, getListingsForOwner, addListing, updateListing } from '@/lib/listings-server';
import { resolveCommune } from '@/lib/listings';
import { isAdminCookie } from '@/lib/admin-auth';
import { getServerAccount } from '@/lib/accounts-server';

// Live data: never serve a build-time snapshot of the listings.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const id = params.get('id') || '';
  if (id) {
    const listing = await getListing(id);
    if (!listing || listing.status !== 'active') {
      return Response.json({ error: 'Listing not found' }, { status: 404 });
    }
    return Response.json({ listing });
  }
  const owner = params.get('owner') || '';
  if (owner && params.get('all') === '1') {
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
  // direct API call cannot bypass it.
  const owner = data.owner ? await getServerAccount(data.owner) : null;
  if (!owner || owner.role !== 'landlord' || !owner.activated) {
    return Response.json({ error: 'Only activated landlord accounts can post listings' }, { status: 403 });
  }
  if (data.commune && typeof data.lat !== 'number') {
    const coords = await geocode(data.commune);
    if (coords) Object.assign(data, coords);
  }
  const listing = await addListing(data);
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
  if (!admin && listing.owner !== data.username) {
    return Response.json({ error: 'Not allowed' }, { status: 403 });
  }
  if (!String(data.title || '').trim() || !String(data.commune || '').trim()) {
    return Response.json({ error: 'Title and commune are required' }, { status: 400 });
  }
  // New commune, new map pin: re-geocode only when the commune changed.
  if (data.commune && resolveCommune(data.commune) !== listing.commune) {
    const coords = await geocode(data.commune);
    if (coords) Object.assign(data, coords);
  }
  const updated = await updateListing(data.id, data);
  if (!updated) return Response.json({ error: 'Update failed' }, { status: 400 });
  return Response.json({ listing: updated });
}
