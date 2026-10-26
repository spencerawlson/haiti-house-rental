// Fraud flags: the admin review queue for accounts tenants reported.
//
// A flag is an OPEN report attributed to the account it accuses:
//   - a listing report accuses the listing's owner (a landlord),
//   - a conversation report accuses the OTHER participant (a landlord
//     reporting a thread accuses the tenant; a tenant reporting a thread
//     accuses the landlord).
// Flag count = number of open reports on the account; message = the
// latest open report's text. Resolved reports drop out of the table —
// the table is a review queue, not a permanent record; the reports
// queue keeps the full history.
//
// Flags never suspend anything by themselves. Suspension is a separate
// admin action here, and it is deliberately separate from billing:
// fraud_suspended lives on its own columns (migration 0021) so paying a
// bill can never lift it and it can never touch billing_status.
// Suspending revokes every session at once (Stage 1 found suspended
// accounts kept valid sessions); the sign-in gate then decides re-entry:
// tenants are refused with the suspension notice, landlords are let in
// so they can see the notice and the appeal path.
import { query } from './db';
import { audit } from './audit';
import { getServerAccount } from './accounts-server';
import { destroyAllSessions } from './session-server';

export async function listFlaggedAccounts() {
  const { rows: open } = await query(
    `SELECT id, kind, target_id, listing_id, reporter, details, created_at FROM reports WHERE status = 'open' ORDER BY created_at ASC`,
  );
  const accused = new Map(); // username -> { flagCount, message, latestAt }
  const listingOwners = new Map();
  const conversations = new Map();
  for (const r of open) {
    let who = null;
    if (r.kind === 'listing' && r.listing_id) {
      if (!listingOwners.has(r.listing_id)) {
        const { rows } = await query('SELECT owner FROM listings WHERE id = $1', [r.listing_id]);
        listingOwners.set(r.listing_id, rows[0]?.owner || null);
      }
      who = listingOwners.get(r.listing_id);
    } else if (r.kind === 'conversation' && r.target_id) {
      if (!conversations.has(r.target_id)) {
        const { rows } = await query('SELECT tenant, landlord FROM conversations WHERE id = $1', [r.target_id]);
        conversations.set(r.target_id, rows[0] || null);
      }
      const conv = conversations.get(r.target_id);
      if (conv) who = r.reporter === conv.tenant ? conv.landlord : conv.tenant;
    }
    // Unresolvable reports (deleted listing, landlord-less thread) stay
    // in the reports queue for review; they cannot name an account here.
    if (!who) continue;
    const prev = accused.get(who);
    if (!prev || r.created_at >= prev.latestAt) {
      accused.set(who, { flagCount: (prev?.flagCount || 0) + 1, message: r.details || '', latestAt: r.created_at });
    } else {
      prev.flagCount += 1;
    }
  }
  if (accused.size === 0) return [];
  const names = [...accused.keys()];
  const { rows: accounts } = await query(
    `SELECT username, name, id, role, fraud_suspended FROM accounts WHERE username = ANY($1)`,
    [names],
  );
  const byUsername = new Map(accounts.map((a) => [a.username, a]));
  const flags = [];
  for (const [username, agg] of accused) {
    const a = byUsername.get(username);
    if (!a) continue; // account deleted since the report; queue keeps it
    flags.push({
      username, name: a.name, id: a.id, role: a.role,
      fraudSuspended: a.fraud_suspended === true,
      flagCount: agg.flagCount, message: agg.message, latestAt: agg.latestAt,
    });
  }
  flags.sort((x, y) => y.flagCount - x.flagCount || y.latestAt - x.latestAt);
  return flags;
}

export async function suspendAccountForFraud(username, reason) {
  const existing = await getServerAccount(username);
  if (!existing) return null;
  await query(
    `UPDATE accounts SET fraud_suspended = TRUE, fraud_suspended_at = $2, fraud_reason = $3, fraud_suspended_by = 'admin' WHERE username = $1`,
    [username, Date.now(), reason],
  );
  await destroyAllSessions(username);
  await audit('admin', 'account.fraud_suspended', username, { reason });
  return getServerAccount(username);
}

export async function reactivateAccountForFraud(username) {
  const existing = await getServerAccount(username);
  if (!existing) return null;
  // Only the boolean flips: the last reason and date stay as history,
  // and billing is never touched here.
  await query(`UPDATE accounts SET fraud_suspended = FALSE WHERE username = $1`, [username]);
  await audit('admin', 'account.fraud_reactivated', username);
  return getServerAccount(username);
}
