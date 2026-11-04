// Migration 0026 — furniture sellers + structured Shop.
//
// - listings.kind: 'home' for houses (the only kind that existed), now
//   explicit; 'furniture' for Shop items posted by seller accounts.
//   Existing rows backfill to 'home', so house search, the map and the
//   landing strip never pick up a furniture item by accident.
// - listings.shop_section / shop_category: the Shop's structure (see
//   lib/shop.js). NULL for houses. One section per item, enforced
//   server-side at posting time, not by the column alone.
//
// No promo schema change: promo pools are counted per role in
// lib/promo-server.js (promo_tagged AND role), so the landlord and
// seller pools stay separate without a new column.
//
// Reversible: down drops the three columns.
export const version = '0026';
export const name = 'seller_shop';

export async function up(db) {
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'home'`);
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS shop_section TEXT`);
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS shop_category TEXT`);
  await db.query(`UPDATE listings SET kind = 'home' WHERE kind IS NULL OR kind = ''`);
  await db.query(`CREATE INDEX IF NOT EXISTS listings_kind_idx ON listings (kind)`);
}

export async function down(db) {
  await db.query(`DROP INDEX IF EXISTS listings_kind_idx`);
  await db.query(`ALTER TABLE listings DROP COLUMN IF EXISTS shop_category`);
  await db.query(`ALTER TABLE listings DROP COLUMN IF EXISTS shop_section`);
  await db.query(`ALTER TABLE listings DROP COLUMN IF EXISTS kind`);
}
