import { getRevenue } from '@/lib/revenue-server';

// Admin-only (middleware gates /api/admin/*): the activation ledger.
// The roster starts with activations logged after this route shipped —
// earlier activations predate the ledger and are not backfilled, because
// their activation dates were never recorded.
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await getRevenue());
}
