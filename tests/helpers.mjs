// Shared helpers for the regression tests. Tests run against a live app
// with a THROWAWAY database — never production:
//
//   BASE_URL=http://host:port ADMIN_PASSWORD=... npm test
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const BASE = process.env.BASE_URL || 'http://localhost:3000';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
export const sha = (s) => createHash('sha256').update(s).digest('hex');
export const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Minimal cookie-jar client: one per simulated person. An existing cookie
// string can be seeded in, which is how the shared admin session below
// is reused.
export function client(initialCookie = '') {
  const cookies = {};
  for (const pair of String(initialCookie).split(';')) {
    const i = pair.indexOf('=');
    if (i > 0) cookies[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
  return async function call(path, { method = 'GET', body, form } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    const jar = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    if (jar) headers.Cookie = jar;
    const res = await fetch(BASE + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined), redirect: 'manual' });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const value = pair.slice(i + 1);
      if (value) cookies[pair.slice(0, i)] = value; else delete cookies[pair.slice(0, i)];
    }
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  };
}

export async function signup(call, { name, username, password, phone = '+509 3000 0000', role }) {
  return call('/api/accounts', { method: 'POST', body: { name, username, passwordHash: sha(password), phone, role } });
}

// ONE admin sign-in for the whole suite.
//
// Test files run in separate processes, so a per-process cache is not
// enough. Nine files signing in individually sat exactly on the admin
// login limit (10 per 15 minutes, per IP, in app/api/admin/login) — so
// the tenth file anyone added got a 429 and took its whole file down
// with it. That limit is right, and the tests were wrong to spend it one
// login per file.
//
// The session cookie is cached in the temp directory, keyed by server and
// password, and verified before use. If it is missing or no longer valid
// this signs in once and caches the result. Two processes racing on a
// cold cache may both sign in; that is two logins, not ten.
const ADMIN_COOKIE_FILE = join(
  tmpdir(),
  `kay-admin-session-${createHash('sha256').update(`${BASE}|${ADMIN_PASSWORD}`).digest('hex').slice(0, 16)}`,
);

function cookieHeaderOf(res) {
  return (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
}

export async function adminClient() {
  // A cached session, if it still works.
  if (existsSync(ADMIN_COOKIE_FILE)) {
    try {
      const cached = readFileSync(ADMIN_COOKIE_FILE, 'utf8').trim();
      if (cached) {
        const admin = client(cached);
        // Any admin-only GET will do as a liveness check.
        if ((await admin('/api/admin/notify-status')).status === 200) {
          // Exposed for the few tests that need a raw fetch (a CSV
          // download is text, and client() parses JSON).
          admin.cookie = cached;
          return admin;
        }
      }
    } catch { /* fall through to a fresh sign-in */ }
  }

  const fresh = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  if (fresh.status !== 200) throw new Error(`admin login failed: ${fresh.status}`);
  const cookie = cookieHeaderOf(fresh);
  try { writeFileSync(ADMIN_COOKIE_FILE, cookie, 'utf8'); } catch { /* cache is an optimisation */ }
  const admin = client(cookie);
  admin.cookie = cookie;
  return admin;
}

// Date helpers in Haiti time, as the server validates.
export function haitiDate(offsetDays = 0) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Port-au-Prince' });
  return new Date(Date.parse(`${today}T00:00:00Z`) + offsetDays * 86400000).toISOString().slice(0, 10);
}
