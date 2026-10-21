import { setSettings } from '@/lib/settings-server';

// Admin Board sets the MonCash (Digicel) and NatCash (Natcom) destination
// numbers for the registration fee.
// v0: no auth on this route — gate the admin area before launch.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  return Response.json(setSettings(data));
}
