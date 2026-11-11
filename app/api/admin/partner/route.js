import { createServerAccount } from '@/lib/accounts-server';
import { audit } from '@/lib/audit';

// Admin-created partner account: active immediately, free — no fee, no
// activation queue, and (via the revenue guard) never counted in revenue.
// Gated by the middleware like every /api/admin/* route. The password is
// hashed in the browser by the admin form, exactly like normal signup.
// Role is 'landlord' by default; 'seller' creates the founder's sole
// Shop seller account (public seller signup is closed).
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  if (!data.username || !data.passwordHash) {
    return Response.json({ error: 'Username and password are required' }, { status: 400 });
  }
  const role = data.role || 'landlord';
  if (!['seller', 'landlord'].includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 });
  }
  const account = await createServerAccount({
    name: data.name || data.username,
    username: data.username,
    passwordHash: data.passwordHash,
    phone: data.phone || '',
    email: data.email || '',
    location: data.location || null,
    role,
    partner: true,
  });
  if (!account) return Response.json({ error: 'Username taken' }, { status: 409 });
  await audit('admin', 'account.partner_created', account.username);
  return Response.json({ account });
}
