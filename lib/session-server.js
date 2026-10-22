// Server sessions (Oct 2026). Before this, the server trusted whatever
// username a request carried, so anyone could act as anyone. Now sign-in
// and signup set a random token in an httpOnly cookie; the database keeps
// only its SHA-256, and every protected route asks getSessionAccount()
// who the caller is — usernames sent by the browser are ignored.
import { createHash, randomBytes } from 'crypto';
import { query } from './db';
import { getServerAccount } from './accounts-server';

export const SESSION_COOKIE = 'kay_session';
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function cookie(value, maxAge) {
  // Secure in production (kayayiti.app is HTTPS behind the tunnel); plain
  // http://localhost in dev would drop a Secure cookie in some browsers.
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function createSession(username) {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  await query(
    'INSERT INTO sessions (token_hash, username, created_at, expires_at) VALUES ($1,$2,$3,$4)',
    [tokenHash(token), username, now, now + MAX_AGE_S * 1000],
  );
  return cookie(token, MAX_AGE_S);
}

export function clearSessionCookie() {
  return cookie('', 0);
}

function readToken(request) {
  return request.cookies?.get(SESSION_COOKIE)?.value || '';
}

// The signed-in account, or null. Expired sessions are treated as absent.
export async function getSessionAccount(request) {
  const token = readToken(request);
  if (!token) return null;
  const { rows } = await query(
    'SELECT username FROM sessions WHERE token_hash = $1 AND expires_at > $2',
    [tokenHash(token), Date.now()],
  );
  if (!rows[0]) return null;
  return getServerAccount(rows[0].username);
}

export async function destroySession(request) {
  const token = readToken(request);
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)]);
}

// After a password reset every device must sign in again.
export async function destroyAllSessions(username) {
  await query('DELETE FROM sessions WHERE username = $1', [username]);
}

export function unauthorized() {
  return Response.json({ error: 'Sign in required' }, { status: 401 });
}
