// Shared helpers for the regression tests. Tests run against a live app
// with a THROWAWAY database — never production:
//
//   BASE_URL=http://host:port ADMIN_PASSWORD=... npm test
import { createHash } from 'node:crypto';

export const BASE = process.env.BASE_URL || 'http://localhost:3000';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
export const sha = (s) => createHash('sha256').update(s).digest('hex');
export const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Minimal cookie-jar client: one per simulated person.
export function client() {
  const cookies = {};
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

export async function adminClient() {
  const admin = client();
  const r = await admin('/api/admin/login', { method: 'POST', body: { password: ADMIN_PASSWORD } });
  if (r.status !== 200) throw new Error(`admin login failed: ${r.status}`);
  return admin;
}

// Date helpers in Haiti time, as the server validates.
export function haitiDate(offsetDays = 0) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Port-au-Prince' });
  return new Date(Date.parse(`${today}T00:00:00Z`) + offsetDays * 86400000).toISOString().slice(0, 10);
}
