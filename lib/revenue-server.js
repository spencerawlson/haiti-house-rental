// Revenue — every confirmed payment, at the amount actually paid.
//
// The single source of truth is the payments ledger: each CONFIRMED
// payment counts once at its real amount — join 1500, every quarter 1000,
// reactivation 1500, advertising 100–1,000 HTG chosen by the landlord
// (amounts stored on the payment when it was submitted). Rejected, pending and
// deleted payments never count.
//
// revenue_entries is the older roster (one row per activated landlord).
// Only its MANUAL rows are added: landlords the admin activated by hand,
// outside the payments ledger (the old one-time 1000 HTG). Rows written
// because a payment was confirmed have source 'payment' and are already
// counted from that payment (0016) — adding them again double-counted.
import { ACTIVATION_FEE_HTG } from './config';
import { query } from './db';

// Roster entry for a newly activated landlord. `source` says whether money
// is counted from a payment ('payment') or only from this row ('manual').
// Partners never paid and tenants are free: neither is recorded.
export async function logActivation(account, source = 'manual') {
  if (!account || account.role === 'tenant') return null;
  if (account.partner) return null;
  const { rowCount } = await query(
    `INSERT INTO revenue_entries (username, name, amount_htg, activated_at, source)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
    [account.username, account.name, ACTIVATION_FEE_HTG, Date.now(), source === 'payment' ? 'payment' : 'manual'],
  );
  if (rowCount === 0) return null;
  return { username: account.username, name: account.name, amountHTG: ACTIVATION_FEE_HTG, activatedAt: Date.now() };
}

// Every confirmed payment + manual activations, newest first, with totals.
// totalHTG is by construction the same figure as paymentSummary().confirmedHTG.
export async function getRevenue() {
  const { rows } = await query(
    `SELECT 'pay-' || p.id AS key, p.username, COALESCE(a.name, p.username) AS name, p.kind,
            p.amount_htg AS amount, COALESCE(p.reviewed_at, p.submitted_at) AS at, 'payment' AS source
       FROM payments p LEFT JOIN accounts a ON a.username = p.username
      WHERE p.status = 'confirmed'
     UNION ALL
     SELECT 'man-' || r.username, r.username, r.name, 'manual', r.amount_htg, r.activated_at, 'manual'
       FROM revenue_entries r
      WHERE r.source = 'manual'
     ORDER BY at DESC`,
  );
  const entries = rows.map((r) => ({
    key: r.key,
    username: r.username,
    name: r.name,
    kind: r.kind,
    amountHTG: Number(r.amount),
    at: Number(r.at),
    source: r.source,
  }));
  const byKind = {};
  for (const e of entries) byKind[e.kind] = (byKind[e.kind] || 0) + e.amountHTG;
  return {
    entries,
    byKind,
    totalHTG: entries.reduce((sum, e) => sum + e.amountHTG, 0),
  };
}
