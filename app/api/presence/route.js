import { touchPresence } from '@/lib/presence-server';
import { getSessionAccount, touchSessionActivity } from '@/lib/session-server';
import { recordVisit } from '@/lib/traffic-server';
import { log } from '@/lib/log';

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
  // Unique visitors per day (0012). The row is claimed once per person
  // per Haiti day, so calling this on every one-a-minute ping is cheap
  // and cannot inflate the figure. A failure here must never break the
  // heartbeat — the reply below keeps the session hint honest, which
  // matters more than a traffic row.
  try {
    await recordVisit({ username: me?.username || null, visitor: data.visitor || null });
  } catch (e) {
    log('error', 'traffic.record_failed', { message: e.message });
  }
  // The avatar rides along here on purpose: the account row is already
  // loaded for this request, so the tab bar can show a profile picture
  // without any page paying for an extra round trip.
  return Response.json({
    ok: true,
    signedIn: !!me,
    username: me?.username || null,
    avatarUrl: me?.avatarUrl || null,
  });
}
