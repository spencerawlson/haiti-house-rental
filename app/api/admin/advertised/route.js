import { setAdvertised } from '@/lib/listings-server';

// Admin approval for advertising (75 HTG/month). Approval puts the home in
// the advertised carousel on the home page — it never boosts search rank.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const listing = await setAdvertised(data.id, data.advertised);
  if (!listing) return Response.json({ error: 'Listing not found' }, { status: 404 });
  return Response.json({ listing });
}
