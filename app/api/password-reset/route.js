import { resetPasswordWithCode } from '@/lib/accounts-server';
import { destroyAllSessions } from '@/lib/session-server';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';

// Password reset with a one-time code from the admin (see
// issueResetCode). Public by design — a locked-out user cannot sign in
// first. Attempts are rate-limited, the code works once, and a reset
// signs out every device. The new password arrives as a browser hash.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  if (!data.username || !data.code || !data.passwordHash) {
    return Response.json({ error: 'Username, reset code and new password are required' }, { status: 400 });
  }
  const username = String(data.username).toLowerCase();
  if (!rateLimit(`reset:${username}`, 5, 60 * 60 * 1000) || !rateLimit(`reset-ip:${clientIp(request)}`, 20, 60 * 60 * 1000)) {
    return tooMany();
  }
  const account = await resetPasswordWithCode(String(data.username), String(data.code), String(data.passwordHash));
  if (!account) return Response.json({ error: 'Invalid or expired reset code' }, { status: 400 });
  await destroyAllSessions(account.username);
  return Response.json({ ok: true });
}
