// Migration 0022 — promo (400 free landlord spots) + admin chat threads.
//
// Promo (Oct 2026, Spencer): the first 400 landlord accounts post free
// for one year — no join fee, no quarterly fee while the year runs —
// then normal billing applies. Tagging is retroactive: existing
// landlords count, earliest created first, and new landlords fill the
// remaining spots (that half lives in createServerAccount, not here).
//
// A promo landlord is just an active landlord whose paid_until IS the
// promo end: the sweep, the due-kind answer and the posting gate all
// read paid_until, so nothing else needs a promo branch to treat the
// year as paid up. The one place that does need a branch is the due
// reminder (lib/billing-server.js): it must not warn about a quarter
// while the promo year still runs.
//
// Fraud suspension is untouched by promo: a fraud-suspended landlord is
// still tagged (it holds a spot — it is a landlord account) but its
// billing fields are left exactly as they are, so tagging can never
// lift a suspension.
//
// The tag step is a single statement, and it only runs while nothing
// is tagged yet: if the migration ever ran twice, the second run is a
// no-op instead of tagging the NEXT 400 landlords.
//
// Admin chat threads are separate from listing threads on purpose:
// they are not about a home, so they cannot ride conversations or
// chat_messages (both keyed by listing). Read marking rides two
// columns on the thread so each side gets its own unread count.
//
// Reversible: down drops the added columns and tables.
export const version = '0022';
export const name = 'promo_admin_chat';

const PROMO_YEAR_MS = 365 * 86400000;

export async function up(db) {
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS promo_tagged BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS promo_until BIGINT`);
  await db.query(`CREATE TABLE IF NOT EXISTS admin_threads (
    username TEXT PRIMARY KEY,
    created_at BIGINT NOT NULL,
    last_message_at BIGINT,
    user_last_read_at BIGINT,
    admin_last_read_at BIGINT
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS admin_messages (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS admin_messages_username_idx ON admin_messages (username, created_at)`);
  const until = Date.now() + PROMO_YEAR_MS;
  await db.query(
    `UPDATE accounts
     SET promo_tagged = TRUE,
         promo_until = $1,
         billing_status = CASE WHEN fraud_suspended THEN billing_status ELSE 'active' END,
         activated = CASE WHEN fraud_suspended THEN activated ELSE TRUE END,
         paid_until = CASE WHEN fraud_suspended THEN paid_until ELSE GREATEST(COALESCE(paid_until, 0), $1) END
     WHERE id IN (
       SELECT id FROM accounts
       WHERE role = 'landlord' AND partner = FALSE
       ORDER BY created_at ASC, id ASC LIMIT 400
     )
     AND (SELECT COUNT(*) FROM accounts WHERE promo_tagged) = 0`,
    [until],
  );
}

export async function down(db) {
  await db.query(`DROP TABLE IF EXISTS admin_messages`);
  await db.query(`DROP TABLE IF EXISTS admin_threads`);
  await db.query(`ALTER TABLE accounts DROP COLUMN IF EXISTS promo_tagged`);
  await db.query(`ALTER TABLE accounts DROP COLUMN IF EXISTS promo_until`);
}
