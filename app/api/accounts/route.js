import { createServerAccount, listServerAccounts, getPublicProfile } from '@/lib/accounts-server';
import { createSession } from '@/lib/session-server';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';

// Live data: never serve a build-time snapshot of the accounts.
export const dynamic = 'force-dynamic';

// The full list is admin-only (middleware). A ?username= lookup is public
// but returns only name + role — your own full profile is /api/accounts/me.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  if (username) {
    const account = await getPublicProfile(username);
    if (!account) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ account });
  }
  return Response.json({ accounts: await listServerAccounts() });
}

// Public signup: tenant or landlord only. Partner accounts (free, active
// at once) are admin-created via /api/admin/partner — a `partner` flag
// sent here used to be honored, which skipped the activation fee.
export async function POST(request) {
  if (!rateLimit(`signup:${clientIp(request)}`, 10, 60 * 60 * 1000)) return tooMany();
  const data = await request.json().catch(() => ({}));
  const username = String(data.username || '').trim();
  if (!data.name || !username || !data.passwordHash || !data.phone) {
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(username)) {
    return Response.json({ error: 'Invalid username' }, { status: 400 });
  }
  const account = await createServerAccount({
    name: String(data.name),
    username,
    passwordHash: String(data.passwordHash),
    phone: String(data.phone),
    email: data.email ? String(data.email) : '',
    location: data.location || null,
    role: data.role === 'tenant' ? 'tenant' : 'landlord',
    partner: false,
  });
  if (!account) return Response.json({ error: 'Username taken' }, { status: 409 });
  return Response.json({ account }, { headers: { 'Set-Cookie': await createSession(account.username) } });
}
