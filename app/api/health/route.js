import { initDb, getPool } from '@/lib/db';
import { migrationStatus } from '@/lib/migrate';
import { log } from '@/lib/log';

// Public liveness + readiness check (Docker HEALTHCHECK, uptime monitors,
// post-deploy curl). 200 only when Postgres answers AND every migration
// is applied; 503 otherwise. It reveals only up/down and schema version
// numbers — nothing about users or data.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await initDb();
    await getPool().query('SELECT 1');
    const m = await migrationStatus(getPool());
    const ready = m.pending.length === 0;
    return Response.json(
      { ok: ready, db: 'up', schema: m.applied[m.applied.length - 1] || null, latest: m.latest, pending: m.pending.length },
      { status: ready ? 200 : 503 },
    );
  } catch (e) {
    log('error', 'health.failed', { message: e.message });
    return Response.json({ ok: false, db: 'down' }, { status: 503 });
  }
}
