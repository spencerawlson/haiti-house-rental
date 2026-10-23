// Landlord subscription lifecycle.
//
//   pending ──join paid──▶ active ──quarter runs out──▶ suspended
//                            ▲                              │
//                            └──────quarter paid────────────┘
//                                                           │ 30 days
//                                                           ▼
//                                                      deactivated
//                                                           │
//                                                reactivation paid
//                                                           └──▶ active
//
// Two rules hold this together:
//
// 1. `activated` is kept in step with billing_status, and is TRUE only
//    when the status is 'active'. Every existing permission check reads
//    `activated` — posting, uploads, the account page — so suspension
//    enforces itself through code that is already tested. Adding a
//    second rule next to the first is how one of them gets forgotten.
//
// 2. Time is only ever ADDED from the later of now and the current
//    paid_until, so paying early never loses the days already bought,
//    and paying late never back-dates the next quarter into the past.
//
// paid_until = NULL means "does not expire": tenants, who are free, and
// partner accounts the admin created. The sweep cannot touch them.
import { query } from './db';
import { QUARTER_MONTHS, SUSPENSION_GRACE_DAYS, quarterMs, graceMs } from './config';
import { notify } from './notify-server';
import { log } from './log';

export const BILLING_STATUSES = ['pending', 'active', 'suspended', 'deactivated'];

// Three CALENDAR months, so a renewal lands on the same day of the month
// rather than drifting by 90 days. The tests override the period with a
// few seconds (BILLING_QUARTER_MS) to exercise expiry for real.
function nextPeriodEnd(fromMs) {
  const override = quarterMs();
  if (override) return fromMs + override;
  const d = new Date(fromMs);
  d.setUTCMonth(d.getUTCMonth() + QUARTER_MONTHS);
  return d.getTime();
}

// Which payment an account may make next, and nothing else. Returning a
// single answer (rather than a list) keeps the UI and the server from
// disagreeing about what is owed.
export function dueKindFor(account) {
  if (!account || account.role !== 'landlord' || account.partner) return null;
  switch (account.billingStatus) {
    case 'pending': return 'join';
    case 'active': return 'quarter';     // renew early, or top up
    case 'suspended': return 'quarter';  // pay the quarter to come back
    case 'deactivated': return 'reactivation';
    default: return null;
  }
}

// Apply a CONFIRMED payment. Called from reviewPayment, never from a
// request the payer controls.
export async function applyBillingPayment(username, kind) {
  const { rows } = await query('SELECT * FROM accounts WHERE username = $1', [username]);
  const a = rows[0];
  if (!a) return null;
  const now = Date.now();
  // Never shorten a period already paid for.
  const from = Math.max(now, Number(a.paid_until || 0));
  const until = nextPeriodEnd(from);
  const { rows: updated } = await query(
    `UPDATE accounts
     SET billing_status = 'active', activated = TRUE, paid_until = $2, suspended_at = NULL
     WHERE username = $1 RETURNING *`,
    [username, until],
  );
  log('info', 'billing.paid', { username, kind, paidUntil: until });
  return updated[0] || null;
}

// The scheduled job. Moves accounts whose time is up, and tells them.
// Safe to run repeatedly: each UPDATE is conditional on the state it is
// moving out of, so a second run in the same minute changes nothing.
export async function sweepBilling({ now = Date.now() } = {}) {
  const result = { suspended: [], deactivated: [] };

  // Quarter ran out -> suspended. paid_until IS NULL is exempt by
  // definition (tenants, partners).
  const { rows: toSuspend } = await query(
    `UPDATE accounts SET billing_status = 'suspended', activated = FALSE, suspended_at = $1
     WHERE billing_status = 'active' AND paid_until IS NOT NULL AND paid_until < $1
       AND role = 'landlord' AND partner = FALSE
     RETURNING username`,
    [now],
  );
  for (const r of toSuspend) {
    result.suspended.push(r.username);
    notify(r.username, 'billing_suspended', { days: SUSPENSION_GRACE_DAYS }, { link: '/ht/account' });
    log('warn', 'billing.suspended', { username: r.username });
  }

  // Suspended too long -> deactivated, and the joining price applies again.
  const cutoff = now - graceMs();
  const { rows: toDeactivate } = await query(
    `UPDATE accounts SET billing_status = 'deactivated', activated = FALSE
     WHERE billing_status = 'suspended' AND suspended_at IS NOT NULL AND suspended_at < $1
     RETURNING username`,
    [cutoff],
  );
  for (const r of toDeactivate) {
    result.deactivated.push(r.username);
    notify(r.username, 'billing_deactivated', {}, { link: '/ht/account' });
    log('warn', 'billing.deactivated', { username: r.username });
  }
  return result;
}

// Admin override: put an account back without a payment (a goodwill case,
// or fixing a mistake). Audited by the caller.
export async function setBillingStatus(username, status) {
  if (!BILLING_STATUSES.includes(status)) return null;
  const active = status === 'active';
  const { rows } = await query(
    `UPDATE accounts
     SET billing_status = $2,
         activated = $3,
         suspended_at = CASE WHEN $2 = 'suspended' THEN COALESCE(suspended_at, $4) ELSE NULL END,
         paid_until = CASE WHEN $2 = 'active' THEN COALESCE(paid_until, $5) ELSE paid_until END
     WHERE username = $1 RETURNING *`,
    [username, status, active, Date.now(), nextPeriodEnd(Date.now())],
  );
  return rows[0] || null;
}
