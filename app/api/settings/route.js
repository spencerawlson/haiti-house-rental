import { getSettings } from '@/lib/settings-server';

// Live data: never serve a build-time snapshot of the numbers.
export const dynamic = 'force-dynamic';

// Public: signup and account screens need the destination numbers to show
// users where to send the registration fee. The advertising rate is
// deliberately NOT in this response — it would reveal the hidden ad
// budgets to landlords; the admin reads it from /api/admin/settings.
export async function GET() {
  const s = await getSettings();
  return Response.json({ moncashNumber: s.moncashNumber, natcashNumber: s.natcashNumber });
}
