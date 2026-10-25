import { getSessionAccount, unauthorized, clearSessionCookie } from '@/lib/session-server';
import { deleteServerAccount } from '@/lib/accounts-server';
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

// Account deletion: the caller deletes their own account only, never
// anyone else's — the username comes from the session, not the body.
export async function DELETE(request) {
  const account = await getSessionAccount(request);
  if (!account) return unauthorized();
  const ok = await deleteServerAccount(account.username);
  if (!ok) return Response.json({ error: 'Account not found' }, { status: 404 });
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } });
}
