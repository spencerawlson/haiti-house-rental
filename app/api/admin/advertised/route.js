import { setAdvertised } from '@/lib/listings-server';
import { audit } from '@/lib/audit';

// Admin advertising toggle. The flag alone shows nothing: a home reaches
// the advertised carousel only with a view/click budget from a confirmed
// advertising payment — it never boosts search rank.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const listing = await setAdvertised(data.id, data.advertised);
  if (!listing) return Response.json({ error: 'Listing not found' }, { status: 404 });
  await audit('admin', data.advertised === true ? 'listing.advertise_on' : 'listing.advertise_off', listing.id);
  return Response.json({ listing });
}
