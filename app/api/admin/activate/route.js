import { setAccountActivated } from '@/lib/accounts-server';

// Admin activation: the admin matched the MonCash/NatCash transfer to the
// phone number on the account and activates it.
// v0: no auth on this route — gate the admin area before launch.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const account = setAccountActivated(data.username, data.activated);
  if (!account) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ account });
}
