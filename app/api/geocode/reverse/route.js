// Reverse-geocode a phone position into a commune + department via
// OpenStreetMap Nominatim (free, no key), proxied through the server so
// browsers behind restrictive proxies still get a result.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  if (!lat || !lng) return Response.json({ error: 'lat/lng required' }, { status: 400 });
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
      { headers: { 'User-Agent': 'KayAyiti/1.0' }, signal: AbortSignal.timeout(5000) },
    );
    const data = await res.json();
    const addr = data.address || {};
    const commune = addr.city || addr.town || addr.village || addr.municipality || '';
    const department = addr.state || '';
    return Response.json({ commune, department, display: data.display_name || '' });
  } catch {
    return Response.json({ commune: '', department: '', display: '' });
  }
}
