// Migration 0028 — external advertisers + picture-ad campaigns.
//
// Kay Ayiti's only revenue is now advertising by outside businesses
// (not listing owners): an advertiser account posts a picture ad (a
// campaign), pays 100–1,000 HTG by MonCash/NatCash, and the admin's
// confirmation turns the payment into view/click budgets (the same rate
// math as listing ads, 0019) and flips the campaign to 'active'.
//
// - ad_campaigns: one row per picture ad. amount_htg is what the
//   advertiser paid; the budgets are set at confirmation time, the
//   counters reset to 0, and the campaign shows only while it has
//   budget left and is not paused (see lib/advertisers-server.js).
// - payments.campaign_id: which campaign an advertising payment is
//   for. Nullable, no FK — consistent with payments.listing_id, which
//   has no FK either (0001 baseline).
//
// Reversible: down drops the table and the column.
export const version = '0028';
export const name = 'advertisers';

export async function up(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS ad_campaigns (
    id TEXT PRIMARY KEY,
    advertiser_username TEXT NOT NULL REFERENCES accounts(username),
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    link_url TEXT NOT NULL,
    amount_htg INT NOT NULL,
    ad_views_budget INT,
    ad_views_used INT NOT NULL DEFAULT 0,
    ad_clicks_budget INT,
    ad_clicks_used INT NOT NULL DEFAULT 0,
    ad_paused BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at BIGINT NOT NULL
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS ad_campaigns_advertiser_idx ON ad_campaigns (advertiser_username)`);
  await db.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS campaign_id TEXT`);
}

export async function down(db) {
  await db.query(`DROP TABLE IF EXISTS ad_campaigns`);
  await db.query(`ALTER TABLE payments DROP COLUMN IF EXISTS campaign_id`);
}
