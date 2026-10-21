import { query } from '@/lib/db';

// Public deploy check: is the app up, and can it reach Postgres?
// Returns no details — just up/down — so it is safe to curl after a
// rebuild to confirm the database came up with the app.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await query('SELECT 1');
    return Response.json({ ok: true, db: 'up' });
  } catch {
    return Response.json({ ok: false, db: 'down' }, { status: 503 });
  }
}
