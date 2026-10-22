import { countListingView } from '@/lib/listings-server';
import { getSessionAccount } from '@/lib/session-server';
import { getListing } from '@/lib/listings-server';
import { rateLimit, clientIp } from '@/lib/rate-limit';

// "How many people looked at my home." Called once by the detail page.
//
// What counts: one view per viewer per half hour, and never the owner
// looking at their own listing. A viewer is their session username when
// signed in, otherwise the anonymous `kay-visitor` id the presence ping
// already keeps in localStorage — that is far better than the IP address
// here, because Haitian carriers put many subscribers behind one shared
// (CGNAT) address, so counting by IP would merge strangers into one.
//
// Honest limit: the visitor id comes from the browser, so a determined
// person could send fresh ids and inflate their own count. This is a
// vanity metric for the landlord, not something anyone is billed on, so
// a per-IP ceiling is enough. The reply never says whether the view was
// counted, so nobody can probe the de-duplication window.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const id = String(data.id || '');
  if (!id) return Response.json({ ok: true });
  // Volume ceiling per address, so one client cannot flood the counter.
  if (!rateLimit(`view-ip:${clientIp(request)}`, 120, 60 * 60 * 1000)) {
    return Response.json({ ok: true });
  }
  const listing = await getListing(id);
  if (!listing || listing.status !== 'active') return Response.json({ ok: true });
  const me = await getSessionAccount(request);
  if (me && listing.owner && me.username === listing.owner) {
    return Response.json({ ok: true }); // your own visits are not traffic
  }
  const viewer = me?.username || String(data.visitor || '').slice(0, 64) || clientIp(request);
  // max 1 per window = a de-duplication window, not a limit.
  if (rateLimit(`view:${id}:${viewer}`, 1, 30 * 60 * 1000)) {
    await countListingView(id).catch(() => {});
  }
  return Response.json({ ok: true });
}
