// Client account helpers. Accounts live on the server (v0 in-memory store)
// so the admin can see and activate them; the browser only keeps the
// session (username). Passwords are SHA-256 hashed in the browser before
// they ever leave the device — the server only ever sees the hash.
const SESSION_KEY = 'kay-session';

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export async function getMyAccount() {
  const session = getSession();
  if (!session) return null;
  try {
    const res = await fetch(`/api/accounts?username=${encodeURIComponent(session.username)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.account;
  } catch {
    return null;
  }
}

export async function hashPassword(password) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createAccount({ name, username, password, phone, email, location, role }) {
  const passwordHash = await hashPassword(password);
  const res = await fetch('/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, username, passwordHash, phone, email, location, role }),
  });
  if (res.status === 409) return { error: 'taken' };
  if (!res.ok) return { error: 'failed' };
  localStorage.setItem(SESSION_KEY, JSON.stringify({ username }));
  return { ok: true };
}

export async function markMyTransferSent(provider) {
  const session = getSession();
  if (!session) return null;
  const res = await fetch('/api/accounts/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: session.username, provider }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function signIn(username, password) {
  const passwordHash = await hashPassword(password);
  const res = await fetch('/api/accounts/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, passwordHash }),
  });
  if (!res.ok) return { error: 'invalid' };
  localStorage.setItem(SESSION_KEY, JSON.stringify({ username }));
  return { ok: true };
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
}
