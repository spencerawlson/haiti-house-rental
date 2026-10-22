import { markAllRead } from '@/lib/notify-server';
import { getSessionAccount, unauthorized } from '@/lib/session-server';

// Opening the notifications page marks them all read.
export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  await markAllRead(me.username);
  return Response.json({ ok: true });
}
