import { setVisitStatus } from '@/lib/visits-server';
import { getSessionAccount, unauthorized } from '@/lib/session-server';

// Confirm or decline a visit. Only the listing owner (by session) can —
// a tenant cannot confirm their own request.
export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  const data = await request.json().catch(() => ({}));
  const visit = await setVisitStatus(data.id, data.status, me.username);
  if (!visit) return Response.json({ error: 'Not allowed' }, { status: 403 });
  return Response.json({ visit });
}
