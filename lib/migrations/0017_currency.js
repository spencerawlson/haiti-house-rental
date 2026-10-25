// Migration 0017 — listings priced in HTG or USD.
//
// The price column was HTG-only (price_htg). Landlords now choose the
// currency when posting, so the column becomes price (the amount in the
// listing's currency) and currency records which one. Every existing row
// is HTG, so the default keeps them exact.
//
// Reversible: down drops currency and renames price back to price_htg.
export const version = '0017';
export const name = 'currency';

export async function up(db) {
  await db.query('ALTER TABLE listings RENAME COLUMN price_htg TO price');
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'HTG'`);
  await db.query(`ALTER TABLE listings ADD CONSTRAINT listings_currency_check CHECK (currency IN ('HTG', 'USD'))`);
}

export async function down(db) {
  await db.query('ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_currency_check');
  await db.query('ALTER TABLE listings DROP COLUMN IF EXISTS currency');
  await db.query('ALTER TABLE listings RENAME COLUMN price TO price_htg');
}
