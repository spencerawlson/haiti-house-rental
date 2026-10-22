import { issueResetCode } from '@/lib/accounts-server';
import { audit } from '@/lib/audit';

// Admin issues a one-time password-reset code for a user (gated by the
// middleware like every /api/admin/* route). The code is shown once to
// the admin, who gives it to the user after confirming who they are.
// The audit records that a code was issued — never the code itself.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const issued = data.username ? await issueResetCode(String(data.username)) : null;
  if (!issued) return Response.json({ error: 'Not found' }, { status: 404 });
  await audit('admin', 'account.reset_code_issued', issued.username);
  return Response.json(issued);
}
