// Migration 0014 — the RECEIVER's transaction ID, typed by the admin.
//
// Why: landlords now give the phone they paid from (0013), because the
// transaction ID MonCash shows the SENDER is different from the one the
// RECEIVER sees, so a landlord-supplied ID could never be matched. But
// with only a phone + amount, nothing stopped one real transfer from
// being confirmed twice (last quarter's transfer claimed again this
// quarter). The admin's own statement shows a receiver-side ID for every
// transfer; recording it at confirmation, and refusing one already used,
// brings that protection back without asking the landlord for anything.
//
//   receiver_txn       the ID as the admin typed it (shown back to them)
//   receiver_txn_norm  upper-case, letters and digits only — what is
//                      compared, so "mc-12 34" and "MC1234" are the same
//
// The uniqueness is a partial UNIQUE INDEX on CONFIRMED payments of the
// same provider, not an application check: two admins confirming at the
// same moment cannot both win. A rejected or pending payment reserves
// nothing. Confirming WITHOUT an ID stays possible (MonCash statements are
// not always consistent) — those rows have receiver_txn NULL and the Admin
// Board lists them as flagged.
//
// Reversible: down drops the index and the two columns.
export const version = '0014';
export const name = 'receiver_txn';

export async function up(db) {
  await db.query('ALTER TABLE payments ADD COLUMN IF NOT EXISTS receiver_txn TEXT');
  await db.query('ALTER TABLE payments ADD COLUMN IF NOT EXISTS receiver_txn_norm TEXT');
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS payments_receiver_txn_unique
    ON payments (provider, receiver_txn_norm)
    WHERE status = 'confirmed' AND receiver_txn_norm IS NOT NULL`);
}

export async function down(db) {
  await db.query('DROP INDEX IF EXISTS payments_receiver_txn_unique');
  await db.query('ALTER TABLE payments DROP COLUMN IF EXISTS receiver_txn_norm');
  await db.query('ALTER TABLE payments DROP COLUMN IF EXISTS receiver_txn');
}
