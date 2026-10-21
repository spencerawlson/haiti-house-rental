// Live presence (v0, in-memory — resets on server restart, like the other
// stores). The browser pings once a minute while a page is open. "Live"
// means seen in the last 3 minutes: a closed tab lingers up to 3 minutes,
// and an idle open tab still counts. Approximate by design, not exact.
const users = new Map(); // username -> lastSeen
const visitors = new Map(); // visitorId -> lastSeen
const LIVE_MS = 3 * 60 * 1000;
const PRUNE_MS = 10 * 60 * 1000;

export function touchPresence({ username, visitor }) {
  const now = Date.now();
  if (username) users.set(username, now);
  else if (visitor) visitors.set(visitor, now);
}

function prune() {
  const cutoff = Date.now() - PRUNE_MS;
  for (const [k, v] of users) if (v < cutoff) users.delete(k);
  for (const [k, v] of visitors) if (v < cutoff) visitors.delete(k);
}

export function getPresence() {
  prune();
  const now = Date.now();
  const liveUsers = [...users.entries()]
    .filter(([, t]) => now - t <= LIVE_MS)
    .map(([username, lastSeen]) => ({ username, lastSeen, secondsAgo: Math.floor((now - lastSeen) / 1000) }));
  const liveVisitors = [...visitors.values()].filter((t) => now - t <= LIVE_MS).length;
  return { users: liveUsers, visitors: liveVisitors };
}
