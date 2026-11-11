import { submitPayment, listPaymentsForUser } from '@/lib/payments-server';
import { getListing } from '@/lib/listings-server';
import { getCampaign } from '@/lib/advertisers-server';
import { getSessionAccount, unauthorized } from '@/lib/session-server';
import { rateLimit, tooMany } from '@/lib/rate-limit';

// A payer submits the phone number they made a MonCash/NatCash
// transfer from (advertising). Billing amounts are gone — Kay Ayiti
// is free for everyone, forever. An advertising amount is chosen by
// the payer (100–1,000 HTG) and validated server-side. GET lists the
// caller's own payments.
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
  // A picture-ad campaign (0028) pays the same way a listing ad does:
  // the campaign id comes from the advertiser dashboard. A campaign
  // payment never carries a listing id.
  const campaign = data.kind === 'advertising' && data.campaignId ? await getCampaign(String(data.campaignId)) : null;
  const listing = data.kind === 'advertising' && data.listingId && !campaign ? await getListing(String(data.listingId)) : null;
  const result = await submitPayment({
    account: me,
    kind: data.kind,
    provider: data.provider,
    senderPhone: data.senderPhone ?? data.reference,
    listing,
    campaign,
    amountHTG: data.amountHTG,
  });
  if (result.error) {
    const status = result.error === 'duplicate_reference' || result.error === 'already_pending' ? 409 : result.error === 'not_allowed' ? 403 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ payment: result.payment });
}
