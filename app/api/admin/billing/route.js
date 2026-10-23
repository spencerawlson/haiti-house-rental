import { setBillingStatus, BILLING_STATUSES } from '@/lib/billing-server';
import { getServerAccount } from '@/lib/accounts-server';
import { audit } from '@/lib/audit';

// Admin override of an account's subscription state: a goodwill
// reactivation, or undoing a suspension that was not the landlord's
// fault. Admin-gated by middleware (/api/admin/*).
//
// Setting 'active' without a payment grants a quarter only if the account
// has none left — it never shortens a period already paid for.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const username = String(data.username || '');
  const status = String(data.status || '');
  if (!BILLING_STATUSES.includes(status)) {
    return Response.json({ error: `status must be one of ${BILLING_STATUSES.join(', ')}` }, { status: 400 });
  }
  const existing = await getServerAccount(username);
  if (!existing) return Response.json({ error: 'Account not found' }, { status: 404 });
  const updated = await setBillingStatus(username, status);
  if (!updated) return Response.json({ error: 'Could not change it' }, { status: 400 });
  await audit('admin', 'billing.status', username, { from: existing.billingStatus, to: status });
  return Response.json({ account: await getServerAccount(username) });
}
