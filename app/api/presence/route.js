import { touchPresence } from '@/lib/presence-server';
import { getSessionAccount, touchSessionActivity } from '@/lib/session-server';

// Public by design: every open page pings once a minute so the Admin
// Board can show who is live. A signed-in user counts by their session
// (a username in the body is ignored); everyone else by an anonymous
// visitor id. The reply tells the page whether its session is still
// valid, so a stale "signed in" hint in the browser gets cleared.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const me = await getSessionAccount(request);
  touchPresence({ username: me?.username || null, visitor: data.visitor || null });
  // Persisted alongside the in-memory presence: that Map resets on every
  // restart and prunes after 10 minutes, so it cannot answer "last seen".
  if (me?.username) await touchSessionActivity(request);
  return Response.json({ ok: true, signedIn: !!me, username: me?.username || null });
}
