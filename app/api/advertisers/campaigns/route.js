import { createCampaign, listMyCampaigns } from '@/lib/advertisers-server';
import { getSessionAccount, unauthorized } from '@/lib/session-server';

// An advertiser's own campaigns. Session-gated: GET lists the caller's
// campaigns (counts only, never viewer data); POST creates one. Only
// the 'advertiser' role may create — a landlord or seller posting here
// gets 403, not a campaign.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  return Response.json({ campaigns: await listMyCampaigns(me.username) });
}

export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  if (me.role !== 'advertiser') return Response.json({ error: 'Only advertiser accounts can create campaigns' }, { status: 403 });
  const data = await request.json().catch(() => ({}));
  const result = await createCampaign({
    username: me.username,
    title: data.title,
    imageUrl: data.imageUrl,
    linkUrl: data.linkUrl,
  });
  if (result.error) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ campaign: result.campaign });
}
