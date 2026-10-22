import { setAccountActivated } from '@/lib/accounts-server';
import { logActivation } from '@/lib/revenue-server';
import { audit } from '@/lib/audit';

// Admin activation: the admin matched the MonCash/NatCash transfer to the
// phone number on the account and activates it. Activating a landlord
// account logs 1000 HTG of revenue (once per account, tenants excluded).
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const account = await setAccountActivated(data.username, data.activated);
  if (!account) return Response.json({ error: 'Not found' }, { status: 404 });
  if (data.activated === true) await logActivation(account);
  await audit('admin', data.activated === true ? 'account.activate' : 'account.deactivate', account.username);
  return Response.json({ account });
}
