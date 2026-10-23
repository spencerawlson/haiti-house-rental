// Migration 0010 — landlord fees become a quarterly subscription.
//
// Before this an account was activated once and stayed activated. Now it
// has a lifecycle: pending -> active -> suspended -> deactivated, with
// paid_until marking the end of the paid quarter.
//
//   billing_status  pending | active | suspended | deactivated
//   paid_until      end of the paid quarter. NULL means "does not
//                   expire" — tenants (free) and partner accounts.
//   suspended_at    when suspension started, which is what the 30-day
//                   countdown to deactivation is measured from.
//
// `activated` stays the single gate for "may post", kept in step with
// billing_status by lib/billing-server.js. That is deliberate: every
// existing check (upload, posting, the account page) already reads
// `activated`, so suspension enforces itself through code that is
// already tested rather than through a second rule nobody remembers.
//
// GRANDFATHERING: landlords who already paid the old one-time 1000 HTG
// are set active with a FULL quarter from this migration, not from their
// original activation date. Charging them the moment this ships would be
// taking money for time they already paid for.
//
// Reversible: down drops the three columns. `activated` is left as it is,
// so rolling back leaves every account exactly as usable as it was.
import { QUARTER_MONTHS } from '../config';

export const version = '0010';
export const name = 'quarterly_billing';

export async function up(db) {
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'pending'`);
  await db.query('ALTER TABLE accounts ADD COLUMN IF NOT EXISTS paid_until BIGINT');
  await db.query('ALTER TABLE accounts ADD COLUMN IF NOT EXISTS suspended_at BIGINT');
  // The sweep looks for accounts whose quarter has run out.
  await db.query('CREATE INDEX IF NOT EXISTS accounts_billing_idx ON accounts (billing_status, paid_until)');

  const grace = new Date();
  grace.setUTCMonth(grace.getUTCMonth() + QUARTER_MONTHS);
  const until = grace.getTime();

  // Free for ever: tenants, and partner accounts the admin created.
  await db.query(
    `UPDATE accounts SET billing_status = 'active', paid_until = NULL
     WHERE billing_status = 'pending' AND (role = 'tenant' OR partner = TRUE)`,
  );
  // Already-paying landlords: active, with a full quarter from today.
  await db.query(
    `UPDATE accounts SET billing_status = 'active', paid_until = $1
     WHERE billing_status = 'pending' AND role = 'landlord' AND partner = FALSE AND activated = TRUE`,
    [until],
  );
  // Landlords who never paid stay 'pending' and owe the joining fee.
}

export async function down(db) {
  await db.query('DROP INDEX IF EXISTS accounts_billing_idx');
  await db.query('ALTER TABLE accounts DROP COLUMN IF EXISTS suspended_at');
  await db.query('ALTER TABLE accounts DROP COLUMN IF EXISTS paid_until');
  await db.query('ALTER TABLE accounts DROP COLUMN IF EXISTS billing_status');
}
