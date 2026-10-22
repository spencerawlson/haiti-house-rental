// Migration 0004 — profile photo: one optional avatar URL per account.
// The column holds an /uploads/<name> path written by
// app/api/accounts/avatar/route.js, never an external URL, so a profile
// photo can never point at a third-party tracker.
// Reversible: down drops the column (the files stay on disk).
export const version = '0004';
export const name = 'profile_photo';

export async function up(db) {
  await db.query('ALTER TABLE accounts ADD COLUMN IF NOT EXISTS avatar_url TEXT');
}

export async function down(db) {
  await db.query('ALTER TABLE accounts DROP COLUMN IF EXISTS avatar_url');
}
