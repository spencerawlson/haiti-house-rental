import { listActiveCampaigns } from '@/lib/advertisers-server';

// Public feed of picture ads that may show right now. No sign-in, no
// counts — the carousel renders these and reports views/clicks back
// through /api/ads/impression and /api/ads/click.
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ campaigns: await listActiveCampaigns() });
}
