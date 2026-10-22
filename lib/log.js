// Structured logs (Phase 6): one JSON object per line on stdout/stderr,
// so `docker logs kayayiti-web` can be grepped or shipped to any log
// tool. Never log passwords, hashes, tokens, reset codes or full phone
// numbers — callers pass only what is safe to keep.
export function log(level, event, fields = {}) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...fields });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}
