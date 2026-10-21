import { getListings, addListing } from '@/lib/listings';

export async function GET() {
  return Response.json({ listings: getListings() });
}

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const listing = addListing(data);
  if (!listing) return Response.json({ error: 'Title and commune are required' }, { status: 400 });
  return Response.json({ listing });
}
