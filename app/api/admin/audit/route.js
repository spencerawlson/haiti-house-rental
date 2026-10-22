import { recentAudit } from '@/lib/audit';

// The latest audit entries for the Admin Board (gated by the middleware).
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ entries: await recentAudit(200) });
}
