import { getSettings, setSettings } from '@/lib/settings-server';
import { audit } from '@/lib/audit';

// Admin Board sets the MonCash (Digicel) and NatCash (Natcom) destination
// numbers that landlords pay to, plus the advertising rate (views and
// clicks per 100 HTG). Gated by the middleware like every /api/admin/*
// route; every change is audited, since a wrong number would send
// landlords' money to the wrong place, and a wrong rate would rewrite
// every future ad budget.
export async function GET() {
  return Response.json(await getSettings());
}

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const saved = await setSettings(data);
  await audit('admin', 'settings.payment_numbers', null, { moncashNumber: saved.moncashNumber, natcashNumber: saved.natcashNumber, adViewsPer100: saved.adViewsPer100, adClicksPer100: saved.adClicksPer100 });
  return Response.json(saved);
}
