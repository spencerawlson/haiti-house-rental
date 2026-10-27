// MonCash payment notifications — phase 1: intake only.
//
// MonCash calls POST /api/moncash/notify (the Return URL on the sandbox
// signup form) when a landlord pays. The notification is a TRIGGER, not
// proof: the payload fields and the signature / verification mechanism
// are still unknown until the sandbox docs arrive, so this module
// records every notification and holds it for admin review — it NEVER
// confirms a payment, activates an account, or starts advertising.
// Phase 2 adds server-to-server verification and, only on a verified
// match, confirms through the existing reviewPayment path (with
// MonCash's transaction ID as receiver_txn, so the one-transfer-pays-
// twice guard applies). Until then, the admin confirms from the board
// exactly as with a manual transfer.
//
// Matching: the notification's reference is compared against payments
// with provider 'moncash', ignoring spaces, dashes and case (the same
// normalisation as a hand-typed reference). A duplicate MonCash
// transaction ID is a no-op success — MonCash retries must never
// create a second record. A notification whose reference matches
// nothing is stored as 'unmatched' and never creates a payment.
import { randomBytes } from 'crypto';
import { query, getPool } from './db';
import { normalizeReference } from './payments-server';
import { log } from './log';

async function withTx(fn) {
  await query('SELECT 1');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn((text, params) => client.query(text, params));
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

function mapNotification(r) {
  return {
    id: r.id,
    reference: r.reference || '',
    paymentId: r.payment_id || null,
    moncashTxn: r.moncash_txn || null,
    amountHTG: r.amount_htg === null ? null : Number(r.amount_htg),
    amountMismatch: !!r.amount_mismatch,
    status: r.status,
    payload: r.payload || {},
    receivedAt: Number(r.received_at),
    reviewed: !!r.reviewed,
  };
}

export async function recordMonCashNotification({ reference, moncashTxn, amountHTG, payload }) {
  const refNorm = normalizeReference(reference);
  const txn = String(moncashTxn || '').trim().slice(0, 80) || null;
  const amount = Number.isInteger(amountHTG) ? amountHTG : null;
  return withTx(async (q) => {
    // Idempotency: a retried notification with the same MonCash
    // transaction ID records nothing twice.
    if (txn) {
      const { rows: dup } = await q(`SELECT id FROM moncash_notifications WHERE moncash_txn = $1`, [txn]);
      if (dup[0]) return { duplicate: true, notificationId: dup[0].id, payment: null, amountMismatch: false, status: 'duplicate' };
    }
    const { rows: pays } = await q(
      `SELECT id, status, amount_htg FROM payments
       WHERE provider = 'moncash'
         AND UPPER(regexp_replace(reference, '[^A-Za-z0-9]', '', 'g')) = $1
       ORDER BY submitted_at DESC LIMIT 1`,
      [refNorm],
    );
    const pay = pays[0] || null;
    const mismatch = !!(pay && amount !== null && amount !== Number(pay.amount_htg));
    const status = !pay ? 'unmatched' : pay.status === 'pending' ? 'held' : 'already_confirmed';
    const now = Date.now();
    const id = `mn-${randomBytes(10).toString('hex')}`;
    await q(
      `INSERT INTO moncash_notifications (id, reference, payment_id, moncash_txn, amount_htg, amount_mismatch, status, payload, received_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
      [id, reference ? String(reference).slice(0, 80) : '', pay?.id || null, txn, amount, mismatch, status, JSON.stringify(payload || {}), now],
    );
    // Audit trail on the payment itself, but only while it is actionable:
    // a confirmed or rejected payment is not touched by a notification.
    // The status itself is never flipped here — that waits for phase 2
    // verification (or the admin, as today).
    if (pay && pay.status === 'pending') {
      const event = JSON.stringify([{
        at: now, by: 'moncash', action: 'moncash_notify', verified: false,
        ...(txn ? { receiverTxn: txn } : {}),
        ...(amount !== null ? { amountHTG: amount } : {}),
      }]);
      await q(`UPDATE payments SET events = events || $1::jsonb WHERE id = $2`, [event, pay.id]);
    }
    // Never log the raw payload: it may carry payer details. The row
    // itself is admin-visible only.
    log('info', 'moncash_notify', { reference: refNorm, matched: !!pay, status });
    return {
      duplicate: false,
      notificationId: id,
      payment: pay ? { id: pay.id, status: pay.status, amountHTG: Number(pay.amount_htg) } : null,
      amountMismatch: mismatch,
      status,
    };
  });
}

export async function listMonCashNotifications(limit = 200) {
  const n = Math.min(Math.max(Number(limit) || 200, 1), 200);
  const { rows } = await query(`SELECT * FROM moncash_notifications ORDER BY received_at DESC LIMIT $1`, [n]);
  return rows.map(mapNotification);
}
