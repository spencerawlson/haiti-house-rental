import { recordAdImpression, recordCampaignImpression } from '@/lib/listings-server';

// One ad view: a carousel card actually shown on the home page. No
// sign-in — every visitor sees the carousel. The counter is guarded
// server-side (only a displayable campaign with budget room counts),
// and the client reports each card at most once per browser session,
// so a refresh does not burn the budget. The response never reveals
// counts: budgets are hidden from everyone but the admin.
//
// Either a listing ad ({ listingId }) or a picture ad ({ campaignId }
// — or the carousel's prefixed form, a listingId of 'c:<campaign id>',
// which is what data-ad-card="c:<id>" cards report. Same { counted }
// answer either way.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const raw = data.campaignId ? String(data.campaignId) : (data.listingId ? String(data.listingId) : '');
  if (!raw) return Response.json({ counted: false });
  if (data.campaignId || raw.startsWith('c:')) {
    const counted = await recordCampaignImpression(raw.startsWith('c:') ? raw.slice(2) : raw);
    return Response.json({ counted });
  }
  const counted = await recordAdImpression(raw);
  return Response.json({ counted });
}
