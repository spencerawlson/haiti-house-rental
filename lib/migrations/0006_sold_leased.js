// Migration 0006 — sold / leased listings.
//
// sold_at: when the landlord marked the home sold or leased. The status
// itself lives in the existing `status` column (now active | removed |
// sold | leased), so every path that already requires an active listing
// — search, detail, chat, visits, payments — treats a sold home as gone
// without a single extra check.
//
// sold_at is what the 48-hour auto-deletion counts from, and what the
// library's countdown is drawn from.
//
// Reversible: down puts any sold/leased listing back to 'removed' (the
// closest pre-0006 meaning — hidden but not deleted, so nothing is lost
// by rolling back) and drops the column.
export const version = '0006';
export const name = 'sold_leased';

export async function up(db) {
  await db.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS sold_at BIGINT');
  // The sweep looks for sold/leased rows by age.
  await db.query('CREATE INDEX IF NOT EXISTS listings_sold_idx ON listings (status, sold_at)');
}

export async function down(db) {
  await db.query('DROP INDEX IF EXISTS listings_sold_idx');
  await db.query(`UPDATE listings SET status = 'removed' WHERE status IN ('sold', 'leased')`);
  await db.query('ALTER TABLE listings DROP COLUMN IF EXISTS sold_at');
}
