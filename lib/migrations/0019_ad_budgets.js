// Migration 0019 — advertising by view/click budget, not by month.
//
// The flat 75 HTG/month model is replaced: a landlord chooses an amount
// (100–1,000 HTG) and that amount buys a view budget plus a click budget,
// computed from an admin-set rate (views/clicks per 100 HTG) at the
// moment the admin confirms the payment. The budgets are never exposed
// to landlords — only the admin sees the numbers — and the ad stops
// showing the moment either budget is spent. Pausing is a landlord
// self-serve flag: a paused ad shows nothing and consumes nothing.
// Legacy month-based ads keep working: they carry advertised_until and
// no budgets, and the display rule below still honors the end date.
//
// Reversible: down drops the columns.
export const version = '0019';
export const name = 'ad_budgets';

export async function up(db) {
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS ad_amount_htg INT`);
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS ad_views_budget INT`);
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS ad_views_used INT NOT NULL DEFAULT 0`);
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS ad_clicks_budget INT`);
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS ad_clicks_used INT NOT NULL DEFAULT 0`);
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS ad_paused BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS ad_views_per_100 INT NOT NULL DEFAULT 1000`);
  await db.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS ad_clicks_per_100 INT NOT NULL DEFAULT 200`);
}

export async function down(db) {
  await db.query('ALTER TABLE listings DROP COLUMN IF EXISTS ad_amount_htg');
  await db.query('ALTER TABLE listings DROP COLUMN IF EXISTS ad_views_budget');
  await db.query('ALTER TABLE listings DROP COLUMN IF EXISTS ad_views_used');
  await db.query('ALTER TABLE listings DROP COLUMN IF EXISTS ad_clicks_budget');
  await db.query('ALTER TABLE listings DROP COLUMN IF EXISTS ad_clicks_used');
  await db.query('ALTER TABLE listings DROP COLUMN IF EXISTS ad_paused');
  await db.query('ALTER TABLE settings DROP COLUMN IF EXISTS ad_views_per_100');
  await db.query('ALTER TABLE settings DROP COLUMN IF EXISTS ad_clicks_per_100');
}
