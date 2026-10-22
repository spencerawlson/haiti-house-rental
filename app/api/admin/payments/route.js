import { listPayments, reviewPayment, paymentSummary } from '@/lib/payments-server';

// Admin payment review (gated by the middleware). GET: payments (default
// pending) + confirmed/pending totals. POST: confirm or reject one
// pending payment — confirming activates the account or starts/extends
// the advertising period; it can only ever happen once per payment.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const status = new URL(request.url).searchParams.get('status') || 'pending';
  return Response.json({
    payments: await listPayments(status === 'all' ? null : status),
    summary: await paymentSummary(),
  });
}

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const result = await reviewPayment(String(data.id || ''), data.decision, data.note);
  if (result.error) return Response.json({ error: result.error }, { status: result.error === 'not_pending' ? 409 : 400 });
  return Response.json({ payment: result.payment });
}
