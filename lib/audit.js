// Audit trail (Phase 6): admin and security-relevant actions, stored in
// audit_log and echoed as a structured log line. A failure to write the
// audit row never blocks the action itself — it is logged as an error.
import { query } from './db';
import { log } from './log';

export async function audit(actor, action, target = null, details = {}) {
  log('info', `audit.${action}`, { actor, target, ...details });
  try {
    await query(
      'INSERT INTO audit_log (at, actor, action, target, details) VALUES ($1,$2,$3,$4,$5::jsonb)',
      [Date.now(), actor, action, target, JSON.stringify(details)],
    );
  } catch (e) {
    log('error', 'audit.write_failed', { action, message: e.message });
  }
}

export async function recentAudit(limit = 200) {
  const { rows } = await query('SELECT * FROM audit_log ORDER BY at DESC LIMIT $1', [limit]);
  return rows.map((r) => ({ id: Number(r.id), at: Number(r.at), actor: r.actor, action: r.action, target: r.target, details: r.details || {} }));
}
