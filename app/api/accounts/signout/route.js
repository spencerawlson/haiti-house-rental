import { destroySession, clearSessionCookie } from '@/lib/session-server';

export async function POST(request) {
  await destroySession(request);
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } });
}
