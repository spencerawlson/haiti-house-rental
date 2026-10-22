import { touchPresence } from '@/lib/presence-server';
import { getSessionAccount } from '@/lib/session-server';

// Public by design: every open page pings once a minute so the Admin
// Board can show who is live. A signed-in user counts by their session
// (a username in the body is ignored); everyone else by an anonymous
// visitor id. The reply tells the page whether its session is still
// valid, so a stale "signed in" hint in the browser gets cleared.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const me = await getSessionAccount(request);
  touchPresence({ username: me?.username || null, visitor: data.visitor || null });
  return Response.json({ ok: true, signedIn: !!me, username: me?.username || null });
}
