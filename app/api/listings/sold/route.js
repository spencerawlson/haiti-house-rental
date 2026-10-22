import { getListing, setListingSold } from '@/lib/listings-server';
import { SOLD_STATUSES } from '@/lib/config';
import { isAdminCookie } from '@/lib/admin-auth';
import { getSessionAccount } from '@/lib/session-server';
import { audit } from '@/lib/audit';

// Mark a home sold or leased — the owner (by session) or the admin.
//
// The home leaves search immediately, and is deleted for good 48 hours
// later (lib/config.js, swept from the listing read paths). Those 48
// hours are the undo window: /api/listings/restore puts it back and
// cancels the deletion.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const status = String(data.status || '');
  if (!SOLD_STATUSES.includes(status)) {
    return Response.json({ error: 'Status must be sold or leased' }, { status: 400 });
  }
  const listing = await getListing(data.id);
  if (!listing) return Response.json({ error: 'Listing not found' }, { status: 404 });
  const admin = await isAdminCookie(request.cookies.get('kay_admin')?.value);
  const me = admin ? null : await getSessionAccount(request);
  if (!admin && (!me || !listing.owner || listing.owner !== me.username)) {
    return Response.json({ error: 'Not allowed' }, { status: 403 });
  }
  const updated = await setListingSold(data.id, status);
  if (!updated) return Response.json({ error: 'Listing not found' }, { status: 404 });
  await audit(admin ? 'admin' : me.username, `listing.${status}`, data.id, { deletesAt: updated.deletesAt });
  return Response.json({ listing: updated });
}
