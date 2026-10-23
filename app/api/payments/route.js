import { submitPayment, listPaymentsForUser } from '@/lib/payments-server';
import { getListing } from '@/lib/listings-server';
import { getSessionAccount, unauthorized } from '@/lib/session-server';
import { rateLimit, tooMany } from '@/lib/rate-limit';

// A landlord submits the phone number they made a MonCash/NatCash
// transfer from (subscription or advertising). The amount comes from
// lib/config.js, never from the request. GET lists the caller's own
// payments.
//
// `senderPhone` replaced the typed-in transaction id (0013). The old
// field name is still accepted so a page left open across the deploy
// does not fail silently on submit.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  return Response.json({ payments: await listPaymentsForUser(me.username) });
}

export async function POST(request) {
  const me = await getSessionAccount(request);
  if (!me) return unauthorized();
  if (!rateLimit(`payment:${me.username}`, 10, 60 * 60 * 1000)) return tooMany();
  const data = await request.json().catch(() => ({}));
  const listing = data.kind === 'advertising' && data.listingId ? await getListing(String(data.listingId)) : null;
  const result = await submitPayment({
    account: me,
    kind: data.kind,
    provider: data.provider,
    senderPhone: data.senderPhone ?? data.reference,
    listing,
    months: Number(data.months),
  });
  if (result.error) {
    const status = result.error === 'duplicate_reference' || result.error === 'already_pending' ? 409 : result.error === 'not_allowed' ? 403 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ payment: result.payment });
}
