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
const KEY = 'kay_outbox';
const EVENT = 'kay-outbox-change';

export function newClientId() {
  try {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable — nothing persists, which is acceptable */
  }
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* no window (SSR) */
  }
}

export function all() {
  return read();
}

// The chat sends still waiting for one thread, oldest first — what ChatBox
// shows as "sending" bubbles until the server confirms them.
export function pendingChat(listingId, tenant) {
  const t = tenant ?? null;
  return read().filter(
    (it) => it.kind === 'chat' && it.body?.listingId === listingId && (it.body?.tenant ?? null) === t,
  );
}

export function enqueue(item) {
  const items = read();
  items.push({ id: newClientId(), createdAt: Date.now(), ...item });
  write(items);
}

export function remove(id) {
  write(read().filter((it) => it.id !== id));
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

// Try to send everything queued, oldest first. An item is removed once the
// server has DEFINITIVELY handled it — any HTTP response, since a 2xx
// succeeded, a 409 means the original already landed (visit), and any other
// status means the request can't succeed as-is and must not be retried
// forever. It is KEPT only on a network error (still offline); the loop
// then stops so order is preserved for the next flush.
let flushing = false;
export async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    for (const item of read()) {
      try {
        const res = await fetch(item.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.body),
        });
        remove(item.id); // any response is definitive — see above
        void res;
      } catch {
        break; // offline again: keep this and the rest, retry later
      }
    }
  } finally {
    flushing = false;
  }
}
