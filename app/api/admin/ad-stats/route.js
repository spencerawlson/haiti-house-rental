import { listAdStats } from '@/lib/listings-server';

// Admin-only: the live budget numbers for every ad campaign. Gated by
// the middleware like every /api/admin/* route. Landlords never see
// these numbers — the public listings shape carries no counts.
export async function GET() {
  return Response.json({ stats: await listAdStats() });
}
