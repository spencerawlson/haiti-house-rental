import { getListings, addListing } from '@/lib/listings-server';
import { getServerAccount } from '@/lib/accounts-server';

// Live data: never serve a build-time snapshot of the listings.
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ listings: await getListings() });
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
