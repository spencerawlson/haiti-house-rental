import { isAdminCookie } from '@/lib/admin-auth';
import { query } from '@/lib/db';
import { getAdminThread, postAdminMessage, markAdminThreadRead, listAdminThreads } from '@/lib/admin-chat-server';
import { rateLimit, tooMany } from '@/lib/rate-limit';

// The admin side of admin chat. Middleware already restricts every
// /api/admin/* route to the full admin (a stats token gets a 401 before
// it reaches here); the explicit check below is the second wall, the
// same shape as the other admin routes that spend or change something.
// GET with no username lists threads (last message + unread); GET with
// ?username= opens that user's thread and marks it read for the admin.
// POST sends as admin — to a suspended user too, on purpose: the admin
// has to be able to answer an appeal or explain a sanction.
export const dynamic = 'force-dynamic';

async function isAdmin(request) {
  return isAdminCookie(request.cookies.get('kay_admin')?.value);
}

export async function GET(request) {
  if (!(await isAdmin(request))) return Response.json({ error: 'Admin required' }, { status: 401 });
  const username = new URL(request.url).searchParams.get('username');
  if (!username) return Response.json({ threads: await listAdminThreads() });
  const { rows } = await query('SELECT username FROM accounts WHERE username = $1', [username]);
  if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
  await markAdminThreadRead(username, 'admin');
  return Response.json({ messages: await getAdminThread(username), username });
}

export async function POST(request) {
  if (!(await isAdmin(request))) return Response.json({ error: 'Admin required' }, { status: 401 });
  const { username, text } = await request.json().catch(() => ({}));
  const { rows } = await query('SELECT username FROM accounts WHERE username = $1', [String(username || '')]);
  if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!rateLimit(`adminchat-admin:${rows[0].username}`, 30, 60 * 1000)) return tooMany();
  const msg = await postAdminMessage({ username: rows[0].username, sender: 'admin', text });
  if (!msg) return Response.json({ error: 'Invalid message' }, { status: 400 });
  return Response.json({ message: msg });
}
