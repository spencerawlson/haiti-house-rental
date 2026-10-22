import { resetPassword } from '@/lib/accounts-server';
import { destroyAllSessions } from '@/lib/session-server';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';

// Self-serve password reset. Public by design — a locked-out user cannot
// sign in first. The check is the phone number on the account (many
// accounts have no email, and there is no SMS channel in v0). That phone
// is no longer shown to anyone else, attempts are rate-limited so it
// cannot be guessed, and a reset signs out every device. The new
// password arrives as a browser hash, never in clear text.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  if (!data.username || !data.phone || !data.passwordHash) {
    return Response.json({ error: 'Username, phone and new password are required' }, { status: 400 });
  }
  const username = String(data.username).toLowerCase();
  if (!rateLimit(`reset:${username}`, 5, 60 * 60 * 1000) || !rateLimit(`reset-ip:${clientIp(request)}`, 20, 60 * 60 * 1000)) {
    return tooMany();
  }
  const account = await resetPassword(data.username, data.phone, String(data.passwordHash));
  if (!account) return Response.json({ error: 'No account matches that username and phone' }, { status: 404 });
  await destroyAllSessions(account.username);
  return Response.json({ ok: true });
}
