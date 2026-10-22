import { checkAdminPassword, issueAdminToken, adminCookieHeader } from '@/lib/admin-auth';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';

// Admin login: a correct password gets a fresh signed admin token that
// expires after 12 hours. The password itself is never returned or stored.
export async function POST(request) {
  if (!rateLimit(`admin-login:${clientIp(request)}`, 10, 15 * 60 * 1000)) return tooMany();
  const data = await request.json().catch(() => ({}));
  if (!(await checkAdminPassword(data.password))) {
    await audit('anonymous', 'admin.login_failed', null, { ip: clientIp(request) });
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }
  await audit('admin', 'admin.login', null, { ip: clientIp(request) });
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': adminCookieHeader(await issueAdminToken()) } });
}
