import { channelStatus } from '@/lib/notify-server';

// Which external notification channels are configured (never the keys).
// Gated by the middleware like every /api/admin/* route.
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(channelStatus());
}
