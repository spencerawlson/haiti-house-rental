import { getPresence } from '@/lib/presence-server';
import { getAccountNames } from '@/lib/accounts-server';

// Admin-only (middleware gates /api/admin/*): who is live on the site
// right now, joined with their account name and id.
//
// The join looks up only the usernames that are actually live. It used to
// load every account and .find() through that array per live user, so the
// cost of rendering "3 people online" grew with the size of the user
// base — and this route is polled every 30 seconds.
export const dynamic = 'force-dynamic';

export async function GET() {
  const p = getPresence();
  const names = await getAccountNames(p.users.map((u) => u.username));
  const users = p.users.map((u) => ({
    ...u,
    name: names[u.username]?.name || null,
    id: names[u.username]?.id || null,
  }));
  return Response.json({ users, visitors: p.visitors });
}
