import { verifyAccount } from '@/lib/accounts-server';

// Sign-in: the client sends username + SHA-256 hash, never the password.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const account = await verifyAccount(data.username, data.passwordHash);
  if (!account) return Response.json({ error: 'Invalid login' }, { status: 401 });
  return Response.json({ account });
}
