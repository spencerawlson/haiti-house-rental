// Admin fraud-flag table (gated by the middleware like every
// /api/admin/* route — full admin only, stats tokens refused).
// GET lists flagged accounts (open reports per account). POST suspends
// or reactivates one account for fraud; suspension is admin-only and
// never by payment, and it never touches billing.
import { listFlaggedAccounts, suspendAccountForFraud, reactivateAccountForFraud } from '@/lib/fraud-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ flags: await listFlaggedAccounts() });
}

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const username = String(data.username || '').trim();
  const action = data.action;
  if (action !== 'suspend' && action !== 'reactivate') {
    return Response.json({ error: 'Invalid action' }, { status: 400 });
  }
  let account = null;
  if (action === 'suspend') {
    // The reason is the category shown to the suspended user — it must
    // be admin-written, never pasted report text (wording can identify
    // a reporter in a small market).
    const reason = String(data.reason || '').trim().slice(0, 500);
    if (!reason) return Response.json({ error: 'Reason required' }, { status: 400 });
    account = await suspendAccountForFraud(username, reason);
  } else {
    account = await reactivateAccountForFraud(username);
  }
  if (!account) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ account });
}
