// Migration 0023 — MonCash notification intake table.
//
// MonCash's sandbox signup needs two URLs from Kay Ayiti: a Return URL
// (the payment-notification endpoint) and an Alert URL (the thank-you
// page). The endpoint itself cannot verify a notification yet — the
// payload fields and the signature / verification mechanism are still
// unknown until the sandbox docs arrive — so phase 1 is intake only:
// every notification is stored raw, matched against the pending payment
// with the same reference when one exists, and HELD for admin review.
// Nothing here confirms, activates, or moves money; that is phase 2,
// once verification exists. Storing the raw payload now means phase 2
// can re-verify notifications that arrived before it.
//
// Reversible: down drops the table.
export const version = '0023';
export const name = 'moncash_notifications';

export async function up(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS moncash_notifications (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL DEFAULT '',
    payment_id TEXT,
    moncash_txn TEXT,
    amount_htg INT,
    amount_mismatch BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'held',
    payload JSONB NOT NULL DEFAULT '{}',
    received_at BIGINT NOT NULL,
    reviewed BOOLEAN NOT NULL DEFAULT FALSE
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS moncash_notifications_reference_idx ON moncash_notifications (reference)`);
  await db.query(`CREATE INDEX IF NOT EXISTS moncash_notifications_txn_idx ON moncash_notifications (moncash_txn)`);
  await db.query(`CREATE INDEX IF NOT EXISTS moncash_notifications_received_idx ON moncash_notifications (received_at DESC)`);
}

export async function down(db) {
  await db.query(`DROP TABLE IF EXISTS moncash_notifications`);
}
