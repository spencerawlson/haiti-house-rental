// Activation revenue ledger — Postgres (since Oct 2026; the old
// in-memory ledger reset on every restart). One entry per landlord
// account: 1000 HTG when the admin activates it. Tenant accounts are free
// and never appear here. Deactivate + re-activate does NOT double-count:
// the first activation is the one that paid.
import { ACTIVATION_FEE_HTG } from './config';
import { query } from './db';

export async function logActivation(account) {
  if (!account || account.role === 'tenant') return null;
  // Partner accounts never paid: creating or re-activating one must not
  // invent revenue.
  if (account.partner) return null;
  const { rowCount } = await query(
    `INSERT INTO revenue_entries (username, name, amount_htg, activated_at)
     VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
    [account.username, account.name, ACTIVATION_FEE_HTG, Date.now()],
  );
  if (rowCount === 0) return null;
  return { username: account.username, name: account.name, amountHTG: ACTIVATION_FEE_HTG, activatedAt: Date.now() };
}

export async function getRevenue() {
  const { rows } = await query('SELECT * FROM revenue_entries ORDER BY activated_at ASC');
  const entries = rows.map((r) => ({ username: r.username, name: r.name, amountHTG: r.amount_htg, activatedAt: Number(r.activated_at) }));
  return {
    entries,
    totalHTG: entries.reduce((sum, e) => sum + e.amountHTG, 0),
  };
}
