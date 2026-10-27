import { recordMonCashNotification } from '@/lib/moncash-server';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';

// MonCash payment notifications — the Return URL on the sandbox signup
// form (https://kayayiti.app/api/moncash/notify). Public: MonCash calls
// it server-to-server, with no user session.
//
// Phase 1 is intake only (see lib/moncash-server.js): the notification
// is stored, matched against a pending payment by reference when one
// exists, and HELD for admin review. It never confirms anything —
// MonCash's verification mechanism is still unknown until the sandbox
// docs arrive, and an unverified notification must never move money.
//
// Field names are MonCash's to confirm: the reference, transaction ID
// and amount are read from the most likely field names, and the whole
// payload is stored raw, so a notification whose fields are named
// differently is still kept (as 'unmatched') instead of lost. A
// well-formed JSON object always gets a 200: MonCash retries on
// errors, and a retry storm helps nobody. Only malformed JSON,
// oversize bodies and floods are refused.
export const dynamic = 'force-dynamic';

const MAX_BODY = 65536;
const REF_FIELDS = ['reference', 'orderReference', 'order_reference', 'orderId', 'order_id'];
const TXN_FIELDS = ['transactionId', 'transaction_id', 'txnId', 'txn_id'];
const AMOUNT_FIELDS = ['amount', 'amountHTG', 'amount_htg', 'transactionAmount'];

function firstString(body, fields) {
  for (const f of fields) {
    const v = body[f];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function firstAmount(body, fields) {
  for (const f of fields) {
    const v = body[f];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  }
  return null;
}

export async function POST(request) {
  if (!rateLimit(`moncash-notify:${clientIp(request)}`, 60, 60 * 1000)) return tooMany();
  const text = await request.text().catch(() => '');
  if (text.length > MAX_BODY) return Response.json({ error: 'payload_too_large' }, { status: 413 });
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const result = await recordMonCashNotification({
    reference: firstString(body, REF_FIELDS),
    moncashTxn: firstString(body, TXN_FIELDS),
    amountHTG: firstAmount(body, AMOUNT_FIELDS),
    payload: body,
  });
  return Response.json({
    received: true,
    matched: !!result.payment,
    status: result.status,
    duplicate: result.duplicate,
    amountMismatch: result.amountMismatch,
  });
}
