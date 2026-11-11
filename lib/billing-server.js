// Billing lifecycle — RETIRED (free forever since Nov 2026).
//
// Kay Ayiti used to charge landlords (and, briefly, furniture sellers)
// a joining fee plus a quarterly fee, with a pending → active →
// suspended → deactivated lifecycle driven by the scheduled job. That
// is gone: every account is free, activated immediately, and never
// expires (paid_until = NULL for all roles, not just tenants and
// partners). No fee is charged, no promo cap applies, and no new
// expiry may ever be introduced.
//
// What stays, as dead/admin tools rather than a live lifecycle:
// sweepBilling, sendDueReminders and setBillingStatus are kept (the
// admin billing override in setBillingStatus is retained), and
// applyBillingPayment still applies an in-flight confirmed payment —
// but now only ever with paid_until = NULL.
//
// One rule still holds: `activated` is the only permission gate.
// Every existing permission check reads `activated` — posting,
// uploads, the account page — so it enforces itself through code
// that is already tested.
import { query } from './db';
import { QUARTER_MONTHS, SUSPENSION_GRACE_DAYS, billingFeesFor, quarterMs, graceMs, dueReminderMs } from './config';

// Roles that used to share the billing lifecycle (landlords and,
// since Nov 2026, furniture sellers). Kept only because the retired
// sweep/reminder helpers below still reference the list.
const PAID_ROLES = ['landlord', 'seller'];
import { notify } from './notify-server';
import { bumpMetric } from './traffic-server';
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

// Which payment an account may make next, and nothing else.
// Billing is retired (free forever since Nov 2026): no account owes
// anything, so there is never a due kind.
export function dueKindFor(account) {
  return null;
}

// Apply a CONFIRMED payment. Called from reviewPayment, never from a
// request the payer controls.
export async function applyBillingPayment(username, kind, q = query) {
  const { rows } = await q('SELECT * FROM accounts WHERE username = $1', [username]);
  const a = rows[0];
  if (!a) return null;
  // Free forever (Nov 2026): an in-flight confirmed payment still
  // activates the account, but it must never introduce an expiry —
  // paid_until stays NULL, so the account does not expire.
  const until = null;
  const { rows: updated } = await q(
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
       AND role = ANY($2) AND partner = FALSE
     RETURNING username`,
    [now, PAID_ROLES],
  );
  for (const r of toSuspend) {
    result.suspended.push(r.username);
    notify(r.username, 'billing_suspended', { days: SUSPENSION_GRACE_DAYS }, { link: '/ht/account' });
    log('warn', 'billing.suspended', { username: r.username });
  }
  // Counted here because this is the only moment the event exists: the
  // sweep sets suspended_at and a later sweep overwrites it, so "how many
  // lapsed last Tuesday" is unanswerable unless it is counted on the day.
  await bumpMetric('subs_suspended', toSuspend.length);

  // Suspended too long -> deactivated, and the joining price applies again.
  const cutoff = now - graceMs();
  const { rows: toDeactivate } = await query(
    `UPDATE accounts SET billing_status = 'deactivated', activated = FALSE
     WHERE billing_status = 'suspended' AND suspended_at IS NOT NULL AND suspended_at < $1
       AND role = ANY($2) AND partner = FALSE
     RETURNING username`,
    [cutoff, PAID_ROLES],
  );
  for (const r of toDeactivate) {
    result.deactivated.push(r.username);
    notify(r.username, 'billing_deactivated', {}, { link: '/ht/account' });
    log('warn', 'billing.deactivated', { username: r.username });
  }
  await bumpMetric('subs_deactivated', toDeactivate.length);
  return result;
}

// "Your quarter ends soon." Sent once per billing period, a week before
// paid_until, to landlords who are still active — suspension takes their
// homes off the site, so it must never be the first they hear of it.
//
// Exactly-once comes from the claim in billing_reminders, keyed on the
// period_end being warned about. The job runs every five minutes; the
// claim is why that does not mean a reminder every five minutes. Renewing
// moves paid_until, so the next period earns its own reminder.
//
// The claim is taken BEFORE sending, so a crash loses a reminder rather
// than sending it twice — the same trade as the visit reminders, for the
// same reason: each SMS costs money.
export async function sendDueReminders({ now = Date.now() } = {}) {
  const horizon = now + dueReminderMs();
  const { rows } = await query(
    `SELECT username, role, paid_until FROM accounts
     WHERE billing_status = 'active' AND role = ANY($3) AND partner = FALSE
       AND paid_until IS NOT NULL AND paid_until > $1 AND paid_until <= $2
       AND (promo_until IS NULL OR promo_until <= $1)`,
    [now, horizon, PAID_ROLES],
  );
  const sent = [];
  for (const r of rows) {
    const periodEnd = Number(r.paid_until);
    const { rowCount } = await query(
      `INSERT INTO billing_reminders (username, period_end, kind, sent_at) VALUES ($1,$2,'due_soon',$3)
       ON CONFLICT (username, period_end, kind) DO NOTHING`,
      [r.username, periodEnd, now],
    );
    if (rowCount !== 1) continue; // already warned for this period
    const days = Math.max(1, Math.ceil((periodEnd - now) / 86400000));
    // The reminder amount is per role: a seller's quarter is 500 HTG,
    // not the landlord's 1000 — quoting the wrong fee is how an
    // account gets suspended over a payment it already made in full.
    notify(
      r.username,
      'billing_due_soon',
      { days, amount: billingFeesFor(r.role).quarter.toLocaleString('en-US'), date: new Date(periodEnd).toISOString().slice(0, 10) },
      { link: '/ht/account' },
    );
    sent.push({ username: r.username, periodEnd });
    log('info', 'billing.due_reminder', { username: r.username, periodEnd, days });
  }
  return sent;
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
         paid_until = CASE WHEN $2 = 'active' THEN NULL ELSE paid_until END
     WHERE username = $1 RETURNING *`,
    [username, status, active, Date.now()],
  );
  return rows[0] || null;
}
