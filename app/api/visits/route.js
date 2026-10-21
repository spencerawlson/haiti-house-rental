import { createVisit, listVisitsForListing, listVisitsForUser } from '@/lib/visits-server';

// Live data: never serve a build-time snapshot.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get('listingId');
  const username = searchParams.get('username');
  if (listingId) return Response.json({ visits: listVisitsForListing(listingId) });
  if (username) return Response.json({ visits: listVisitsForUser(username) });
  return Response.json({ visits: [] });
}

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  if (!data.listingId || !data.tenant || !data.date || !data.time) {
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }
  const visit = createVisit(data);
  if (!visit) return Response.json({ error: 'Listing not found' }, { status: 404 });
  return Response.json({ visit });
}
