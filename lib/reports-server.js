// Reports (Phase 2): a signed-in user flags a conversation or a listing.
// The admin reviews on the Admin Board and resolves; nothing is removed
// automatically — takedowns and blocks stay deliberate human actions.
import { randomBytes } from 'crypto';
import { query } from './db';

export const REPORT_REASONS = ['scam', 'harassment', 'spam', 'wrong_info', 'not_available', 'other'];

function mapReport(r) {
  return {
    id: r.id,
    kind: r.kind,
    targetId: r.target_id,
    listingId: r.listing_id,
    reporter: r.reporter,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: Number(r.created_at),
    resolvedAt: r.resolved_at ? Number(r.resolved_at) : null,
    resolvedBy: r.resolved_by || null,
    outcome: r.outcome || null,
  };
}

// One open report per reporter per target: repeats return the existing one.
export async function createReport({ kind, targetId, listingId, reporter, reason, details }) {
  const { rows: open } = await query(
    `SELECT * FROM reports WHERE kind = $1 AND target_id = $2 AND reporter = $3 AND status = 'open'`,
    [kind, targetId, reporter],
  );
  if (open[0]) return { report: mapReport(open[0]), duplicate: true };
  const { rows } = await query(
    `INSERT INTO reports (id, kind, target_id, listing_id, reporter, reason, details, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'open',$8) RETURNING *`,
    [`rep-${randomBytes(10).toString('hex')}`, kind, targetId, listingId || null, reporter, reason, details || '', Date.now()],
  );
  return { report: mapReport(rows[0]), duplicate: false };
}

export async function listReports(status = 'open') {
  const { rows } = await query(
    `SELECT r.*, l.title AS listing_title FROM reports r LEFT JOIN listings l ON l.id = r.listing_id
     WHERE r.status = $1 ORDER BY r.created_at DESC LIMIT 200`,
    [status],
  );
  return rows.map((r) => ({ ...mapReport(r), listingTitle: r.listing_title || null }));
}

export async function resolveReport(id, admin = 'admin', outcome = null) {
  // outcome: 'action' | 'none' | null. NULL means the admin stated no
  // outcome — the reporter is told nothing then, because no outcome was
  // claimed. Legacy resolutions keep outcome NULL.
  const { rows } = await query(
    `UPDATE reports SET status = 'resolved', resolved_at = $2, resolved_by = $3, outcome = $4 WHERE id = $1 AND status = 'open' RETURNING *`,
    [id, Date.now(), admin, outcome],
  );
  return rows[0] ? mapReport(rows[0]) : null;
}
