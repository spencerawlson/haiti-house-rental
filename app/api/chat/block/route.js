import { resolveThread } from '@/lib/chat-auth';
import { getConversation, setBlocked } from '@/lib/conversations-server';
import { getSessionAccount, unauthorized } from '@/lib/session-server';

// Block or unblock a conversation. Either participant can block; only
// the one who blocked can unblock. Messages are kept.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  const { listingId, tenant, blocked } = await request.json().catch(() => ({}));
  const thread = await resolveThread(me, listingId, tenant);
  if (!thread || thread.tenant === null) return Response.json({ error: 'Not found' }, { status: 404 });
  const conv = await getConversation(thread.listing.id, thread.tenant);
  if (!conv) return Response.json({ error: 'Not found' }, { status: 404 });
  const updated = await setBlocked(conv.id, me.username, blocked === true);
  return Response.json({ conversation: { id: updated.id, blocked: !!updated.blockedBy, blockedByMe: updated.blockedBy === me.username } });
}
