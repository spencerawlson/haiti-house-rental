import { createServerAccount } from '@/lib/accounts-server';

// Admin-created partner account: active immediately, free — no fee, no
// activation queue, and (via the revenue guard) never counted in revenue.
// Gated by the middleware like every /api/admin/* route. The password is
// hashed in the browser by the admin form, exactly like normal signup.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  if (!data.username || !data.passwordHash) {
    return Response.json({ error: 'Username and password are required' }, { status: 400 });
  }
  const account = await createServerAccount({
    name: data.name || data.username,
    username: data.username,
    passwordHash: data.passwordHash,
    phone: data.phone || '',
    email: data.email || '',
    location: data.location || null,
    role: 'landlord',
    partner: true,
  });
  if (!account) return Response.json({ error: 'Username taken' }, { status: 409 });
  return Response.json({ account });
}
