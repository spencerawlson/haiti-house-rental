import { checkAdminPassword, issueAdminToken, adminCookieHeader } from '@/lib/admin-auth';
import { verifyAdminUser } from '@/lib/admin-users-server';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';

// Admin login: a correct password gets a fresh signed admin token that
// expires after 12 hours. The password itself is never returned or stored.
//
// Two doors share this route. No username: the full admin, checked
// against ADMIN_PASSWORD as before. A username: a named admin_users
// account, whose token carries its scope (today only 'stats') — the
// response tells the page which scope signed in, so it lands on the
// right page.
export async function POST(request) {
  if (!rateLimit(`admin-login:${clientIp(request)}`, 10, 15 * 60 * 1000)) return tooMany();
  const data = await request.json().catch(() => ({}));
  const username = String(data.username || '').trim();
  if (username) {
    const user = await verifyAdminUser(username, data.password);
    if (!user || user.scope !== 'stats') {
      await audit(username, 'admin.login_failed', null, { ip: clientIp(request) });
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    await audit(username, 'admin.login', null, { ip: clientIp(request) });
    return Response.json({ ok: true, scope: 'stats' }, { headers: { 'Set-Cookie': adminCookieHeader(await issueAdminToken('stats')) } });
  }
  if (!(await checkAdminPassword(data.password))) {
    await audit('anonymous', 'admin.login_failed', null, { ip: clientIp(request) });
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }
  await audit('admin', 'admin.login', null, { ip: clientIp(request) });
  return Response.json({ ok: true, scope: 'full' }, { headers: { 'Set-Cookie': adminCookieHeader(await issueAdminToken()) } });
}
