// Offline send outbox (Phase 14c-2). A tiny, localStorage-backed queue of
// sends that couldn't reach the server because the device was offline, so
// they are replayed when the connection returns instead of being lost.
//
// Browser-only: every storage access is wrapped, because localStorage can
// throw (private mode, disabled site data) or come back empty. The queue is
// best-effort — if it can't persist, a send just behaves as it did before
// this phase.
//
// Safe to replay: chat sends carry a clientId the server deduplicates
// (migration 0025), and visit requests return already_requested for a
// duplicate, so a replayed item can never double-apply.
//
// Per account: every item is stamped with the username that queued it and
// is only ever sent (or shown) while that same account is signed in. On a
// shared phone, a message typed offline by one person can never go out
// under the next person's session. Signing out clears the queue.
import { getSession } from './account';

const KEY = 'kay_outbox';
const EVENT = 'kay-outbox-change';
// A queued send older than this is no longer what the person meant to
// say/ask "now" — it stops retrying (chat: shown as not sent).
export const MAX_AGE_MS = 7 * 86400000;

export function newClientId() {
  try {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function currentUser() {
  try {
    return getSession()?.username || null;
  } catch {
    return null;
  }
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(items) {
  try {
    if (items.length) localStorage.setItem(KEY, JSON.stringify(items));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — nothing persists, which is acceptable */
  }
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* no window (SSR) */
  }
}

function update(id, patch) {
  write(read().map((it) => (it.id === id ? { ...it, ...patch } : it)));
}

// The signed-in account's items only.
export function all() {
  const me = currentUser();
  return read().filter((it) => it.user === me);
}

// The chat sends for one thread that belong to the signed-in account,
// oldest first: still-waiting ones ("sending" bubbles) and ones the server
// refused (failed: true, shown as "not sent" until dismissed).
export function pendingChat(listingId, tenant) {
  const t = tenant ?? null;
  return all().filter(
    (it) => it.kind === 'chat' && it.body?.listingId === listingId && (it.body?.tenant ?? null) === t,
  );
}

export function enqueue(item) {
  const items = read();
  items.push({ id: newClientId(), createdAt: Date.now(), ...item, user: currentUser() });
  write(items);
}

export function remove(id) {
  write(read().filter((it) => it.id !== id));
}

// Signing out drops everything queued on this device.
export function clearOutbox() {
  write([]);
}

// Notified on this tab's writes (EVENT) and other tabs' (storage).
export function subscribe(cb) {
  try {
    window.addEventListener(EVENT, cb);
    window.addEventListener('storage', cb);
  } catch {
    return () => {};
  }
  return () => {
    try {
      window.removeEventListener(EVENT, cb);
      window.removeEventListener('storage', cb);
    } catch {
      /* no window */
    }
  };
}

// What to do with an item after the server answered with `status`.
//   done  — it landed: 2xx, or 409 (the original already landed, e.g. a
//           visit already requested).
//   retry — a temporary problem, try again later and stop this pass so
//           order is kept: 5xx (server restarting, Cloudflare 502/503 while
//           the host is unreachable), 408, 429 (rate limited), and 401 (the
//           session lapsed — it goes out once they sign back in).
//   fail  — the server refused it for good (400 invalid, 403 blocked or
//           suspended, 404 gone…): retrying can never succeed.
export function classifyStatus(status) {
  if ((status >= 200 && status < 300) || status === 409) return 'done';
  if (status >= 500 || status === 408 || status === 429 || status === 401) return 'retry';
  return 'fail';
}

// A refused or expired chat message stays visible as "not sent" so the
// person knows; anything else is simply dropped.
function giveUp(item) {
  if (item.kind === 'chat') update(item.id, { failed: true });
  else remove(item.id);
}

// Try to send the signed-in account's queued items, oldest first. Items
// queued by another account are left untouched for that account; items
// from before items were stamped with an owner (no `user` field) cannot be
// attributed safely and are discarded.
let flushing = false;
export async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    const me = currentUser();
    for (const item of read()) {
      if (!('user' in item)) {
        remove(item.id);
        continue;
      }
      if (item.failed || item.user !== me || !me) continue;
      if (Date.now() - (item.createdAt || 0) > MAX_AGE_MS) {
        giveUp(item);
        continue;
      }
      let res;
      try {
        res = await fetch(item.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.body),
        });
      } catch {
        break; // offline again: keep this and the rest, retry later
      }
      const action = classifyStatus(res.status);
      if (action === 'done') remove(item.id);
      else if (action === 'fail') giveUp(item);
      else break; // retry later, keeping order
    }
  } finally {
    flushing = false;
  }
}
