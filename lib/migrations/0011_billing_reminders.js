// Migration 0011 — "your payment is due soon" reminders.
//
// Before this, a landlord's first warning was the suspension notice —
// which arrives when their homes have already left the site. Now they get
// a heads-up a week before the quarter ends.
//
// Same claim pattern as visit_reminders (0009): the PRIMARY KEY turns
// "has this already gone out?" into an INSERT ... ON CONFLICT DO NOTHING,
// so the job can run every five minutes without sending a reminder every
// five minutes.
//
// The key includes period_end (the paid_until being warned about), so
// renewing earns a fresh reminder for the NEW period while never
// re-sending for the old one. `kind` is here so a second warning (say,
// before deactivation) needs no migration.
//
// Reversible: down drops the table.
export const version = '0011';
export const name = 'billing_reminders';

export async function up(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS billing_reminders (
    username TEXT NOT NULL,
    period_end BIGINT NOT NULL,
    kind TEXT NOT NULL,
    sent_at BIGINT NOT NULL,
    PRIMARY KEY (username, period_end, kind)
  )`);
}

export async function down(db) {
  await db.query('DROP TABLE IF EXISTS billing_reminders');
}
