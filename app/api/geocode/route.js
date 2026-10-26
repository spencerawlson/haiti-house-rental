// Forward-geocode a typed address into map coordinates via OpenStreetMap
// Nominatim (free, no key), proxied through the server so browsers
// behind restrictive proxies still get a result. The posting form calls
// this when the landlord taps "find on the map": the pin moves to the
// address, which matters for landlords living abroad — "use my location"
// would pin their home abroad, not the property. Haitian addresses are
// often informal, so a miss is an ordinary empty result, not an error:
// the form then says so and the manual pin stays available.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = (searchParams.get('address') || '').trim();
  if (!address) return Response.json({ error: 'address required' }, { status: 400 });
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address + ', Haiti')}`,
      { headers: { 'User-Agent': 'KayAyiti/1.0' }, signal: AbortSignal.timeout(5000) },
    );
    const data = await res.json();
    if (data[0]) {
      return Response.json({ lat: Number(data[0].lat), lng: Number(data[0].lon), display: data[0].display_name || '' });
    }
  } catch {
    // fall through — no coordinates
  }
  return Response.json({ lat: null, lng: null, display: '' });
}
