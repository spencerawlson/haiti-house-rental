import { adminToken, sha256 } from '@/lib/admin-auth';

// Admin login: sets the admin cookie for 24h on a correct password.
// The password itself is never returned or stored.
export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const token = await adminToken();
  if (!token || !data.password || (await sha256(data.password)) !== token) {
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `kay_admin=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`,
    },
  });
}
