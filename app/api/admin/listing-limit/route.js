import { query } from '@/lib/db';
import { listingUsage } from '@/lib/listings-server';
import { audit } from '@/lib/audit';

// Admin sets (or clears) how many homes an account may have live at once
// (0015) — e.g. a partner who posts homes for other people. `limit`
// empty/null = no limit. Lowering it below what the account already has
// removes nothing; it only blocks new posts. Gated by the middleware.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const username = String(data.username || '');
  let limit = null;
  if (data.limit !== null && data.limit !== undefined && String(data.limit).trim() !== '') {
    limit = Number(data.limit);
    if (!Number.isInteger(limit) || limit < 0 || limit > 10000) {
      return Response.json({ error: 'invalid_limit' }, { status: 400 });
    }
  }
  const { rows } = await query(
    `UPDATE accounts SET listing_limit = $2 WHERE username = $1 AND role <> 'tenant' RETURNING username`,
    [username, limit],
  );
  if (!rows[0]) return Response.json({ error: 'not_found' }, { status: 404 });
  const usage = await listingUsage(username);
  await audit('admin', 'account.listing_limit', username, { limit, used: usage.used });
  return Response.json({ username, ...usage });
}
