import { getSessionAccount, unauthorized } from '@/lib/session-server';
import { listingUsage } from '@/lib/listings-server';

// The signed-in user's own full profile (phone, email, activation), and
// for landlords their listing usage: { limit, used } — limit null = none.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const account = await getSessionAccount(request);
  if (!account) return unauthorized();
  const listings = account.role === 'tenant' ? null : await listingUsage(account.username);
  return Response.json({ account: { ...account, listings } });
}
