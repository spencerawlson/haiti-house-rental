import { hideThread } from '@/lib/chat';
import { resolveThread } from '@/lib/chat-auth';
import { getSessionAccount, unauthorized } from '@/lib/session-server';

// Delete a chat on the signed-in user's side only — it leaves their inbox
// (and unread counts) but stays for the other side.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  const { listingId, tenant } = await request.json().catch(() => ({}));
  const thread = await resolveThread(me, listingId, tenant);
  if (thread && thread.tenant !== null) await hideThread(thread.listingId, me.username, thread.tenant);
  return Response.json({ ok: true });
}
