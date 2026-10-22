import { getSessionAccount, unauthorized } from '@/lib/session-server';

// The signed-in user's own full profile (phone, email, activation).
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const account = await getSessionAccount(request);
  if (!account) return unauthorized();
  return Response.json({ account });
}
