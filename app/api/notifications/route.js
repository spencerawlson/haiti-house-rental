import { listNotifications, unreadNotificationCount } from '@/lib/notify-server';
import { getSessionAccount } from '@/lib/session-server';

// The signed-in user's notification inbox (newest first) + unread count.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const me = await getSessionAccount(request);
  if (!me) return Response.json({ notifications: [], unread: 0 });
  return Response.json({ notifications: await listNotifications(me.username), unread: await unreadNotificationCount(me.username) });
}
