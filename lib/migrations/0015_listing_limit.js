// Migration 0015 — a per-account limit on live listings, set by the admin.
//
// Partner accounts may post homes for other people from their own
// account (and charge them for it), so the admin needs to cap how many
// homes each one can have live. Any landlord account can carry a limit.
//
//   listing_limit  NULL = no limit (every existing account: nothing
//                  changes until the admin sets a number). Otherwise the
//                  most homes this account may have LIVE (status
//                  'active') at once. Taken-down and sold/leased homes do
//                  not count, so taking one down frees a slot.
//
// Lowering a limit below what an account already has removes nothing; it
// only blocks new posts and restores until they are back under it.
// Enforced in lib/listings-server.js under a per-account lock.
//
// Reversible: down drops the column.
export const version = '0015';
export const name = 'listing_limit';

export async function up(db) {
  await db.query('ALTER TABLE accounts ADD COLUMN IF NOT EXISTS listing_limit INT');
  await db.query(`ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_listing_limit_nonneg`);
  await db.query(`ALTER TABLE accounts ADD CONSTRAINT accounts_listing_limit_nonneg CHECK (listing_limit IS NULL OR listing_limit >= 0)`);
}

export async function down(db) {
  await db.query('ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_listing_limit_nonneg');
  await db.query('ALTER TABLE accounts DROP COLUMN IF EXISTS listing_limit');
}
