import { listPayments, reviewPayment, paymentSummary, deletePayment, listPaymentDeletions } from '@/lib/payments-server';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify-server';

// Admin payment review (gated by the middleware). GET: payments (default
// pending) + confirmed/pending totals, and the permanent record of
// deleted transactions. POST: confirm or reject one pending payment —
// confirming activates the account or starts/extends the advertising
// period; it can only ever happen once per payment. DELETE: remove a
// transaction, which requires a reason and is recorded forever.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const status = new URL(request.url).searchParams.get('status') || 'pending';
  return Response.json({
    payments: await listPayments(status === 'all' ? null : status),
    summary: await paymentSummary(),
    deletions: await listPaymentDeletions(),
  });
}

// Deleting a transaction. The reason is required: no reason, no deletion,
// and the 400 says which. The record is written before the row goes, so a
// failure here leaves the payment in place rather than losing it quietly.
export async function DELETE(request) {
  const data = await request.json().catch(() => ({}));
  const result = await deletePayment(String(data.id || ''), {
    reason: data.reason,
    deletedBy: 'admin',
  });
  if (result.error) {
    const status = result.error === 'not_found' ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }
  const p = result.deleted;
  // Also in the audit log the board already shows, so a deletion turns up
  // in the place an admin looks for "what happened recently".
  await audit('admin', 'payment.deleted', p.id, {
    kind: p.kind,
    amountHTG: p.amountHTG,
    username: p.username,
    status: p.status,
    reason: result.reason,
  });
  return Response.json({ deleted: p, reason: result.reason });
}

export async function POST(request) {
  const data = await request.json().catch(() => ({}));
  const result = await reviewPayment(String(data.id || ''), data.decision, data.note);
  if (result.error) return Response.json({ error: result.error }, { status: result.error === 'not_pending' ? 409 : 400 });
  await audit('admin', `payment.${result.payment.status}`, result.payment.id, { kind: result.payment.kind, amountHTG: result.payment.amountHTG, username: result.payment.username, reference: result.payment.reference });
  const p = result.payment;
  // The notice names the phone the transfer came from, which is what the
  // payer recognises — `reference` is now a server-generated id.
  notify(p.username, p.status === 'confirmed' ? 'payment_confirmed' : 'payment_rejected', { amount: p.amountHTG.toLocaleString(), reference: p.senderPhone || p.reference, note: p.note || '' }, { link: '/ht/payments' });
  return Response.json({ payment: result.payment });
}
