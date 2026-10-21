import { getListing, setListingActive } from '@/lib/listings-server';
import { isAdminCookie } from '@/lib/admin-auth';

// Put a taken-down listing back online: the listing owner, or the admin.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const listing = await getListing(data.id);
  if (!listing || listing.status !== 'removed') {
    return Response.json({ error: 'Listing not found' }, { status: 404 });
  }
  const admin = await isAdminCookie(request.cookies.get('kay_admin')?.value);
  if (!admin && listing.owner !== data.username) {
    return Response.json({ error: 'Not allowed' }, { status: 403 });
  }
  const restored = await setListingActive(data.id);
  return Response.json({ listing: restored });
}
