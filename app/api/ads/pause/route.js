import { getListing, setAdPaused } from '@/lib/listings-server';
import { getSessionAccount, unauthorized } from '@/lib/session-server';
import { isAdminCookie } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';

// Landlord self-serve pause/resume for their own campaign. The admin's
// first activation is the payment confirmation; after that, no admin
// action is needed here — pausing keeps the remaining budget, resuming
// spends nothing extra. An admin may also flip it from the board.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const listing = await getListing(String(data.id || ''));
  if (!listing || listing.status !== 'active') return Response.json({ error: 'Listing not found' }, { status: 404 });
  const admin = await isAdminCookie(request.cookies.get('kay_admin')?.value);
  const me = admin ? null : await getSessionAccount(request);
  if (!admin && (!me || me.username !== listing.owner)) return unauthorized();
  const updated = await setAdPaused(listing.id, data.paused === true);
  await audit(admin ? 'admin' : me.username, data.paused === true ? 'listing.ad_pause' : 'listing.ad_resume', listing.id);
  return Response.json({ listing: updated });
}
