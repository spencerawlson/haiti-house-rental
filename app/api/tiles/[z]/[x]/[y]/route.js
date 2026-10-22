// Tile proxy: the app server fetches OpenStreetMap tiles and serves them
// from the app's own origin. Why: browsers behind restrictive proxies (and
// this sandbox) can't always reach tile.openstreetmap.org directly, while
// the server can. Tiles are cached by the browser for a day.
// Honest limit: OSM's free tile service is for light use. For real traffic,
// swap TILE_URL for a tile provider with a key (MapTiler, Stadia) — one line.
const TILE_URL = 'https://tile.openstreetmap.org';

export async function GET(_request, props) {
  const params = await props.params;
  const { z, x, y } = params;
  if (!/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
    return new Response('Bad tile', { status: 400 });
  }
  const res = await fetch(`${TILE_URL}/${z}/${x}/${y}.png`, {
    headers: { 'User-Agent': 'KayAyiti/1.0 (contact: Kay Ayiti)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return new Response('Tile unavailable', { status: res.status });
  const buf = await res.arrayBuffer();
  return new Response(buf, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
