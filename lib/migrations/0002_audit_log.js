// Migration 0002 — audit log (Phase 6): one row per admin or security
// relevant action (logins, activations, payment reviews, verification,
// takedowns, reset codes, report resolutions), so "who did what, when"
// is answerable later. Reversible: down drops only this table.
export const version = '0002';
export const name = 'audit_log';

export async function up(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    at BIGINT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    details JSONB NOT NULL DEFAULT '{}'
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS audit_log_at_idx ON audit_log (at DESC)');
}

export async function down(db) {
  await db.query('DROP TABLE IF EXISTS audit_log');
}
