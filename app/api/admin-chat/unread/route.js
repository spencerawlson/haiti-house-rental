import { getSessionAccount, unauthorized } from '@/lib/session-server';
import { getAdminUnread } from '@/lib/admin-chat-server';

// The user's unread admin-chat count. Deliberately read-only: unlike
// the thread GET route, this never marks anything read, so the
// account page can fetch it for the Contact admin badge without
// clearing the count it displays.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  return Response.json({ unread: await getAdminUnread(me.username) });
}
