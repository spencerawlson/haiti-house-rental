// Live exchange rates, shared by the /api/rates route and the search
// page (Stage 2, B2). One fetch, cached 1 hour in module memory, so a
// search never calls the provider per request and results never shift
// mid-search: the page reads one rate per render.
//
// Tiers, and what each caller does with them:
// - Fresh (cached < 1 h, or just refreshed): convert, no notice.
// - Stale (a previous value exists but the refresh failed): convert at
//   the last known rate AND show the stale notice. A slightly old rate
//   orders far better than raw numbers.
// - None (no value ever + refresh failed, e.g. cold start during an
//   outage): do NOT convert and do NOT raw-compare — price bounds and
//   price sorts are paused, with the unavailable notice. Raw comparison
//   is the bug being fixed, so it is never the fallback.
//
// The /api/rates route keeps its own established contract (fresh cache
// or a fresh fetch, else 502 — it never serves stale), so it uses
// getCachedRate + refreshRate directly, not getRateForSearch.
const TTL_MS = 3600_000;
let cache = null; // { at, data: { htgPerUsd, htgPerCad, updated, source } }

export function getCachedRate() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  return null;
}

export async function refreshRate() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: ctrl.signal });
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
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// Search tier: fresh data, or the last known value flagged stale, or
// null when no value has ever been fetched. Never throws.
export async function getRateForSearch() {
  const fresh = getCachedRate();
  if (fresh) return { ...fresh, stale: false };
  try {
    return { ...(await refreshRate()), stale: false };
  } catch {
    if (cache) return { ...cache.data, stale: true };
    return null;
  }
}
