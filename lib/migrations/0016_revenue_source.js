// Migration 0016 — where each revenue_entries row came from.
//
// Revenue is now the sum of every CONFIRMED payment at its real amount
// (join 1500, quarter 1000, reactivation 1500, advertising 75/month). The
// old revenue_entries roster wrote a flat 1000 per landlord, once, so it
// under-counted (no renewals, no advertising, 1000 instead of 1500) — and
// paymentSummary() ALSO added it on top of 'join' payments, over-counting.
//
// revenue_entries stays, but only its MANUAL rows still count as money:
// landlords the admin activated by hand, outside the payments ledger (the
// old one-time 1000 HTG). Rows written because a payment was confirmed are
// already counted from that payment.
//
//   source  'payment' — written when a payment was confirmed (or one that
//                       was later deleted: a deleted test payment must not
//                       turn into phantom "manual" revenue)
//           'manual'  — admin activation without a payment
//
// Reversible: down drops the column.
export const version = '0016';
export const name = 'revenue_source';

export async function up(db) {
  await db.query(`ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'`);
  await db.query(`UPDATE revenue_entries r SET source = 'payment'
    WHERE EXISTS (SELECT 1 FROM payments p WHERE p.username = r.username AND p.kind IN ('activation', 'join') AND p.status = 'confirmed')
       OR EXISTS (SELECT 1 FROM payment_deletions d WHERE d.username = r.username AND d.kind IN ('activation', 'join') AND d.status = 'confirmed')`);
}

export async function down(db) {
  await db.query('ALTER TABLE revenue_entries DROP COLUMN IF EXISTS source');
}
