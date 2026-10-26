// Migration 0021 — suspension for cause, separate from billing.
//
// Billing suspension (activated=FALSE, billing_status) is about money:
// a landlord who has not paid cannot be listed. Fraud suspension is about
// trust: an account reported by tenants and reviewed by the admin. The
// two must never be confused — a fraud-suspended landlord still has an
// active subscription, and paying a bill must never lift a fraud
// suspension. So this adds its own columns on accounts, plus an outcome
// on reports: when the admin resolves a report, the reporter is told
// whether action was taken (never what sanction, never who else).
//
// fraud_reason is admin-written text shown to the suspended user as the
// category. It is NEVER the verbatim report text and NEVER names a
// reporter: in a small market, wording alone can identify one.
// History is kept on reactivation (only the boolean flips) so the audit
// log and the last reason stay readable.
//
// Reversible: down drops the added columns.
export const version = '0021';
export const name = 'fraud_suspension';

export async function up(db) {
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS fraud_suspended BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS fraud_suspended_at BIGINT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS fraud_reason TEXT NOT NULL DEFAULT ''`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS fraud_suspended_by TEXT`);
  await db.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS outcome TEXT`);
}

export async function down(db) {
  await db.query(`ALTER TABLE accounts DROP COLUMN IF EXISTS fraud_suspended`);
  await db.query(`ALTER TABLE accounts DROP COLUMN IF EXISTS fraud_suspended_at`);
  await db.query(`ALTER TABLE accounts DROP COLUMN IF EXISTS fraud_reason`);
  await db.query(`ALTER TABLE accounts DROP COLUMN IF EXISTS fraud_suspended_by`);
  await db.query(`ALTER TABLE reports DROP COLUMN IF EXISTS outcome`);
}
