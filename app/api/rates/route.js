// Live exchange rates for the admin converter (public rate data, no key).
// Fetched from open.er-api.com, cached 1 hour server-side (?fresh=1 skips
// the cache). On failure the route 502s and the admin UI says the rate is
// unavailable — no hardcoded rate is ever shown.
export const dynamic = 'force-dynamic';

let cache = null;

export async function GET(request) {
  const fresh = new URL(request.url).searchParams.get('fresh') === '1';
  if (!fresh && cache && Date.now() - cache.at < 3600_000) return Response.json(cache.data);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('rate fetch failed');
    const d = await res.json();
    const htgPerUsd = d?.rates?.HTG;
    const cadPerUsd = d?.rates?.CAD;
    if (typeof htgPerUsd !== 'number' || typeof cadPerUsd !== 'number') throw new Error('HTG rate missing');
    const data = {
      htgPerUsd,
      htgPerCad: htgPerUsd / cadPerUsd,
      updated: d.time_last_update_utc || null,
      source: 'open.er-api.com',
    };
    cache = { at: Date.now(), data };
    return Response.json(data);
  } catch {
    return Response.json({ error: 'rate unavailable' }, { status: 502 });
  }
}
