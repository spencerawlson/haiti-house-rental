import { setVisitStatus } from '@/lib/visits-server';

// Confirm or decline a visit. The server checks that the caller is the
// listing owner — a tenant cannot confirm their own request.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const visit = setVisitStatus(data.id, data.status, data.username);
  if (!visit) return Response.json({ error: 'Not allowed' }, { status: 403 });
  return Response.json({ visit });
}
