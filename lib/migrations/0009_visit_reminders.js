// Migration 0009 — visit reminders.
//
// Both sides of a confirmed visit get three nudges: two days before, one
// day before, and on the morning of the visit. This table is the record
// of what has already gone out, and it is what makes the job safe to run
// again: the PRIMARY KEY (visit_id, kind) turns "has this reminder been
// sent?" into an INSERT ... ON CONFLICT DO NOTHING, so two overlapping
// cron runs cannot send the same reminder twice. Nobody wants a duplicate
// SMS, and on a Haitian phone plan it also costs money.
//
// One row covers BOTH recipients: the landlord and the tenant are told in
// the same pass, under one claim.
//
// Rescheduling a visit deletes its rows (see updateVisit), so the new
// date gets a fresh set of reminders.
//
// Reversible: down drops the table.
export const version = '0009';
export const name = 'visit_reminders';

export async function up(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS visit_reminders (
    visit_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    sent_at BIGINT NOT NULL,
    PRIMARY KEY (visit_id, kind)
  )`);
  // The job scans confirmed visits by date.
  await db.query('CREATE INDEX IF NOT EXISTS visits_status_date_idx ON visits (status, date)');
}

export async function down(db) {
  await db.query('DROP INDEX IF EXISTS visits_status_date_idx');
  await db.query('DROP TABLE IF EXISTS visit_reminders');
}
