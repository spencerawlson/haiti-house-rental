// Migration 0025 — idempotent chat sends.
//
// A message may carry an optional client_id: a random id the sender's
// device generates BEFORE the POST. On a flaky connection the device can
// resend a message whose first POST actually reached the server but whose
// reply was lost — without a dedup key that resend becomes a duplicate.
// With one, the second insert hits the unique index and is ignored, and the
// server returns the message the first send already created. This is the
// foundation the offline outbox (Phase 14c) replays against safely.
//
// The index is PARTIAL (WHERE client_id IS NOT NULL) so existing rows and
// any caller that sends no client_id are unaffected — only tagged messages
// are deduplicated, and only within their own (listing, tenant) thread.
//
// Reversible: down drops the index and the column.
export const version = '0025';
export const name = 'chat_client_id';

export async function up(db) {
  await db.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS client_id TEXT`);
  await db.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_client_id_uniq
     ON chat_messages (listing_id, tenant, client_id) WHERE client_id IS NOT NULL`,
  );
}

export async function down(db) {
  await db.query(`DROP INDEX IF EXISTS chat_messages_client_id_uniq`);
  await db.query(`ALTER TABLE chat_messages DROP COLUMN IF EXISTS client_id`);
}
