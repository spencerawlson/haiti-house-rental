import { listMonCashNotifications } from '@/lib/moncash-server';

// MonCash notifications received, newest first, for the admin's review
// queue. Gated by the middleware like every /api/admin/* route: the
// full-admin scope only, never the stats scope.
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ notifications: await listMonCashNotifications() });
}
