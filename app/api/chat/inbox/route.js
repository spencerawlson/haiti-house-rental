import { getInbox } from '@/lib/chat';
import { getSessionAccount } from '@/lib/session-server';

// Threads the signed-in user is part of, newest first, with unread counts.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const me = await getSessionAccount(request);
  return Response.json({ threads: me ? await getInbox(me.username) : [] });
}
