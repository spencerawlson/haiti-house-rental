// Versioned migration runner (Phase 6).
//
// - Applied versions live in `schema_migrations` (version, name, applied_at).
// - At startup every pending migration runs in order, each inside its own
//   transaction with a Postgres advisory lock held, so two app processes
//   starting together cannot apply the same migration twice.
// - Rolling back: set MIGRATE_DOWN_TO=<version> (e.g. 0001) and restart.
//   Every applied migration above that version is reverted, newest first,
//   and nothing newer is applied while the variable is set. Unset it
//   after the rollback. The baseline (0001) refuses to revert.
import { MIGRATIONS } from './migrations';
import { log } from './log';

const LOCK_ID = 774411; // arbitrary, constant per app

async function inTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_ID]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function appliedVersions(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at BIGINT NOT NULL
  )`);
  const { rows } = await client.query('SELECT version FROM schema_migrations ORDER BY version');
  return new Set(rows.map((r) => r.version));
}

export async function runMigrations(pool) {
  const target = process.env.MIGRATE_DOWN_TO;
  if (target) return rollbackTo(pool, target);
  for (const m of MIGRATIONS) {
    await inTransaction(pool, async (client) => {
      // Re-check inside the lock: another process may have applied it.
      if ((await appliedVersions(client)).has(m.version)) return;
      const started = Date.now();
      await m.up(client);
      await client.query('INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1,$2,$3)', [m.version, m.name, Date.now()]);
      log('info', 'migration.applied', { version: m.version, name: m.name, ms: Date.now() - started });
    });
  }
}

async function rollbackTo(pool, target) {
  const newestFirst = [...MIGRATIONS].reverse().filter((m) => m.version > target);
  for (const m of newestFirst) {
    await inTransaction(pool, async (client) => {
      if (!(await appliedVersions(client)).has(m.version)) return;
      await m.down(client);
      await client.query('DELETE FROM schema_migrations WHERE version = $1', [m.version]);
      log('warn', 'migration.reverted', { version: m.version, name: m.name });
    });
  }
}

export async function migrationStatus(pool) {
  const client = await pool.connect();
  try {
    const applied = await appliedVersions(client);
    return {
      latest: MIGRATIONS[MIGRATIONS.length - 1].version,
      applied: [...applied].sort(),
      pending: MIGRATIONS.filter((m) => !applied.has(m.version)).map((m) => m.version),
    };
  } finally {
    client.release();
  }
}
