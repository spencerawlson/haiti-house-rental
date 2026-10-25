import { createServerAccount, listServerAccountsPage, getPublicProfile, setAccountLocale } from '@/lib/accounts-server';
import { createSession } from '@/lib/session-server';
import { getAccountMetrics } from '@/lib/account-metrics-server';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';

// Live data: never serve a build-time snapshot of the accounts.
// Sign-ups per IP per hour. 40 in production (generous: Haitian mobile
// carriers put many people behind one address). Overridable only so the
// regression suite — which signs up dozens of accounts from one IP — is
// not capped by its own size; leave SIGNUP_LIMIT_PER_HOUR unset in prod.
const SIGNUP_LIMIT_PER_HOUR = Number(process.env.SIGNUP_LIMIT_PER_HOUR) > 0 ? Number(process.env.SIGNUP_LIMIT_PER_HOUR) : 40;

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
  // The list reaches here only through the admin gate in middleware.js,
  // so it is the one place engagement figures belong. They are merged in
  // rather than added to pub(), which every signed-in user's own profile
  // uses.
  //
  // Paginated and searched in Postgres. The metrics are then fetched for
  // THIS PAGE's usernames only — the figures used to be aggregated across
  // every login event in the database to answer a question about the
  // twenty-five rows on screen.
  const pageData = await listServerAccountsPage({
    page: searchParams.get('page'),
    per: searchParams.get('per'),
    q: searchParams.get('q') || '',
    role: searchParams.get('role') || '',
    billing: searchParams.get('billing') || '',
  });
  const metrics = await getAccountMetrics(pageData.accounts.map((a) => a.username));
  return Response.json({
    ...pageData,
    accounts: pageData.accounts.map((a) => ({ ...a, metrics: metrics[a.username] || null })),
  });
}

// Public signup: tenant or landlord only. Partner accounts (free, active
// at once) are admin-created via /api/admin/partner — a `partner` flag
// sent here used to be honored, which skipped the activation fee.
export async function POST(request) {
  // Per-IP limits are generous: Haitian mobile carriers put many
  // subscribers behind one shared (CGNAT) address.
  if (!rateLimit(`signup:${clientIp(request)}`, SIGNUP_LIMIT_PER_HOUR, 60 * 60 * 1000)) return tooMany();
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
  await setAccountLocale(account.username, request.cookies.get('kay_locale')?.value);
  return Response.json({ account }, { headers: { 'Set-Cookie': await createSession(account.username) } });
}
