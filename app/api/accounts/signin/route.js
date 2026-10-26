import { verifyAccount, setAccountLocale } from '@/lib/accounts-server';
import { createSession } from '@/lib/session-server';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';

// Sign-in: the client sends username + SHA-256 hash, never the password.
// On success the server sets the session cookie.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const username = String(data.username || '').toLowerCase();
  if (!rateLimit(`signin:${username}`, 10, 15 * 60 * 1000) || !rateLimit(`signin-ip:${clientIp(request)}`, 100, 15 * 60 * 1000)) {
    return tooMany();
  }
  const account = await verifyAccount(data.username, data.passwordHash);
  if (!account) return Response.json({ error: 'Invalid login' }, { status: 401 });
  // Fraud suspension (0021) blocks tenant sign-in outright, with the
  // notice — never a bare failure. Landlords still sign in so they can
  // see the notice and the appeal path on their account page. No
  // session is created for a refused sign-in.
  if (account.fraudSuspended && account.role === 'tenant') {
    return Response.json({ error: 'suspended', reason: account.fraudReason || '' }, { status: 403 });
  }
  await setAccountLocale(account.username, request.cookies.get('kay_locale')?.value);
  return Response.json({ account }, { headers: { 'Set-Cookie': await createSession(account.username) } });
}
