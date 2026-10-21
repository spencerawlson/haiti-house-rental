import { createServerAccount, listServerAccounts, getServerAccount } from '@/lib/accounts-server';

// Live data: never serve a build-time snapshot of the accounts.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  if (username) {
    const account = await getServerAccount(username);
    if (!account) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ account });
  }
  return Response.json({ accounts: await listServerAccounts() });
}

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  if (!data.name || !data.username || !data.passwordHash || !data.phone) {
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }
  const account = await createServerAccount(data);
  if (!account) return Response.json({ error: 'Username taken' }, { status: 409 });
  return Response.json({ account });
}
