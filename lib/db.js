// Postgres connection. DATABASE_URL comes from the environment
// (docker-compose points it at the db service; local dev defaults to a
// local Postgres). The schema is managed by versioned migrations in
// lib/migrations/ (Phase 6): pending ones are applied, in order, before
// the first query. Restarts and rebuilds never wipe real data.
import { Pool } from 'pg';
import { runMigrations } from './migrate';

let pool = null;
export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/kayayiti',
    });
  }
  return pool;
}

let initPromise = null;
export async function initDb() {
  if (!initPromise) {
    initPromise = runMigrations(getPool()).catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

export async function query(text, params) {
  await initDb();
  return getPool().query(text, params);
}
