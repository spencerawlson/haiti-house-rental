// Migration 0008 — login history, for the Admin Board's account metrics.
//
// Why a new table instead of reading `sessions`: a session row is DELETED
// on sign-out and purged when it expires, so it can answer "who is signed
// in right now" and nothing else. Average session length, how often
// someone comes back, and when they were last here all need history that
// the sessions table deliberately does not keep.
//
// Keeping this separate also means session validation is untouched. An
// append-only analytics table cannot lock anybody out.
//
// One row per sign-in, tied to its session by token_hash so that signing
// out on one phone does not close the record of a session still open on
// another:
//   token_hash   the same hash the sessions table keys on
//   at           when they signed in
//   last_seen_at refreshed by the presence ping while a page is open, so
//                a session that was never signed out still has an end
//   ended_at     set on sign-out (or when a password reset revokes every
//                session). NULL = still open.
//
// Honest limit: this starts recording the day it ships. Accounts that
// signed in before then show no history, and the Admin Board says so
// rather than showing a confident zero.
//
// Reversible: down drops the table.
export const version = '0008';
export const name = 'login_events';

export async function up(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS login_events (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    token_hash TEXT,
    at BIGINT NOT NULL,
    last_seen_at BIGINT NOT NULL,
    ended_at BIGINT
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS login_events_user_idx ON login_events (username, at DESC)');
  // Finding the one open session to touch on a presence ping.
  await db.query('CREATE INDEX IF NOT EXISTS login_events_open_idx ON login_events (username, ended_at)');
  // Touching / closing exactly one session's event.
  await db.query('CREATE INDEX IF NOT EXISTS login_events_token_idx ON login_events (token_hash)');
}

export async function down(db) {
  await db.query('DROP TABLE IF EXISTS login_events');
}
