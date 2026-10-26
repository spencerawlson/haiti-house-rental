import { recordAdImpression } from '@/lib/listings-server';

// One ad view: a carousel card actually shown on the home page. No
// sign-in — every visitor sees the carousel. The counter is guarded
// server-side (only a displayable campaign with budget room counts),
// and the client reports each card at most once per browser session,
// so a refresh does not burn the budget. The response never reveals
// counts: budgets are hidden from everyone but the admin.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  if (!data.listingId) return Response.json({ counted: false });
  const counted = await recordAdImpression(String(data.listingId));
  return Response.json({ counted });
}
