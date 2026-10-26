// Migration 0020 — named admin accounts with a scope.
//
// Until now there was exactly one admin: whoever knew ADMIN_PASSWORD.
// A partner (a broker who should see numbers, not money or people) needs
// a login of their own that cannot reach anything else. admin_users holds
// those accounts: a username, a scrypt hash (same scheme as accounts),
// and a scope — today only 'stats' exists. The full admin is NOT a row
// here; it stays the ADMIN_PASSWORD path, and its token is unchanged.
//
// The scope travels inside the signed admin token itself (see
// lib/admin-auth.js), because middleware runs on the edge runtime with
// no database: a stats token is `<exp>.<nonce>.stats.<sig>`, while the
// full-admin token keeps its `<exp>.<nonce>.<sig>` shape. Nothing about
// the full-admin session changes.
//
// Reversible: down drops the table.
export const version = '0020';
export const name = 'admin_users';

export async function up(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'stats',
    created_at BIGINT NOT NULL
  )`);
}

export async function down(db) {
  await db.query('DROP TABLE IF EXISTS admin_users');
}
