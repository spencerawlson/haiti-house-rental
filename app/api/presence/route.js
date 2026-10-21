import { touchPresence } from '@/lib/presence-server';

// Public by design: every open page pings once a minute so the Admin
// Board can show who is live. The payload is only a username (when
// signed in) or an anonymous visitor id — never a password or hash.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  touchPresence({ username: data.username || null, visitor: data.visitor || null });
  return Response.json({ ok: true });
}
