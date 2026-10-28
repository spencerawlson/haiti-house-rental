import { setTyping } from '@/lib/typing';
import { resolveThread } from '@/lib/chat-auth';
import { getSessionAccount, unauthorized } from '@/lib/session-server';
import { rateLimit, tooMany } from '@/lib/rate-limit';

// A "typing…" ping, fired (debounced) while the composer has text. The
// other side picks it up on its next GET /api/chat poll — see
// app/api/chat/route.js. Mirrors app/api/chat/read/route.js's shape.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  if (!rateLimit(`typing:${me.username}`, 20, 60 * 1000)) return tooMany();
  const { listingId, tenant } = await request.json().catch(() => ({}));
  const thread = await resolveThread(me, listingId, tenant);
  if (thread && thread.tenant !== null) setTyping(thread.listingId, thread.tenant, thread.isOwner ? 'owner' : 'tenant');
  return Response.json({ ok: true });
}
