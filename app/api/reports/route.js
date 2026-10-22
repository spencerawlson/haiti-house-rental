import { createReport, REPORT_REASONS } from '@/lib/reports-server';
import { resolveThread } from '@/lib/chat-auth';
import { getConversation } from '@/lib/conversations-server';
import { getListing } from '@/lib/listings-server';
import { getSessionAccount, unauthorized } from '@/lib/session-server';
import { rateLimit, tooMany } from '@/lib/rate-limit';

// Report a conversation (participants only) or a listing (any signed-in
// user). The admin reviews reports on the Admin Board.
export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  if (!rateLimit(`report:${me.username}`, 10, 60 * 60 * 1000)) return tooMany();
  const data = await request.json().catch(() => ({}));
  const reason = REPORT_REASONS.includes(data.reason) ? data.reason : null;
  if (!reason) return Response.json({ error: 'Invalid reason' }, { status: 400 });
  const details = String(data.details || '').trim().slice(0, 1000);
  if (data.kind === 'conversation') {
    const thread = await resolveThread(me, data.listingId, data.tenant);
    const conv = thread && thread.tenant !== null ? await getConversation(thread.listing.id, thread.tenant) : null;
    if (!conv) return Response.json({ error: 'Not found' }, { status: 404 });
    const { report, duplicate } = await createReport({ kind: 'conversation', targetId: conv.id, listingId: conv.listingId, reporter: me.username, reason, details });
    return Response.json({ report: { id: report.id }, duplicate });
  }
  if (data.kind === 'listing') {
    const listing = await getListing(data.listingId);
    if (!listing || listing.status !== 'active') return Response.json({ error: 'Not found' }, { status: 404 });
    if (listing.owner === me.username) return Response.json({ error: 'You cannot report your own listing' }, { status: 400 });
    const { report, duplicate } = await createReport({ kind: 'listing', targetId: listing.id, listingId: listing.id, reporter: me.username, reason, details });
    return Response.json({ report: { id: report.id }, duplicate });
  }
  return Response.json({ error: 'Invalid kind' }, { status: 400 });
}
