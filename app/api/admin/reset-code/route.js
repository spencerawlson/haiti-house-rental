import { issueResetCode } from '@/lib/accounts-server';

// Admin issues a one-time password-reset code for a user (gated by the
// middleware like every /api/admin/* route). The code is shown once to
// the admin, who gives it to the user after confirming who they are.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const issued = data.username ? await issueResetCode(String(data.username)) : null;
  if (!issued) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(issued);
}
