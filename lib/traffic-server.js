// Traffic and subscriber reports for the Admin Board (migration 0012).
//
// Three rules hold this module together.
//
// 1. A visitor is a PERSON, not a request. The browser pings once a
//    minute while a page is open, so counting pings would measure how
//    long tabs stay open. One row per visitor per Haiti day, claimed with
//    ON CONFLICT DO NOTHING, measures people.
//
// 2. Nothing is counted by IP address. Haitian carriers put many
//    subscribers behind one (CGNAT) address, so an IP merges strangers
//    into a single visitor — the same reason the listing view counter
//    keys on the anonymous visitor id instead.
//
// 3. Flows sum, stocks do not. See FLOW_METRICS / STOCK_METRICS below.
//    Getting this backwards is how a dashboard ends up reporting 280
//    active subscribers in a week when it has 40.
import { query } from './db';
import { haitiToday, haitiDaySql } from './haiti-day';
import { log } from './log';

// Counts of things that happened on a day. Over a longer period they add.
export const FLOW_METRICS = [
  'visitors',
  'signups',
  'subs_new',
  'subs_returning',
  'subs_suspended',
  'subs_deactivated',
  'revenue_htg',
  'revenue_join',
  'revenue_quarter',
  'revenue_reactivation',
  'revenue_advertising',
];

// Levels measured on a day. Over a longer period the report shows where
// the level ENDED, never a sum.
export const STOCK_METRICS = ['subs_active'];

export const METRICS = [...FLOW_METRICS, ...STOCK_METRICS];

// Series with no history before migration 0012 ran. The board labels
// these on screen so the early days are not read as a collapse in
// traffic, the same way the account figures carry their own caveat.
export const METRICS_FROM_DEPLOY = ['visitors', 'subs_active', 'subs_suspended', 'subs_deactivated'];

export const GRAINS = ['daily', 'weekly', 'monthly'];

const HAITI_DAY = haitiDaySql;

// Postgres truncates to the start of the week/month; 'daily' needs no
// bucketing. date_trunc('week') is ISO (Monday), which is what a weekly
// report should mean.
const BUCKET = { daily: 'day', weekly: 'week', monthly: 'month' };

function bucketOf(grain, expr) {
  return grain === 'daily' ? expr : `date_trunc('${BUCKET[grain]}', ${expr})::date`;
}

// ---------------------------------------------------------------- collect

// Called from the presence heartbeat. Returns true only the first time a
// given person is seen on a given day, which makes it safe to call on
// every ping.
export async function recordVisit({ username, visitor }, { now = Date.now(), day = null } = {}) {
  // Signed-in people count by username, so two devices are one visitor.
  // The `u:` prefix keeps a username from colliding with an anonymous id.
  const key = username ? `u:${username}` : String(visitor || '').trim().slice(0, 80);
  if (!key || key === 'u:') return false;
  const { rowCount } = await query(
    `INSERT INTO traffic_visitors (day, visitor, first_at) VALUES ($1, $2, $3)
     ON CONFLICT (day, visitor) DO NOTHING`,
    [day || haitiToday(), key, now],
  );
  return rowCount === 1;
}

// Add to a stored daily counter. Used for the churn events, which only
// exist at the moment the sweep acts on them.
export async function bumpMetric(metric, n = 1, { day = null } = {}) {
  if (!n || !METRICS.includes(metric)) return;
  await query(
    `INSERT INTO metrics_daily (day, metric, value) VALUES ($1, $2, $3)
     ON CONFLICT (day, metric) DO UPDATE SET value = metrics_daily.value + EXCLUDED.value`,
    [day || haitiToday(), metric, n],
  );
}

// The daily snapshot, run from /api/cron. Only the stock series need it:
// how many landlords are in good standing right now. Idempotent — the
// job runs every five minutes and simply overwrites today's level, so the
// last run of the day is the one that stands.
export async function snapshotDailyMetrics({ day = null } = {}) {
  const today = day || haitiToday();
  const { rows } = await query(
    `SELECT COUNT(*) FILTER (WHERE billing_status = 'active')::bigint AS active
     FROM accounts WHERE role = 'landlord' AND partner = FALSE`,
  );
  const active = Number(rows[0]?.active || 0);
  await query(
    `INSERT INTO metrics_daily (day, metric, value) VALUES ($1, 'subs_active', $2)
     ON CONFLICT (day, metric) DO UPDATE SET value = EXCLUDED.value`,
    [today, active],
  );
  log('info', 'metrics.snapshot', { day: today, subsActive: active });
  return { day: today, subs_active: active };
}

// ----------------------------------------------------------------- report

function isoDay(d) {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

// All six series for a date range, bucketed by grain. Returns rows the UI
// and the CSV both render, so the download can never disagree with the
// screen.
export async function trafficReport({ grain = 'daily', from, to } = {}) {
  if (!GRAINS.includes(grain)) grain = 'daily';
  const today = haitiToday();
  // Default window: enough buckets to see a trend at every grain.
  const span = { daily: 30, weekly: 7 * 12, monthly: 365 }[grain];
  const end = to || today;
  const start = from || isoDay(new Date(Date.parse(`${end}T00:00:00Z`) - span * 86400000));

  const buckets = new Map();
  const slot = (key) => {
    if (!buckets.has(key)) {
      const row = { period: key };
      for (const m of METRICS) row[m] = 0;
      buckets.set(key, row);
    }
    return buckets.get(key);
  };

  // visitors — unique people per bucket. Counted DISTINCT over the raw
  // rows rather than summed from the daily counts, because the same
  // person visiting Monday and Tuesday is one visitor in a weekly report.
  const vb = bucketOf(grain, 'day');
  const { rows: visitors } = await query(
    `SELECT ${vb} AS period, COUNT(DISTINCT visitor)::bigint AS n
     FROM traffic_visitors WHERE day BETWEEN $1 AND $2 GROUP BY period`,
    [start, end],
  );
  for (const r of visitors) slot(isoDay(r.period)).visitors = Number(r.n);

  // signups — from the accounts themselves, so this has real history.
  const ab = bucketOf(grain, HAITI_DAY('created_at'));
  const { rows: signups } = await query(
    `SELECT ${ab} AS period, COUNT(*)::bigint AS n FROM accounts
     WHERE created_at IS NOT NULL AND ${HAITI_DAY('created_at')} BETWEEN $1 AND $2
     GROUP BY period`,
    [start, end],
  );
  for (const r of signups) slot(isoDay(r.period)).signups = Number(r.n);

  // subscribers gained and revenue — from the confirmed payment ledger.
  // 'join' is the quarterly subscription's joining fee and 'activation'
  // the one-time fee it replaced; both mean "a landlord started paying",
  // so the series does not break at the Phase 11 boundary.
  // 'reactivation' is someone coming BACK, a different event, so it gets
  // its own series instead of being folded into new business.
  const pb = bucketOf(grain, HAITI_DAY('reviewed_at'));
  const { rows: pay } = await query(
    `SELECT ${pb} AS period, kind,
            COUNT(*)::bigint AS n,
            COALESCE(SUM(amount_htg), 0)::bigint AS htg
     FROM payments
     WHERE status = 'confirmed' AND reviewed_at IS NOT NULL
       AND ${HAITI_DAY('reviewed_at')} BETWEEN $1 AND $2
     GROUP BY period, kind`,
    [start, end],
  );
  for (const r of pay) {
    const row = slot(isoDay(r.period));
    const n = Number(r.n);
    const htg = Number(r.htg);
    row.revenue_htg += htg;
    if (r.kind === 'join' || r.kind === 'activation') {
      row.subs_new += n;
      row.revenue_join += htg;
    } else if (r.kind === 'reactivation') {
      row.subs_returning += n;
      row.revenue_reactivation += htg;
    } else if (r.kind === 'quarter') {
      row.revenue_quarter += htg;
    } else if (r.kind === 'advertising') {
      row.revenue_advertising += htg;
    }
  }

  // The stored series: churn (flows, summed) and active (a stock).
  const mb = bucketOf(grain, 'day');
  const { rows: stored } = await query(
    `SELECT ${mb} AS period, metric,
            SUM(value)::bigint AS total,
            -- For a stock, the level on the last day present in the
            -- bucket. DISTINCT ON would need its own query; picking the
            -- max day's value here keeps it to one pass.
            (ARRAY_AGG(value ORDER BY day DESC))[1]::bigint AS last_value
     FROM metrics_daily WHERE day BETWEEN $1 AND $2 GROUP BY period, metric`,
    [start, end],
  );
  for (const r of stored) {
    const row = slot(isoDay(r.period));
    if (!METRICS.includes(r.metric)) continue;
    row[r.metric] = STOCK_METRICS.includes(r.metric) ? Number(r.last_value) : Number(r.total);
  }

  const rows = [...buckets.values()].sort((a, b) => (a.period < b.period ? -1 : 1));
  return {
    grain,
    from: start,
    to: end,
    rows,
    // Totals for the range. Stocks show where the level ended, not a sum.
    totals: METRICS.reduce((acc, m) => {
      acc[m] = STOCK_METRICS.includes(m)
        ? (rows.length ? rows[rows.length - 1][m] : 0)
        : rows.reduce((s, r) => s + r[m], 0);
      return acc;
    }, {}),
    metricsFromDeploy: METRICS_FROM_DEPLOY,
  };
}

// Headline counts for the board's tiles. These used to be computed in the
// browser by filtering the full account list — which only worked because
// the full list was shipped to the browser. Counting in Postgres is both
// the point of the pagination work and two integers instead of a
// download.
export async function accountCounts() {
  const { rows } = await query(
    `SELECT COUNT(*)::int                                                              AS total,
            COUNT(*) FILTER (WHERE role = 'tenant')::int                               AS tenants,
            COUNT(*) FILTER (WHERE role = 'landlord')::int                             AS landlords,
            COUNT(*) FILTER (WHERE role <> 'tenant' AND NOT activated)::int             AS pending_activation,
            COUNT(*) FILTER (WHERE role = 'landlord' AND billing_status = 'active')::int AS subs_active
     FROM accounts`,
  );
  const r = rows[0] || {};
  return {
    total: Number(r.total || 0),
    tenants: Number(r.tenants || 0),
    landlords: Number(r.landlords || 0),
    pendingActivation: Number(r.pending_activation || 0),
    subsActive: Number(r.subs_active || 0),
  };
}

// ------------------------------------------------------------------- csv

// Excel opens a bare UTF-8 CSV as mojibake, so the caller sends a BOM.
// Values here are all numbers and ISO dates, so no quoting is needed —
// but the period is quoted anyway so a spreadsheet does not reformat it
// into a local date format and lose the day.
export function reportToCsv(report) {
  const header = ['period', ...METRICS];
  const lines = [header.join(',')];
  for (const r of report.rows) {
    lines.push([`"${r.period}"`, ...METRICS.map((m) => r[m])].join(','));
  }
  lines.push(['"total"', ...METRICS.map((m) => report.totals[m])].join(','));
  return lines.join('\r\n') + '\r\n';
}
