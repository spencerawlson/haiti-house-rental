import { markThreadRead } from '@/lib/chat';
import { resolveThread } from '@/lib/chat-auth';
import { getSessionAccount, unauthorized } from '@/lib/session-server';

// Opening a chat marks its thread read for the signed-in user, so the
// unread badge clears when they have actually seen the messages.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  const { listingId, tenant } = await request.json().catch(() => ({}));
  const thread = await resolveThread(me, listingId, tenant);
  if (thread && thread.tenant !== null) await markThreadRead(thread.listingId, me.username, thread.tenant);
  return Response.json({ ok: true });
}
