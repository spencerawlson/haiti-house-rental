import { getListing, setAdPaused } from '@/lib/listings-server';
import { getCampaign, setCampaignPaused } from '@/lib/advertisers-server';
import { getSessionAccount, unauthorized } from '@/lib/session-server';
import { isAdminCookie } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';

// Self-serve pause/resume for an ad campaign — a listing ad (the
// landlord who owns the home) or a picture ad (the advertiser who owns
// the campaign). The admin's first activation is the payment
// confirmation; after that, no admin action is needed here — pausing
// keeps the remaining budget, resuming spends nothing extra. An admin
// may also flip either kind from the board.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const admin = await isAdminCookie(request.cookies.get('kay_admin')?.value);
  const me = admin ? null : await getSessionAccount(request);
  if (data.campaignId) {
    const campaign = await getCampaign(String(data.campaignId));
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (!admin && (!me || me.username !== campaign.advertiserUsername)) return unauthorized();
    const updated = await setCampaignPaused(campaign.id, data.paused === true);
    await audit(admin ? 'admin' : me.username, data.paused === true ? 'campaign.ad_pause' : 'campaign.ad_resume', campaign.id);
    return Response.json({ campaign: updated });
  }
  const listing = await getListing(String(data.id || ''));
  if (!listing || listing.status !== 'active') return Response.json({ error: 'Listing not found' }, { status: 404 });
  if (!admin && (!me || me.username !== listing.owner)) return unauthorized();
  const updated = await setAdPaused(listing.id, data.paused === true);
  await audit(admin ? 'admin' : me.username, data.paused === true ? 'listing.ad_pause' : 'listing.ad_resume', listing.id);
  return Response.json({ listing: updated });
}
