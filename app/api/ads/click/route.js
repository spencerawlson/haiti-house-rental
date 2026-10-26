import { recordAdClick } from '@/lib/listings-server';

// One ad click: a tap on a carousel card. Every tap counts (a tap is a
// deliberate act, unlike a passive view), still under the same
// server-side guard — only a displayable campaign with budget room.
// The response never reveals counts.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  if (!data.listingId) return Response.json({ counted: false });
  const counted = await recordAdClick(String(data.listingId));
  return Response.json({ counted });
}
