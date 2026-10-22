import { verifyAccount } from '@/lib/accounts-server';
import { createSession } from '@/lib/session-server';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';

// Sign-in: the client sends username + SHA-256 hash, never the password.
// On success the server sets the session cookie.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const username = String(data.username || '').toLowerCase();
  if (!rateLimit(`signin:${username}`, 10, 15 * 60 * 1000) || !rateLimit(`signin-ip:${clientIp(request)}`, 30, 15 * 60 * 1000)) {
    return tooMany();
  }
  const account = await verifyAccount(data.username, data.passwordHash);
  if (!account) return Response.json({ error: 'Invalid login' }, { status: 401 });
  return Response.json({ account }, { headers: { 'Set-Cookie': await createSession(account.username) } });
}
