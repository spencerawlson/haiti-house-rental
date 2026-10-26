// Live exchange rates for the admin converter (public rate data, no key).
// Fetched from open.er-api.com, cached 1 hour server-side (?fresh=1 skips
// the cache). On failure the route 502s and the admin UI says the rate is
// unavailable — no hardcoded rate is ever shown. The fetch + cache live
// in lib/rates-server.js, shared with the search page (Stage 2, B2);
// this route keeps its fresh-or-502 contract and never serves stale.
import { getCachedRate, refreshRate } from '@/lib/rates-server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const fresh = new URL(request.url).searchParams.get('fresh') === '1';
  if (!fresh) {
    const cached = getCachedRate();
    if (cached) return Response.json(cached);
  }
  try {
    return Response.json(await refreshRate());
  } catch {
    return Response.json({ error: 'rate unavailable' }, { status: 502 });
  }
}
