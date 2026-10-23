// Visit appointments — Postgres (since Oct 2026). A tenant proposes a
// date + time to see a home; the other side confirms or declines. The
// same appointment is visible to both sides: on the listing page and in
// each party's Account → My visits.
//
// Phase 2: dates/times are checked on the server (Haiti time, today to
// 180 days ahead, 06:00–20:00 on the half hour); either side can cancel
// or propose a new time (reschedule), and the side that did NOT propose
// the current time is the one who confirms. Every change is appended to
// `history`. One active (proposed/confirmed) visit per tenant per home.
import { query } from './db';
import { getListing } from './listings-server';
import { clearVisitReminders } from './reminders-server';
import { haitiToday } from './haiti-day';

const ACTIVE = ['proposed', 'confirmed'];
const MAX_DAYS_AHEAD = 180;

function mapVisit(r) {
  return {
    id: r.id,
    listingId: r.listing_id,
    listingTitle: r.listing_title,
    owner: r.owner,
    tenant: r.tenant,
    date: r.date,
    time: r.time,
    message: r.message,
    status: r.status,
    proposedBy: r.proposed_by || 'tenant',
    history: Array.isArray(r.history) ? r.history : [],
    createdAt: Number(r.created_at),
    updatedAt: r.updated_at ? Number(r.updated_at) : Number(r.created_at),
  };
}

export { haitiToday };

// Returns an error code or null. Slots: 06:00..20:00, every 30 minutes.
export function validateSlot(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return 'invalid_date';
  if (!/^\d{2}:\d{2}$/.test(String(time))) return 'invalid_time';
  const today = haitiToday();
  if (date < today) return 'past_date';
  const max = new Date(Date.parse(`${today}T00:00:00Z`) + MAX_DAYS_AHEAD * 86400000).toISOString().slice(0, 10);
  if (date > max) return 'too_far';
  const [h, m] = time.split(':').map(Number);
  if (h < 6 || h > 20 || (h === 20 && m > 0) || (m !== 0 && m !== 30)) return 'outside_hours';
  return null;
}

export async function createVisit({ listingId, tenant, date, time, message }) {
  const listing = await getListing(listingId);
  if (!listing || listing.status !== 'active') return { error: 'not_found' };
  const slotError = validateSlot(date, time);
  if (slotError) return { error: slotError };
  const { rows: active } = await query(
    `SELECT id FROM visits WHERE listing_id = $1 AND tenant = $2 AND status = ANY($3)`,
    [listingId, tenant, ACTIVE],
  );
  if (active.length > 0) return { error: 'already_requested' };
  const now = Date.now();
  const id = `visit-${now}-${Math.random().toString(36).slice(2, 8)}`;
  const history = [{ at: now, by: tenant, action: 'proposed', date, time }];
  const { rows } = await query(
    `INSERT INTO visits (id, listing_id, listing_title, owner, tenant, date, time, message, status, proposed_by, history, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'proposed','tenant',$9::jsonb,$10,$10) RETURNING *`,
    [id, listingId, listing.title, listing.owner || null, tenant, date, time, message || '', JSON.stringify(history), now],
  );
  return { visit: mapVisit(rows[0]) };
}

export async function listVisitsForListing(listingId) {
  const { rows } = await query('SELECT * FROM visits WHERE listing_id = $1 ORDER BY created_at ASC', [listingId]);
  return rows.map(mapVisit);
}

// Visits where the user is the tenant, or the owner of the listing.
export async function listVisitsForUser(username) {
  const { rows } = await query(
    'SELECT * FROM visits WHERE tenant = $1 OR owner = $1 ORDER BY created_at ASC',
    [username],
  );
  return rows.map(mapVisit);
}

// action: confirm | decline | cancel | reschedule (with date + time).
// Returns { visit } or { error, status }.
export async function updateVisit(id, username, { action, date, time }) {
  const { rows } = await query('SELECT * FROM visits WHERE id = $1', [id]);
  const v = rows[0];
  if (!v) return { error: 'not_found', status: 404 };
  const role = v.owner && v.owner === username ? 'owner' : v.tenant === username ? 'tenant' : null;
  if (!role) return { error: 'not_allowed', status: 403 };
  const proposedBy = v.proposed_by || 'tenant';
  let set;
  if (action === 'confirm' || action === 'decline') {
    // The side that proposed the current time cannot answer its own proposal.
    if (v.status !== 'proposed' || role === proposedBy) return { error: 'not_allowed', status: 403 };
    set = { status: action === 'confirm' ? 'confirmed' : 'declined' };
  } else if (action === 'cancel') {
    if (!ACTIVE.includes(v.status)) return { error: 'not_active', status: 400 };
    set = { status: 'cancelled' };
  } else if (action === 'reschedule') {
    if (!ACTIVE.includes(v.status)) return { error: 'not_active', status: 400 };
    const slotError = validateSlot(date, time);
    if (slotError) return { error: slotError, status: 400 };
    set = { status: 'proposed', proposed_by: role, date, time };
  } else {
    return { error: 'invalid_action', status: 400 };
  }
  const now = Date.now();
  const entry = { at: now, by: username, action: action === 'confirm' ? 'confirmed' : action === 'decline' ? 'declined' : action === 'cancel' ? 'cancelled' : 'rescheduled', ...(set.date ? { date: set.date, time: set.time } : {}) };
  const { rows: updated } = await query(
    `UPDATE visits SET status = $2, proposed_by = $3, date = $4, time = $5, updated_at = $6,
       history = history || $7::jsonb
     WHERE id = $1 RETURNING *`,
    [id, set.status, set.proposed_by || proposedBy, set.date || v.date, set.time || v.time, now, JSON.stringify([entry])],
  );
  // A rescheduled visit is a different appointment: drop the record of
  // reminders already sent so the new date gets its own set. (Cancel and
  // decline need no reset — the job only looks at confirmed visits.)
  if (action === 'reschedule') await clearVisitReminders(id);
  return { visit: mapVisit(updated[0]) };
}
