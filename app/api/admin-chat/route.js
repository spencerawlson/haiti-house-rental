import { getSessionAccount, unauthorized } from '@/lib/session-server';
import { getAdminThread, postAdminMessage, markAdminThreadRead, ensureAdminThread } from '@/lib/admin-chat-server';
import { rateLimit, tooMany } from '@/lib/rate-limit';

// The user's own admin thread: "Contact admin" from the portal and the
// home page lands here. The thread is the user's alone — the username
// comes from the session, never from a query param, so one user can
// never open another's admin thread. Fraud suspension blocks sending
// (like the listing chat) but not reading: a suspended user still
// needs to see what the admin wrote.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  await ensureAdminThread(me.username);
  await markAdminThreadRead(me.username, 'user');
  return Response.json({ messages: await getAdminThread(me.username) });
}

export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  if (me.fraudSuspended) return Response.json({ error: 'suspended' }, { status: 403 });
  if (!rateLimit(`adminchat:${me.username}`, 30, 60 * 1000)) return tooMany();
  const { text } = await request.json().catch(() => ({}));
  const msg = await postAdminMessage({ username: me.username, sender: 'user', text });
  if (!msg) return Response.json({ error: 'Invalid message' }, { status: 400 });
  return Response.json({ message: msg });
}
