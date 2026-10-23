// Migration 0012 — traffic and daily metrics for the Admin Board.
//
// The reports need six series. Three of them already have a complete
// history in tables this app has kept since the beginning, and three have
// no history anywhere. This migration adds storage for the second group
// only, and indexes for the first — copying the ledger into a rollup
// would just create a second number that can disagree with the first.
//
//   Derived live, full history:
//     signups          accounts.created_at
//     subs_new         confirmed 'join' / legacy 'activation' payments
//     subs_returning   confirmed 'reactivation' payments
//     revenue_*        confirmed payments, by kind
//
//   Stored from here on, because nothing ever recorded them:
//     visitors         traffic_visitors (new)
//     subs_active      metrics_daily (new), snapshotted daily
//     subs_suspended   metrics_daily (new), counted as the sweep acts
//     subs_deactivated metrics_daily (new), counted as the sweep acts
//
// traffic_visitors answers "how many PEOPLE came", exactly. One row per
// visitor per Haiti calendar day, and the PRIMARY KEY does the
// de-duplication, so the once-a-minute heartbeat from an open tab cannot
// inflate the count. A row per request would store a thousand times more
// to answer a worse question: 10 000 visitors a day is 10 000 rows a day,
// roughly 3.6M a year, which Postgres aggregates with an index scan.
//
// metrics_daily is one row per day per metric — a month is 30 rows, a
// year is 365 — and it exists for the figures that cannot be recomputed
// after the fact. Suspension is the clear case: the sweep sets
// `suspended_at`, and the next sweep overwrites it, so "how many lapsed
// last Tuesday" is unanswerable unless it was counted on the day.
//
// Flows vs stocks, the distinction every report below depends on:
//   FLOW   things that HAPPENED that day — visitors, signups, subs_new,
//          churn, revenue. Over a week or a month these SUM.
//   STOCK  a level measured ON that day — subs_active. These must NOT
//          sum: a week of "40 active" is 40 active, not 280. The report
//          takes the last day present in the period instead.
//
// Honest limit, repeated on screen: the three stored series begin at the
// deploy that runs this migration, the same caveat login_events (0008)
// carries. The derived ones go back as far as the data does.
//
// Reversible: down drops the two tables and the indexes it added.
export const version = '0012';
export const name = 'traffic_metrics';

export async function up(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS traffic_visitors (
    day DATE NOT NULL,
    visitor TEXT NOT NULL,
    first_at BIGINT NOT NULL,
    PRIMARY KEY (day, visitor)
  )`);
  // Every report asks "between these two days", so the day leads.
  await db.query('CREATE INDEX IF NOT EXISTS traffic_visitors_day_idx ON traffic_visitors (day)');

  await db.query(`CREATE TABLE IF NOT EXISTS metrics_daily (
    day DATE NOT NULL,
    metric TEXT NOT NULL,
    value BIGINT NOT NULL,
    PRIMARY KEY (day, metric)
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS metrics_daily_day_idx ON metrics_daily (day)');

  // The derived series group by a date expression over these columns. With
  // a range filter these turn a full scan into an index scan, which is
  // what keeps the reports usable once the ledger is long.
  await db.query('CREATE INDEX IF NOT EXISTS accounts_created_idx ON accounts (created_at)');
  await db.query('CREATE INDEX IF NOT EXISTS payments_reviewed_idx ON payments (status, reviewed_at)');
}

export async function down(db) {
  await db.query('DROP TABLE IF EXISTS traffic_visitors');
  await db.query('DROP TABLE IF EXISTS metrics_daily');
  await db.query('DROP INDEX IF EXISTS accounts_created_idx');
  await db.query('DROP INDEX IF EXISTS payments_reviewed_idx');
}
