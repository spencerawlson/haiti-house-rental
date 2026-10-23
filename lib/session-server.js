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
  // History for the Admin Board (0008). A failure here must never stop
  // somebody signing in — it is a statistic, not a credential.
  await query(
    'INSERT INTO login_events (username, token_hash, at, last_seen_at) VALUES ($1,$2,$3,$3)',
    [username, tokenHash(token), now],
  ).catch(() => {});
  return cookie(token, MAX_AGE_S);
}

// The presence ping calls this once a minute while a page is open, so a
// session that is never signed out still has a last-seen time (and so its
// length can be worked out). Keyed on THIS request's token, so one device
// never writes over another device's record.
export async function touchSessionActivity(request) {
  const token = readToken(request);
  if (!token) return;
  await query(
    'UPDATE login_events SET last_seen_at = $2 WHERE token_hash = $1 AND ended_at IS NULL',
    [tokenHash(token), Date.now()],
  ).catch(() => {});
}

// Close one session's record. Signing out on one phone must not end the
// record of a session still open on another.
async function closeLoginEvent(hash) {
  if (!hash) return;
  await query(
    `UPDATE login_events SET ended_at = $2, last_seen_at = GREATEST(last_seen_at, $2)
     WHERE token_hash = $1 AND ended_at IS NULL`,
    [hash, Date.now()],
  ).catch(() => {});
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
  if (!token) return;
  await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)]);
  await closeLoginEvent(tokenHash(token));
}

// After a password reset every device must sign in again.
export async function destroyAllSessions(username) {
  await query('DELETE FROM sessions WHERE username = $1', [username]);
  // A password reset revokes every device, so every open record closes.
  await query(
    `UPDATE login_events SET ended_at = $2, last_seen_at = GREATEST(last_seen_at, $2)
     WHERE username = $1 AND ended_at IS NULL`,
    [username, Date.now()],
  ).catch(() => {});
}

export function unauthorized() {
  return Response.json({ error: 'Sign in required' }, { status: 401 });
}
