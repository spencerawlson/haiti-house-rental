import { createVisit, listVisitsForListing, listVisitsForUser } from '@/lib/visits-server';
import { getListing } from '@/lib/listings-server';
import { getSessionAccount, unauthorized } from '@/lib/session-server';

// Live data: never serve a build-time snapshot.
export const dynamic = 'force-dynamic';

// Visits are private to the two sides: on a listing, the owner sees every
// request and a tenant sees only their own; signed out sees none.
// Without ?listingId=, the caller's own visits (Account → My visits).
export async function GET(request) {
  const me = await getSessionAccount(request);
  if (!me) return Response.json({ visits: [] });
  const listingId = new URL(request.url).searchParams.get('listingId');
  if (listingId) {
    const visits = await listVisitsForListing(listingId);
    const listing = await getListing(listingId);
    const isOwner = !!listing?.owner && listing.owner === me.username;
    return Response.json({ visits: isOwner ? visits : visits.filter((v) => v.tenant === me.username) });
  }
  return Response.json({ visits: await listVisitsForUser(me.username) });
}

export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  const data = await request.json().catch(() => ({}));
  if (!data.listingId || !data.date || !data.time) {
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }
  const listing = await getListing(data.listingId);
  if (listing?.owner && listing.owner === me.username) {
    return Response.json({ error: 'Owners cannot request visits to their own home' }, { status: 400 });
  }
  const visit = await createVisit({ listingId: data.listingId, tenant: me.username, date: String(data.date), time: String(data.time), message: String(data.message || '').slice(0, 1000) });
  if (!visit) return Response.json({ error: 'Listing not found' }, { status: 404 });
  return Response.json({ visit });
}
