import { unlink } from 'fs/promises';
import path from 'path';
import { getListing, deleteListingForGood } from '@/lib/listings-server';
import { isAdminCookie } from '@/lib/admin-auth';
import { getSessionAccount } from '@/lib/session-server';
import { audit } from '@/lib/audit';

// Delete a listing for good — the owner (by session) or the admin.
// Unlike /api/listings/takedown, this does not hide the home: the row
// leaves the database and its photos leave the disk. See
// deleteListingForGood() for what is deleted and what is deliberately
// kept (payments, reports, audit).
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const listing = await getListing(data.id);
  // Any status may be deleted — a taken-down home is the usual case.
  if (!listing) return Response.json({ error: 'Listing not found' }, { status: 404 });
  const admin = await isAdminCookie(request.cookies.get('kay_admin')?.value);
  const me = admin ? null : await getSessionAccount(request);
  if (!admin && (!me || !listing.owner || listing.owner !== me.username)) {
    return Response.json({ error: 'Not allowed' }, { status: 403 });
  }
  const result = await deleteListingForGood(data.id);
  if (result.error === 'not_found') {
    return Response.json({ error: 'Listing not found' }, { status: 404 });
  }
  if (result.error === 'payment_pending') {
    // Confirming it later would extend advertising on a home that no
    // longer exists, so the landlord waits for the admin's decision.
    return Response.json({ error: 'payment_pending' }, { status: 409 });
  }
  // Files last: the rows are already gone, and an unlink cannot be rolled
  // back. A failure here leaves an unreferenced file, which is harmless.
  const dir = path.join(process.cwd(), 'public', 'uploads');
  for (const url of result.files) {
    await unlink(path.join(dir, path.basename(url))).catch(() => {});
  }
  await audit(admin ? 'admin' : me.username, 'listing.delete', data.id, {
    title: result.listing.title,
    ...result.removed,
    files: result.files.length,
  });
  return Response.json({ ok: true, removed: result.removed, files: result.files.length });
}
