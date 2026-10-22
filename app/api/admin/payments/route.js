import { listPayments, reviewPayment, paymentSummary } from '@/lib/payments-server';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify-server';

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
  await audit('admin', `payment.${result.payment.status}`, result.payment.id, { kind: result.payment.kind, amountHTG: result.payment.amountHTG, username: result.payment.username, reference: result.payment.reference });
  const p = result.payment;
  notify(p.username, p.status === 'confirmed' ? 'payment_confirmed' : 'payment_rejected', { amount: p.amountHTG.toLocaleString(), reference: p.reference, note: p.note || '' }, { link: '/ht/payments' });
  return Response.json({ payment: result.payment });
}
