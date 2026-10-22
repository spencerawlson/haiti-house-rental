import { setAccountLocale } from '@/lib/accounts-server';
import { getSessionAccount, unauthorized } from '@/lib/session-server';

// The signed-in user picked a language in Account: notifications (SMS,
// email) follow it.
export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  const { locale } = await request.json().catch(() => ({}));
  await setAccountLocale(me.username, locale);
  return Response.json({ ok: true });
}
