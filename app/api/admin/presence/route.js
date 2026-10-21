import { getPresence } from '@/lib/presence-server';
import { listServerAccounts } from '@/lib/accounts-server';

// Admin-only (middleware gates /api/admin/*): who is live on the site
// right now, joined with their account name and id.
export const dynamic = 'force-dynamic';

export async function GET() {
  const p = getPresence();
  const accounts = await listServerAccounts();
  const users = p.users.map((u) => {
    const a = accounts.find((x) => x.username === u.username);
    return { ...u, name: a?.name || null, id: a?.id || null };
  });
  return Response.json({ users, visitors: p.visitors });
}
