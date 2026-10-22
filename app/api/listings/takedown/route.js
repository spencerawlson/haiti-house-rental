import { getListing, setListingRemoved } from '@/lib/listings-server';
import { isAdminCookie } from '@/lib/admin-auth';
import { getSessionAccount } from '@/lib/session-server';
import { audit } from '@/lib/audit';

// Take down a listing: the listing owner (by session), or the admin (via
// the admin cookie), hides it from home, search and detail pages. The row
// stays in the database, so a takedown is reversible later.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const listing = await getListing(data.id);
  if (!listing || listing.status !== 'active') {
    return Response.json({ error: 'Listing not found' }, { status: 404 });
  }
  const admin = await isAdminCookie(request.cookies.get('kay_admin')?.value);
  const me = admin ? null : await getSessionAccount(request);
  if (!admin && (!me || !listing.owner || listing.owner !== me.username)) {
    return Response.json({ error: 'Not allowed' }, { status: 403 });
  }
  const removed = await setListingRemoved(data.id);
  await audit(admin ? 'admin' : me.username, 'listing.takedown', data.id);
  return Response.json({ listing: removed });
}
