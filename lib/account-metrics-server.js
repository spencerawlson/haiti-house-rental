// Per-account engagement figures for the Admin Board.
//
// Everything here is read-only aggregation over login_events (0008) and
// visits. It is deliberately a separate module from accounts-server.js:
// pub() is the shape half the app relies on, and nobody browsing the
// site should start carrying analytics in their profile payload.
//
// Honest limits, repeated in the UI so the numbers are not over-read:
//   - login_events starts at the deploy that shipped 0008. An account
//     that signed in before then has no history; `logins` is 0 and
//     `lastSeenAt` is null, which means "not recorded", not "never came".
//   - A session that is never signed out ends at its last presence ping,
//     so lengths are accurate to about a minute and a closed tab looks
//     like up to a minute of extra time.
//   - "Visits" are property viewing appointments (the visits table), not
//     page views.
import { query } from './db';

// username -> { logins, activeSessions, lastSeenAt, avgSessionMs, visits, visitsActive }
export async function getAccountMetrics() {
  const { rows: logins } = await query(
    `SELECT username,
            COUNT(*)::int                                   AS logins,
            COUNT(*) FILTER (WHERE ended_at IS NULL)::int    AS open_sessions,
            MAX(last_seen_at)                                AS last_seen_at,
            -- A session's length is until sign-out, or until the last
            -- ping if it was simply abandoned. Sessions shorter than a
            -- ping interval count as zero, not as noise.
            AVG(GREATEST(COALESCE(ended_at, last_seen_at) - at, 0))::bigint AS avg_session_ms
     FROM login_events GROUP BY username`,
  );
  // Appointments, all statuses and the still-open ones, for both sides of
  // the visit: a landlord's number is the visits to their homes.
  const { rows: visits } = await query(
    `SELECT username, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE live)::int AS live FROM (
       SELECT tenant AS username, status = ANY($1) AS live FROM visits WHERE tenant IS NOT NULL
       UNION ALL
       SELECT owner  AS username, status = ANY($1) AS live FROM visits WHERE owner IS NOT NULL
     ) v GROUP BY username`,
    [['proposed', 'confirmed']],
  );
  const byUser = new Map();
  const slot = (u) => {
    if (!byUser.has(u)) {
      byUser.set(u, { logins: 0, activeSessions: 0, lastSeenAt: null, avgSessionMs: null, visits: 0, visitsActive: 0 });
    }
    return byUser.get(u);
  };
  for (const r of logins) {
    const m = slot(r.username);
    m.logins = r.logins;
    m.activeSessions = r.open_sessions;
    m.lastSeenAt = r.last_seen_at ? Number(r.last_seen_at) : null;
    m.avgSessionMs = r.avg_session_ms === null ? null : Number(r.avg_session_ms);
  }
  for (const r of visits) {
    const m = slot(r.username);
    m.visits = r.total;
    m.visitsActive = r.live;
  }
  return Object.fromEntries(byUser);
}
