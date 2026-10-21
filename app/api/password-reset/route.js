import { resetPassword } from '@/lib/accounts-server';

// Self-serve password reset. Public by design — a locked-out user cannot
// sign in first. The check is the phone number on the account (many
// accounts have no email, and there is no SMS channel in v0), the same
// phone the admin already uses to match transfers. The new password
// arrives as a browser hash, never in clear text.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  if (!data.username || !data.phone || !data.passwordHash) {
    return Response.json({ error: 'Username, phone and new password are required' }, { status: 400 });
  }
  const account = await resetPassword(data.username, data.phone, data.passwordHash);
  if (!account) return Response.json({ error: 'No account matches that username and phone' }, { status: 404 });
  return Response.json({ ok: true });
}
