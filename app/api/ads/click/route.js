import { recordAdClick, recordCampaignClick } from '@/lib/listings-server';

// One ad click: a tap on a carousel card. Every tap counts (a tap is a
// deliberate act, unlike a passive view), still under the same
// server-side guard — only a displayable campaign with budget room.
// The response never reveals counts.
//
// Either a listing ad ({ listingId }) or a picture ad ({ campaignId }
// — or the carousel's prefixed form, a listingId of 'c:<campaign id>'.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const raw = data.campaignId ? String(data.campaignId) : (data.listingId ? String(data.listingId) : '');
  if (!raw) return Response.json({ counted: false });
  if (data.campaignId || raw.startsWith('c:')) {
    const counted = await recordCampaignClick(raw.startsWith('c:') ? raw.slice(2) : raw);
    return Response.json({ counted });
  }
  const counted = await recordAdClick(raw);
  return Response.json({ counted });
}
