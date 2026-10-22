import { setVerified } from '@/lib/listings-server';

// Admin marks a listing verified (or not) after a real check — gated by
// the middleware like every /api/admin/* route.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const listing = await setVerified(String(data.id || ''), data.verified === true);
  if (!listing) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ listing });
}
