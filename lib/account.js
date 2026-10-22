// Client account helpers. Accounts live on the server; sign-in and signup
// set an httpOnly session cookie, which is what the server trusts. The
// browser also keeps a small hint ({ username }) in localStorage so pages
// can render "is this mine?" instantly — it is only a hint: the server
// ignores it, and PresencePing / getMyAccount clear it once the session
// is gone. Passwords are SHA-256 hashed in the browser before they leave
// the device; the server stores that hash wrapped in salted scrypt.
const SESSION_KEY = 'kay-session';

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function setSessionHint(username) {
  try {
    if (username) localStorage.setItem(SESSION_KEY, JSON.stringify({ username }));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

// Keep the hint in step with what the server says about the cookie.
export function syncSessionHint(username) {
  const current = getSession()?.username || null;
  if (current !== (username || null)) setSessionHint(username || null);
}

export async function getMyAccount() {
  try {
    const res = await fetch('/api/accounts/me');
    if (res.status === 401) {
      setSessionHint(null);
      return null;
    }
    if (!res.ok) return null;
    const data = await res.json();
    setSessionHint(data.account.username);
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
  setSessionHint(username);
  return { ok: true };
}

export async function signIn(username, password) {
  const passwordHash = await hashPassword(password);
  const res = await fetch('/api/accounts/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, passwordHash }),
  });
  if (!res.ok) return { error: 'invalid' };
  const data = await res.json();
  setSessionHint(data.account.username);
  return { ok: true };
}

export async function signOut() {
  setSessionHint(null);
  try {
    await fetch('/api/accounts/signout', { method: 'POST' });
  } catch {}
}
