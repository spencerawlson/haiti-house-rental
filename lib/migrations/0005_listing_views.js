// Migration 0005 — listing views.
//
// views: how many people opened a listing's detail page. The landlord
// sees it in their library; it is never shown publicly (a home showing
// "2 views" would only discourage its owner, and the traffic on other
// people's homes is nobody else's business).
//
// Reversible: down drops the column.
export const version = '0005';
export const name = 'listing_views';

export async function up(db) {
  await db.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS views INT NOT NULL DEFAULT 0');
}

export async function down(db) {
  await db.query('ALTER TABLE listings DROP COLUMN IF EXISTS views');
}
