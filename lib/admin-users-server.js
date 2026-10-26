// Named admin accounts (migration 0020). Only the full admin — the
// ADMIN_PASSWORD path, gated by middleware — may create, list or delete
// these; the routes enforce that by living under /api/admin/*, which the
// middleware only opens to full-scope tokens.
//
// A scoped account is deliberately narrow: today the only scope is
// 'stats', which may read the stats summary and nothing else. Passwords
// are scrypt hashes (lib/password.js), never stored or returned plain.
import { query } from './db.js';
import { hashSecret, verifySecret } from './password.js';

export const ADMIN_USER_SCOPES = ['stats'];

const USERNAME_RE = /^[A-Za-z0-9._-]{3,64}$/;

export async function createAdminUser(username, password) {
  const name = String(username || '').trim();
  if (!USERNAME_RE.test(name)) return { error: 'invalid_username' };
  if (typeof password !== 'string' || password.length < 8) return { error: 'password_too_short' };
  const exists = await query('SELECT id FROM admin_users WHERE username = $1', [name]);
  if (exists.rows.length) return { error: 'exists' };
  const { rows } = await query(
    'INSERT INTO admin_users (username, password_hash, scope, created_at) VALUES ($1, $2, $3, $4) RETURNING id, username, scope, created_at',
    [name, await hashSecret(password), 'stats', Date.now()],
  );
  return { user: rows[0] };
}

export async function listAdminUsers() {
  const { rows } = await query('SELECT id, username, scope, created_at FROM admin_users ORDER BY created_at ASC');
  return rows;
}

export async function deleteAdminUser(username) {
  const { rows } = await query('DELETE FROM admin_users WHERE username = $1 RETURNING username', [String(username || '').trim()]);
  return rows.length > 0;
}

export async function verifyAdminUser(username, password) {
  const { rows } = await query('SELECT username, password_hash, scope FROM admin_users WHERE username = $1', [String(username || '').trim()]);
  if (!rows.length) return null;
  if (!(await verifySecret(password, rows[0].password_hash))) return null;
  return { username: rows[0].username, scope: rows[0].scope };
}
