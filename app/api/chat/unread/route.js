import { getUnreadTotal } from '@/lib/chat';
import { getSessionAccount } from '@/lib/session-server';

// Total unread messages for the tab-bar badge.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const me = await getSessionAccount(request);
  return Response.json({ total: me ? await getUnreadTotal(me.username) : 0 });
}
