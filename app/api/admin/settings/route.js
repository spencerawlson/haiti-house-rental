import { setSettings } from '@/lib/settings-server';
import { audit } from '@/lib/audit';

// Admin Board sets the MonCash (Digicel) and NatCash (Natcom) destination
// numbers that landlords pay to. Gated by the middleware like every
// /api/admin/* route; every change is audited, since a wrong number
// would send landlords' money to the wrong place.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const saved = await setSettings(data);
  await audit('admin', 'settings.payment_numbers', null, { moncashNumber: saved.moncashNumber, natcashNumber: saved.natcashNumber });
  return Response.json(saved);
}
