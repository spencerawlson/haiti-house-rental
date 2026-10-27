import { getPromoCounts } from '@/lib/promo-server';

// The promo countdown: spots, tagged accounts, spots left. Counts only
// — no usernames, no money — and full-admin only by the middleware,
// like every other /api/admin/* route. The same counts feed the
// landing-page announcement, so both read one helper.
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await getPromoCounts());
}
