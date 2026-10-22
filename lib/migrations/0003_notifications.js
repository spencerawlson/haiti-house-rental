// Migration 0003 — notifications: an in-app inbox per user, plus each
// account's language so SMS/email go out in Kreyol, French or English.
// Reversible: down drops the table and the column.
export const version = '0003';
export const name = 'notifications';

export async function up(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    kind TEXT NOT NULL,
    params JSONB NOT NULL DEFAULT '{}',
    link TEXT,
    created_at BIGINT NOT NULL,
    read_at BIGINT
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (username, created_at DESC)');
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'ht'`);
}

export async function down(db) {
  await db.query('DROP TABLE IF EXISTS notifications');
  await db.query('ALTER TABLE accounts DROP COLUMN IF EXISTS locale');
}
