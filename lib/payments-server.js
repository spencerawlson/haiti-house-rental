// Payments ledger (Phase 4) — manual, auditable, admin-approved.
//
// A landlord sends MonCash/NatCash to the admin-set number, then submits
// the transaction reference here. The admin checks it against the
// MonCash/NatCash statement and confirms or rejects it. Only a
// CONFIRMED payment activates an account or starts advertising; nothing
// is collected, refunded or activated automatically.
//
// - Prices come from lib/config.js and are never taken from the client.
// - A (provider, reference) pair can be submitted once across all users,
//   so one transfer cannot pay for two things.
// - Rows are never deleted; every status change is appended to `events`
//   with who did it and when.
// - Advertising: each confirmed month extends `advertised_until` from the
//   later of now and the current end date.
import { randomBytes } from 'crypto';
import { query } from './db';
import { ACTIVATION_FEE_HTG, ADVERTISED_FEE_HTG_MONTH, PAYMENT_PROVIDERS, JOIN_FEE_HTG, QUARTER_FEE_HTG, REACTIVATION_FEE_HTG } from './config';
import { applyBillingPayment, dueKindFor } from './billing-server';
import { logActivation } from './revenue-server';

export const AD_MONTH_OPTIONS = [1, 3, 6, 12];

// Subscription payments. Prices come from config and are never taken
// from the client.
export const BILLING_KINDS = ['join', 'quarter', 'reactivation'];
const BILLING_FEES = {
  join: JOIN_FEE_HTG,
  quarter: QUARTER_FEE_HTG,
  reactivation: REACTIVATION_FEE_HTG,
};

function mapPayment(r) {
  return {
    id: r.id,
    username: r.username,
    kind: r.kind,
    listingId: r.listing_id || null,
    months: r.months || null,
    provider: r.provider,
    reference: r.reference,
    amountHTG: r.amount_htg,
    status: r.status,
    note: r.review_note || '',
    events: Array.isArray(r.events) ? r.events : [],
    submittedAt: Number(r.submitted_at),
    reviewedAt: r.reviewed_at ? Number(r.reviewed_at) : null,
    reviewedBy: r.reviewed_by || null,
  };
}

// MonCash/NatCash references are typed by hand: compare without spaces,
// dashes or case.
export function normalizeReference(ref) {
  return String(ref || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40);
}

export async function submitPayment({ account, kind, provider, reference, listing, months }) {
  if (!PAYMENT_PROVIDERS.includes(provider)) return { error: 'invalid_provider' };
  const ref = normalizeReference(reference);
  if (ref.length < 4) return { error: 'invalid_reference' };
  let amount;
  if (BILLING_KINDS.includes(kind)) {
    // The server decides what is owed from the account's own state; a
    // client cannot choose to pay the cheaper one.
    const due = dueKindFor(account);
    if (!due) return { error: 'not_applicable' };
    if (kind !== due) return { error: 'wrong_kind' };
    const { rows } = await query(
      `SELECT 1 FROM payments WHERE username = $1 AND kind = ANY($2) AND status = 'pending'`,
      [account.username, BILLING_KINDS],
    );
    if (rows.length > 0) return { error: 'already_pending' };
    amount = BILLING_FEES[kind];
  } else if (kind === 'activation') {
    // Pre-subscription flow, kept so a payment submitted before the
    // change can still be reviewed.
    if (account.role !== 'landlord' || account.partner) return { error: 'not_applicable' };
    if (account.activated) return { error: 'already_active' };
    const { rows } = await query(
      `SELECT 1 FROM payments WHERE username = $1 AND kind = 'activation' AND status = 'pending'`,
      [account.username],
    );
    if (rows.length > 0) return { error: 'already_pending' };
    amount = ACTIVATION_FEE_HTG;
  } else if (kind === 'advertising') {
    if (!listing || listing.owner !== account.username || listing.status !== 'active') return { error: 'not_allowed' };
    if (!AD_MONTH_OPTIONS.includes(months)) return { error: 'invalid_months' };
    amount = ADVERTISED_FEE_HTG_MONTH * months;
  } else {
    return { error: 'invalid_kind' };
  }
  const now = Date.now();
  const events = [{ at: now, by: account.username, action: 'submitted' }];
  try {
    const { rows } = await query(
      `INSERT INTO payments (id, username, kind, listing_id, months, provider, reference, amount_htg, status, events, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9::jsonb,$10) RETURNING *`,
      [`pay-${randomBytes(10).toString('hex')}`, account.username, kind, listing?.id || null, kind === 'advertising' ? months : null, provider, ref, amount, JSON.stringify(events), now],
    );
    if (kind === 'activation') {
      // Keep the old flag in step so older screens still show "waiting".
      await query('UPDATE accounts SET transfer_sent = TRUE, transfer_provider = $2 WHERE username = $1', [account.username, provider]);
    }
    if (kind === 'advertising') {
      await query('UPDATE listings SET advertised_requested = TRUE WHERE id = $1', [listing.id]);
    }
    return { payment: mapPayment(rows[0]) };
  } catch (e) {
    if (e.code === '23505') return { error: 'duplicate_reference' };
    throw e;
  }
}

export async function listPaymentsForUser(username) {
  const { rows } = await query('SELECT * FROM payments WHERE username = $1 ORDER BY submitted_at DESC', [username]);
  return rows.map(mapPayment);
}

export async function listPayments(status) {
  const { rows } = await query(
    `SELECT p.*, a.name AS account_name, a.phone AS account_phone, l.title AS listing_title
     FROM payments p
     LEFT JOIN accounts a ON a.username = p.username
     LEFT JOIN listings l ON l.id = p.listing_id
     ${status ? 'WHERE p.status = $1' : ''}
     ORDER BY p.submitted_at DESC LIMIT 500`,
    status ? [status] : [],
  );
  return rows.map((r) => ({ ...mapPayment(r), accountName: r.account_name, accountPhone: r.account_phone, listingTitle: r.listing_title }));
}

function addMonths(ms, months) {
  const d = new Date(ms);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.getTime();
}

// Confirm or reject a pending payment. The status flip is a single
// conditional UPDATE, so two admins (or a double click) can never apply
// the same payment twice.
export async function reviewPayment(id, decision, note, reviewer = 'admin') {
  if (decision !== 'confirmed' && decision !== 'rejected') return { error: 'invalid_decision' };
  const now = Date.now();
  const event = JSON.stringify([{ at: now, by: reviewer, action: decision, note: note || undefined }]);
  const { rows } = await query(
    `UPDATE payments SET status = $2, reviewed_at = $3, reviewed_by = $4, review_note = $5, events = events || $6::jsonb
     WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id, decision, now, reviewer, String(note || '').slice(0, 500), event],
  );
  if (!rows[0]) return { error: 'not_pending' };
  const p = mapPayment(rows[0]);
  if (decision === 'confirmed') {
    if (BILLING_KINDS.includes(p.kind)) {
      const acc = await applyBillingPayment(p.username, p.kind);
      // The first payment of all is what the revenue roster records.
      if (acc && p.kind === 'join') {
        await logActivation({ username: acc.username, name: acc.name, role: acc.role, partner: acc.partner });
      }
    } else if (p.kind === 'activation') {
      const { rows: acc } = await query('UPDATE accounts SET activated = TRUE WHERE username = $1 RETURNING *', [p.username]);
      if (acc[0]) await logActivation({ username: acc[0].username, name: acc[0].name, role: acc[0].role, partner: acc[0].partner });
    } else if (p.kind === 'advertising') {
      const { rows: l } = await query('SELECT advertised_until FROM listings WHERE id = $1', [p.listingId]);
      const from = Math.max(now, Number(l[0]?.advertised_until || 0));
      const until = addMonths(from, p.months);
      await query(
        `UPDATE listings SET advertised = TRUE, advertised_requested = FALSE,
           advertised_since = COALESCE(CASE WHEN advertised_until IS NULL OR advertised_until < $3 THEN $3 END, advertised_since, $3),
           advertised_until = $2
         WHERE id = $1`,
        [p.listingId, until, now],
      );
    }
  } else if (p.kind === 'activation' || BILLING_KINDS.includes(p.kind)) {
    // Rejected: the landlord can submit a corrected reference. Nothing
    // about their subscription changes — a rejected payment must not
    // suspend anybody, and must not extend anybody either.
    await query('UPDATE accounts SET transfer_sent = FALSE WHERE username = $1 AND activated = FALSE', [p.username]);
  }
  return { payment: p };
}

// Confirmed vs pending money, by kind. Activations approved before this
// ledger existed (revenue_entries without a payment row) count as
// confirmed "legacy" activations so the total stays complete.
export async function paymentSummary() {
  const { rows } = await query(
    `SELECT kind, status, COUNT(*)::int AS n, COALESCE(SUM(amount_htg), 0)::int AS total FROM payments GROUP BY kind, status`,
  );
  const { rows: legacy } = await query(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(amount_htg), 0)::int AS total FROM revenue_entries r
     WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.username = r.username AND p.kind = 'activation' AND p.status = 'confirmed')`,
  );
  const sum = (status, kind) => rows.filter((r) => r.status === status && (!kind || r.kind === kind)).reduce((s, r) => s + r.total, 0);
  return {
    confirmedHTG: sum('confirmed') + legacy[0].total,
    pendingHTG: sum('pending'),
    rejectedHTG: sum('rejected'),
    byKind: {
      activation: { confirmedHTG: sum('confirmed', 'activation') + legacy[0].total, pendingHTG: sum('pending', 'activation') },
      advertising: { confirmedHTG: sum('confirmed', 'advertising'), pendingHTG: sum('pending', 'advertising') },
      join: { confirmedHTG: sum('confirmed', 'join'), pendingHTG: sum('pending', 'join') },
      quarter: { confirmedHTG: sum('confirmed', 'quarter'), pendingHTG: sum('pending', 'quarter') },
      reactivation: { confirmedHTG: sum('confirmed', 'reactivation'), pendingHTG: sum('pending', 'reactivation') },
    },
    legacyActivations: legacy[0].n,
  };
}
