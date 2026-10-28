// "Someone is typing…" — in-memory, like lib/rate-limit.js. One container
// serves kayayiti.app, and typing state is inherently short-lived (a few
// seconds), so it has no business in Postgres: a process-local Map with a
// TTL is both simpler and cheaper than a write per keystroke.
const typing = new Map(); // `${listingId}|${tenant}|${role}` -> expiresAt
const TTL_MS = 6000;

export function setTyping(listingId, tenant, role) {
  typing.set(`${listingId}|${tenant}|${role}`, Date.now() + TTL_MS);
}

export function isTyping(listingId, tenant, role) {
  const exp = typing.get(`${listingId}|${tenant}|${role}`);
  return !!exp && exp > Date.now();
}
