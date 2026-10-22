import { getListing, setListingActive } from '@/lib/listings-server';
import { isAdminCookie } from '@/lib/admin-auth';
import { getSessionAccount } from '@/lib/session-server';
import { audit } from '@/lib/audit';

// Put a taken-down listing back online: the listing owner, or the admin.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const listing = await getListing(data.id);
  if (!listing || listing.status !== 'removed') {
    return Response.json({ error: 'Listing not found' }, { status: 404 });
  }
  const admin = await isAdminCookie(request.cookies.get('kay_admin')?.value);
  const me = admin ? null : await getSessionAccount(request);
  if (!admin && (!me || !listing.owner || listing.owner !== me.username)) {
    return Response.json({ error: 'Not allowed' }, { status: 403 });
  }
  const restored = await setListingActive(data.id);
  await audit(admin ? 'admin' : me.username, 'listing.restore', data.id);
  return Response.json({ listing: restored });
}
