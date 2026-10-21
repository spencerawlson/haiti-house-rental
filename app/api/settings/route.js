import { getSettings } from '@/lib/settings-server';

// Live data: never serve a build-time snapshot of the numbers.
export const dynamic = 'force-dynamic';

// Public: signup and account screens need the destination numbers to show
// users where to send the registration fee.
export async function GET() {
  return Response.json(await getSettings());
}
