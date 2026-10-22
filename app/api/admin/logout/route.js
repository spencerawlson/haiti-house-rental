import { adminCookieHeader } from '@/lib/admin-auth';

// Admin sign-out: drops the admin cookie on this device.
export async function POST() {
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': adminCookieHeader('', 0) } });
}
