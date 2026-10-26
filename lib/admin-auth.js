// Admin gate. The password lives ONLY in the server env (ADMIN_PASSWORD)
// and is never in the repo. If the env var is unset, the admin area is
// closed (fail closed).
//
// The admin cookie is a signed, expiring token (Phase 1b): `<exp>.<nonce>.<sig>`
// where sig = HMAC-SHA256(key, "<exp>.<nonce>") and the key is derived
// from ADMIN_PASSWORD (+ optional ADMIN_SESSION_SECRET). It used to be
// SHA-256(password) itself — the same value forever, valid until the
// password changed. Now each login gets a fresh token that dies after
// 12 hours, and changing either env var revokes every admin session.
// Web Crypto only, because middleware runs on the edge runtime (no DB).
const TTL_MS = 12 * 60 * 60 * 1000;
export const ADMIN_COOKIE = 'kay_admin';
export const ADMIN_MAX_AGE_S = TTL_MS / 1000;

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256(text) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

async function hmacKey() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  const secret = `kay-admin-v2:${pw}:${process.env.ADMIN_SESSION_SECRET || ''}`;
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function sign(key, payload) {
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
}

// Constant-time string compare (equal-length hex strings).
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkAdminPassword(password) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || typeof password !== 'string') return false;
  return safeEqual(await sha256(password), await sha256(pw));
}

export async function issueAdminToken(scope = 'full') {
  const key = await hmacKey();
  if (!key) return null;
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16)));
  // Full-admin tokens keep the historic 3-part shape. A scoped token
  // carries its scope as a fourth part, signed along with the rest, so
  // middleware can enforce it without a database lookup — and so a
  // scoped token can never pass a check that expects a full token.
  const payload = scope === 'stats' ? `${Date.now() + TTL_MS}.${nonce}.stats` : `${Date.now() + TTL_MS}.${nonce}`;
  return `${payload}.${await sign(key, payload)}`;
}

// Which admin scope a token carries, or null when it is not a valid
// admin token at all. 'full' is the ADMIN_PASSWORD session; 'stats' is
// a named admin_users account. This is the only scope check middleware
// needs, and it runs on the edge runtime with no database.
export async function getAdminScope(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split('.');
  if (parts.length !== 3 && parts.length !== 4) return null;
  const [exp, nonce, third, fourth] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) <= Date.now()) return null;
  const key = await hmacKey();
  if (!key) return null;
  if (parts.length === 3) {
    return safeEqual(third, await sign(key, `${exp}.${nonce}`)) ? 'full' : null;
  }
  if (third !== 'stats') return null;
  return safeEqual(fourth, await sign(key, `${exp}.${nonce}.stats`)) ? 'stats' : null;
}

// Full-admin tokens only (the historic 3-part shape). Every existing
// caller wants the full admin — owner-or-admin actions, takedowns,
// ad pauses — so a scoped token fails here by construction, and a
// scoped account can never borrow one of those powers.
export async function isAdminCookie(value) {
  if (typeof value !== 'string') return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) <= Date.now()) return false;
  const key = await hmacKey();
  if (!key) return false;
  return safeEqual(sig, await sign(key, `${exp}.${nonce}`));
}

export function adminCookieHeader(token, maxAge = ADMIN_MAX_AGE_S) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${ADMIN_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
