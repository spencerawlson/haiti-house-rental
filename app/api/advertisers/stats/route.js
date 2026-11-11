import { getAdvertiserStats } from '@/lib/advertisers-server';
import { getSessionAccount, unauthorized } from '@/lib/session-server';

// An advertiser's own totals — counts only. Session-gated, and scoped
// to the caller: no username is ever taken from the request, so one
// advertiser can never read another's numbers.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  return Response.json({ stats: await getAdvertiserStats(me.username) });
}
