import { getListing, setListingActive, withListingSlot } from '@/lib/listings-server';
import { isAdminCookie } from '@/lib/admin-auth';
import { getSessionAccount } from '@/lib/session-server';
import { audit } from '@/lib/audit';

// Put a listing back online: the listing owner, or the admin. Also the
// undo for a sold/leased tag — restoring inside the 48-hour window
// cancels the pending auto-deletion (setListingActive clears sold_at).
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const listing = await getListing(data.id);
  if (!listing || !['removed', 'sold', 'leased'].includes(listing.status)) {
    return Response.json({ error: 'Listing not found' }, { status: 404 });
  }
  const admin = await isAdminCookie(request.cookies.get('kay_admin')?.value);
  const me = admin ? null : await getSessionAccount(request);
  if (!admin && (!me || !listing.owner || listing.owner !== me.username)) {
    return Response.json({ error: 'Not allowed' }, { status: 403 });
  }
  // Back online = live again, so the owner's listing limit applies. The
  // admin, who sets limits, is not bound by them.
  let restored;
  if (admin) {
    restored = await setListingActive(data.id);
  } else {
    const slot = await withListingSlot(listing.owner, (db) => setListingActive(data.id, db));
    if (slot.error) return Response.json({ error: slot.error, limit: slot.limit, used: slot.used }, { status: 403 });
    restored = slot.value;
  }
  await audit(admin ? 'admin' : me.username, 'listing.restore', data.id);
  return Response.json({ listing: restored });
}
