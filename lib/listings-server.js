// Server-only listing store — Postgres (since Oct 2026). Imported only
// by API routes, server pages and other server modules, never by client
// components: importing pg into a browser bundle breaks the build (pg
// needs Node builtins). Pure helpers (matching, filtering, sorting) stay
// in lib/listings.js, which client components can import safely.
import { query, getPool } from './db';
import { resolveDepartmentId, resolveCommune } from './listings';
import { sanitizeDetails } from './listing-details';
import { SOLD_STATUSES, soldDeleteAfterMs } from './config';

// Demo listings (the 7 seeded at first boot) are hidden from the public
// (Oct 2026, Spencer's decision): they looked like real homes. The rows
// stay in the database; SHOW_DEMO_LISTINGS=true shows them again, e.g.
// for a local preview. Hidden seeds report status 'hidden', so every
// path that requires an active listing (detail, chat, visits, reports,
// payments) treats them as gone.
export function showDemoListings() {
  return process.env.SHOW_DEMO_LISTINGS === 'true';
}

// `soldAt` / `deletesAt` are NOT part of the public shape. A sold home
// stays on the site with its tag, but the 48-hour countdown is the
// landlord's business — a tenant has no reason to watch a clock on
// someone else's home. ownerView() adds them for the library.
// (`views` used to be owner-only too; since 2026-10-24 it is public, in
// mapListing, so everyone sees how much a home is being looked at.)
export function ownerView(r, mapped) {
  return {
    ...mapped,
    soldAt: r.sold_at ? Number(r.sold_at) : null,
    deletesAt: r.sold_at ? Number(r.sold_at) + soldDeleteAfterMs() : null,
  };
}

function mapListing(r) {
  return {
    // Public since 2026-10-24 (Spencer): everyone sees how many times a
    // home was looked at — an incentive for landlords and a signal for
    // tenants. Counted by /api/listings/view (never the owner, once per
    // viewer per half hour).
    views: Number(r.views || 0),
    id: r.id,
    type: r.type,
    department: r.department,
    commune: r.commune,
    address: r.address || '',
    price: Number(r.price),
    currency: r.currency || 'HTG',
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    areaM2: r.area_m2,
    title: r.title,
    description: r.description,
    photos: r.photos || [],
    videos: r.videos || [],
    purpose: r.purpose,
    // Advertising ends by itself when the paid period passes.
    advertised: (() => {
      // Display rule: a campaign shows only while it has a term, that
      // term is unspent, and it is not paused. Legacy month-based ads
      // carry advertised_until and no budgets; budget ads carry budgets
      // and no end date. A flag with neither term shows nothing, so an
      // admin toggle alone can never create a free ad.
      if (r.advertised !== true) return false;
      const untilOk = !r.advertised_until || Number(r.advertised_until) > Date.now();
      const budgetSet = r.ad_views_budget != null || r.ad_clicks_budget != null;
      const hasTerm = r.advertised_until != null || budgetSet;
      const exhausted = (r.ad_views_budget != null && r.ad_views_used >= r.ad_views_budget)
        || (r.ad_clicks_budget != null && r.ad_clicks_used >= r.ad_clicks_budget);
      return hasTerm && untilOk && !r.ad_paused && !exhausted;
    })(),
    // Campaign state for the owner and the admin. The budgets and the
    // counters themselves are NEVER in this public shape — only the
    // admin stats endpoint reveals them.
    adCampaign: r.advertised === true,
    adPaused: r.ad_paused === true,
    adEnded: (r.ad_views_budget != null || r.ad_clicks_budget != null)
      && ((r.ad_views_budget != null && r.ad_views_used >= r.ad_views_budget)
        || (r.ad_clicks_budget != null && r.ad_clicks_used >= r.ad_clicks_budget)),
    // What the landlord sees: the money left on this campaign. The
    // views/clicks math behind it stays hidden — only the balance
    // shows, and it reaches zero exactly when either budget is spent.
    // Pausing freezes it, since a paused ad consumes nothing.
    adBalanceHTG: (() => {
      if (r.ad_amount_htg == null) return null;
      const frac = (budget, used) => (budget == null ? 1 : (budget <= 0 ? 0 : Math.max(0, (budget - used) / budget)));
      return Math.floor(Number(r.ad_amount_htg) * Math.min(frac(r.ad_views_budget, r.ad_views_used), frac(r.ad_clicks_budget, r.ad_clicks_used)));
    })(),
    advertisedSince: r.advertised_since ? Number(r.advertised_since) : null,
    advertisedUntil: r.advertised_until ? Number(r.advertised_until) : null,
    advertisedRequested: r.advertised_requested,
    status: r.seed_order !== null && r.seed_order !== undefined && !showDemoListings() ? 'hidden' : r.status || 'active',
    lat: r.lat,
    lng: r.lng,
    owner: r.owner,
    rentPeriod: r.rent_period,
    details: r.details || {},
    verified: r.verified === true,
    seed: r.seed_order !== null && r.seed_order !== undefined,
    createdAt: Number(r.created_at),
  };
}

export async function getListings() {
  // Due auto-deletions happen here: this is the busiest query in the app.
  await sweepSoldListings().catch(() => {});
  // Sold and leased homes stay listed, carrying their tag: people can see
  // that the home is gone (and that homes do move here) instead of it
  // vanishing silently. They are not contactable — chat and visits both
  // require an active listing — and the sweep removes them after 48 h.
  // A landlord who stops paying stops being listed: the subscription is
  // what keeps a home on the site. Joined on `activated`, which
  // lib/billing-server.js keeps in step with billing_status, so there is
  // one rule rather than two. Homes with no owner (the demo seeds) are
  // unaffected, and the landlord still sees everything in their library.
  const { rows } = await query(
    `SELECT l.* FROM listings l
     LEFT JOIN accounts a ON a.username = l.owner
     WHERE l.status IN ('active', 'sold', 'leased')
       AND (l.seed_order IS NULL OR $1)
       AND (l.owner IS NULL OR a.activated = TRUE)
     ORDER BY CASE WHEN l.seed_order IS NULL THEN 0 ELSE 1 END, l.created_at DESC, l.seed_order ASC, l.id ASC`,
    [showDemoListings()],
  );
  return rows.map(mapListing);
}

// Every listing a landlord ever posted, live or taken down — the
// library view. Newest first.
// The sold countdown is attached HERE: this is the only query whose
// result is shown exclusively to the person who owns the homes. Putting
// it in mapListing() would leak every sold home's deletion clock through
// public /api/listings. (The view count is public — see mapListing.)
export async function getListingsForOwner(owner) {
  // So a landlord opening their library sees the truth, not a home that
  // should already be gone.
  await sweepSoldListings().catch(() => {});
  const { rows } = await query(
    `SELECT * FROM listings WHERE owner = $1 ORDER BY created_at DESC`,
    [owner],
  );
  return rows.map((r) => ownerView(r, mapListing(r)));
}

export async function getListing(id) {
  const { rows } = await query('SELECT * FROM listings WHERE id = $1', [id]);
  return rows[0] ? mapListing(rows[0]) : null;
}

// The same listing, but only if the public may see it: a home whose
// landlord has stopped paying is off the site by direct link too, not
// just missing from search.
//
// Deliberately a SEPARATE function rather than a filter inside
// getListing(): every internal caller — chat, visits, payments, takedown,
// the landlord's own library — must keep working for a suspended owner,
// or a lapsed subscription would also lock a landlord out of managing
// their own home and answering the people who wrote to them.
export async function getPublicListing(id) {
  const { rows } = await query(
    `SELECT l.* FROM listings l
     LEFT JOIN accounts a ON a.username = l.owner
     WHERE l.id = $1 AND (l.owner IS NULL OR a.activated = TRUE)`,
    [id],
  );
  return rows[0] ? mapListing(rows[0]) : null;
}

export async function setAdvertised(id, value) {
  const { rows } = await query(
    `UPDATE listings SET advertised = $2, advertised_requested = CASE WHEN $2 THEN FALSE ELSE advertised_requested END,
       advertised_until = CASE WHEN $2 THEN advertised_until ELSE NULL END
     WHERE id = $1 RETURNING *`,
    [id, value === true],
  );
  return rows[0] ? mapListing(rows[0]) : null;
}

// Count one ad view (carousel card shown) or click (card tapped). The
// increment is atomic and guarded: it lands only while the campaign is
// displayable and the matching budget still has room, so a burst of
// requests can never overshoot the budget. Returns true when counted.
// Budgets are hidden from landlords, so these endpoints never return
// counts — only whether the hit landed.
async function recordAdEvent(id, column) {
  const budgetCol = column === 'ad_views_used' ? 'ad_views_budget' : 'ad_clicks_budget';
  const otherBudgetCol = column === 'ad_views_used' ? 'ad_clicks_budget' : 'ad_views_budget';
  const otherUsedCol = column === 'ad_views_used' ? 'ad_clicks_used' : 'ad_views_used';
  const { rows } = await query(
    `UPDATE listings SET ${column} = ${column} + 1
     WHERE id = $1 AND advertised = TRUE AND ad_paused = FALSE
       AND ${budgetCol} IS NOT NULL AND ${column} < ${budgetCol}
       AND (${otherBudgetCol} IS NULL OR ${otherUsedCol} < ${otherBudgetCol})
     RETURNING id`,
    [id],
  );
  return rows.length > 0;
}

export async function recordAdImpression(id) {
  return recordAdEvent(id, 'ad_views_used');
}

export async function recordAdClick(id) {
  return recordAdEvent(id, 'ad_clicks_used');
}

// Landlord self-serve pause/resume. Ownership is checked by the route;
// this only flips the flag — a paused campaign keeps its remaining
// budget, and resuming spends nothing extra.
export async function setAdPaused(id, paused) {
  const { rows } = await query(
    'UPDATE listings SET ad_paused = $2 WHERE id = $1 RETURNING *',
    [id, paused === true],
  );
  return rows[0] ? mapListing(rows[0]) : null;
}

// Admin-only numbers for one campaign. Never called from a public route.
export async function getAdStats(id) {
  const { rows } = await query(
    `SELECT id, title, owner, advertised, advertised_requested, ad_paused,
       ad_amount_htg, ad_views_budget, ad_views_used, ad_clicks_budget, ad_clicks_used
     FROM listings WHERE id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    owner: r.owner,
    advertised: r.advertised,
    advertisedRequested: r.advertised_requested,
    paused: r.ad_paused === true,
    amountHTG: r.ad_amount_htg != null ? Number(r.ad_amount_htg) : null,
    viewsBudget: r.ad_views_budget != null ? Number(r.ad_views_budget) : null,
    viewsUsed: Number(r.ad_views_used || 0),
    clicksBudget: r.ad_clicks_budget != null ? Number(r.ad_clicks_budget) : null,
    clicksUsed: Number(r.ad_clicks_used || 0),
  };
}

export async function listAdStats() {
  const { rows } = await query(
    `SELECT id, title, owner, advertised, advertised_requested, ad_paused,
       ad_amount_htg, ad_views_budget, ad_views_used, ad_clicks_budget, ad_clicks_used
     FROM listings WHERE advertised = TRUE OR advertised_requested = TRUE
     ORDER BY title`,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    owner: r.owner,
    advertised: r.advertised,
    advertisedRequested: r.advertised_requested,
    paused: r.ad_paused === true,
    amountHTG: r.ad_amount_htg != null ? Number(r.ad_amount_htg) : null,
    viewsBudget: r.ad_views_budget != null ? Number(r.ad_views_budget) : null,
    viewsUsed: Number(r.ad_views_used || 0),
    clicksBudget: r.ad_clicks_budget != null ? Number(r.ad_clicks_budget) : null,
    clicksUsed: Number(r.ad_clicks_used || 0),
  }));
}

// Take down: hide an active listing from home, search and detail pages.
// The row (and its chats and visits) stays in the database, so a takedown
// is reversible later. Returns null when the listing is not active.
export async function setListingRemoved(id) {
  const { rows } = await query(
    `UPDATE listings SET status = 'removed' WHERE id = $1 AND status = 'active' RETURNING *`,
    [id],
  );
  return rows[0] ? mapListing(rows[0]) : null;
}

// Restore: put a taken-down home back online, or undo a sold/leased tag
// before its 48 hours run out. Clearing sold_at also cancels the pending
// auto-deletion. Returns null when the listing is already active.
export async function setListingActive(id, db = null) {
  const { rows } = await (db ? db.query.bind(db) : query)(
    `UPDATE listings SET status = 'active', sold_at = NULL
     WHERE id = $1 AND status IN ('removed', 'sold', 'leased') RETURNING *`,
    [id],
  );
  return rows[0] ? mapListing(rows[0]) : null;
}

// Mark a home sold or leased. It leaves search at once — nobody should
// spend mobile data opening a home that is gone — and sweepSoldListings()
// deletes it for good once soldDeleteAfterMs() has passed. That delay is
// also the undo window: setListingActive() brings it back until then.
//
// Re-tagging an already-tagged home (sold -> leased) does NOT restart the
// clock: sold_at is only set when it is still null, so a landlord cannot
// keep a sold home alive by re-tagging it.
export async function setListingSold(id, status) {
  if (!SOLD_STATUSES.includes(status)) return null;
  const { rows } = await query(
    `UPDATE listings SET status = $2, sold_at = COALESCE(sold_at, $3)
     WHERE id = $1 AND status IN ('active', 'removed', 'sold', 'leased') RETURNING *`,
    [id, status, Date.now()],
  );
  // Owner-only route, so the countdown it just scheduled comes back.
  return rows[0] ? ownerView(rows[0], mapListing(rows[0])) : null;
}

// Delete every sold/leased home whose 48 hours have passed.
//
// There is no scheduler in this app, so this runs opportunistically from
// the listing read paths, throttled to once a minute per process. The
// honest consequence: deletion happens on the first page view after the
// deadline, not at the exact minute. On a site with any traffic that is a
// difference of seconds; on a completely idle site a sold home waits for
// the next visitor. It is never deleted EARLY, which is the part that
// matters.
//
// Anything deleteListingForGood() refuses (a payment still pending
// review) is simply left for the next sweep.
let lastSweep = 0;

// Once a minute is plenty when the window is two days. The tests shorten
// the window to seconds, so the throttle follows it down — otherwise a
// test would sit waiting on a throttle far longer than the delay it is
// testing. Clamped to [1s, 60s].
function sweepThrottleMs() {
  return Math.min(60_000, Math.max(1_000, Math.floor(soldDeleteAfterMs() / 4)));
}

export async function sweepSoldListings({ force = false } = {}) {
  if (!force && Date.now() - lastSweep < sweepThrottleMs()) return [];
  lastSweep = Date.now();
  const { rows } = await query(
    `SELECT id FROM listings WHERE status IN ('sold', 'leased') AND sold_at IS NOT NULL AND sold_at <= $1`,
    [Date.now() - soldDeleteAfterMs()],
  );
  const deleted = [];
  for (const r of rows) {
    const result = await deleteListingForGood(r.id).catch(() => ({ error: 'failed' }));
    if (!result.error) deleted.push(result);
  }
  return deleted;
}

// Delete a listing for good: the row leaves the database and its uploaded
// photos and videos leave the disk. "Take down" was not enough — a
// taken-down home sits in the library forever with a "put back online"
// button, so a landlord ends up with a list of dead entries they cannot
// clear.
//
// This schema has NO foreign keys, so nothing stops a plain DELETE from
// orphaning five other tables. Each one is a deliberate decision:
//
//   KEPT     chat_messages, chat_reads, chat_hidden, conversations — each
//            side owns its own chat history. Deleting the home means the
//            LANDLORD leaves the conversation: it drops out of their
//            inbox, the tenant keeps every message and can still read
//            the thread, and nobody can write to it again. A landlord
//            tidying their library must not reach into a tenant's inbox
//            and erase what they wrote. (This used to delete them, which
//            took the tenant's history with it.)
//   KEPT     visits — the tenant's own record of an appointment. These
//            carry listing_title and are never joined to listings, so
//            they read correctly after the home is gone.
//   KEPT     payments — money is a ledger. A confirmed advertising
//            payment must stay counted in paymentSummary(). Its
//            listing_id is left dangling on purpose; the admin board
//            LEFT JOINs it, so the row shows with no title.
//   KEPT     reports — the moderation trail. If deleting a listing erased
//            its reports, the way to bury a reported listing would be to
//            delete it.
//   KEPT     audit_log — it records this deletion.
//
// Refuses while a payment for this listing is still pending: confirming
// it afterwards would extend the advertising of a home that no longer
// exists, i.e. charge for nothing.
//
// Returns { error } or { listing, removed, files } — `files` are the
// upload paths the caller should unlink once the transaction committed
// (file deletion cannot be rolled back, so it happens after).
// `removed.conversationsClosed` counts threads the landlord left.
export async function deleteListingForGood(id) {
  const { rows: found } = await query('SELECT * FROM listings WHERE id = $1', [id]);
  if (!found[0]) return { error: 'not_found' };
  const listing = mapListing(found[0]);

  const { rows: pending } = await query(
    `SELECT 1 FROM payments WHERE listing_id = $1 AND status = 'pending' LIMIT 1`,
    [id],
  );
  if (pending.length > 0) return { error: 'payment_pending' };

  const client = await getPool().connect();
  const removed = {};
  try {
    await client.query('BEGIN');
    // The landlord leaves the conversations; the tenant keeps them. The
    // title is pinned onto the conversation first, because the listing
    // row goes in the same transaction.
    const closed = await client.query(
      `UPDATE conversations
       SET listing_title = COALESCE(listing_title, $2), closed_at = COALESCE(closed_at, $3)
       WHERE listing_id = $1`,
      [id, listing.title || null, Date.now()],
    );
    removed.conversationsClosed = closed.rowCount;
    const gone = await client.query('DELETE FROM listings WHERE id = $1', [id]);
    removed.listing = gone.rowCount;
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  // Only unlink media this listing alone used. A URL shared with another
  // listing (a copied link) stays on disk.
  const mine = [...(listing.photos || []), ...(listing.videos || [])].filter(
    (u) => typeof u === 'string' && u.startsWith('/uploads/'),
  );
  const files = [];
  for (const url of mine) {
    const { rows } = await query(
      `SELECT 1 FROM listings WHERE photos @> $1::jsonb OR videos @> $1::jsonb LIMIT 1`,
      [JSON.stringify([url])],
    );
    if (rows.length === 0) files.push(url);
  }
  return { listing, removed, files };
}

// One more person opened this home's detail page. Called from
// /api/listings/view, which decides what counts (never the owner, once
// per viewer per half hour). Only ever increments an active listing, so a
// taken-down home cannot keep climbing.
export async function countListingView(id) {
  const { rowCount } = await query(
    `UPDATE listings SET views = views + 1 WHERE id = $1 AND status IN ('active', 'sold', 'leased')`,
    [id],
  );
  return rowCount > 0;
}

// Edit: the owner changes any field the creation form sets. Values pass
// through the same canonicalization and whitelists as creation, so an
// edit cannot smuggle in a bad type, purpose, period or place spelling.
export async function updateListing(id, data) {
  const fields = [];
  const push = (col, val, cast) => fields.push({ col, val, cast: cast || '' });
  if (typeof data.title === 'string') push('title', data.title.trim());
  if (typeof data.description === 'string') push('description', data.description.trim());
  if (data.department) push('department', resolveDepartmentId(data.department) || 'ouest');
  if (data.commune) push('commune', resolveCommune(data.commune));
  if (typeof data.address === 'string') push('address', data.address.trim().slice(0, 500));
  if (data.price !== undefined || data.priceHTG !== undefined) push('price', Number(data.price ?? data.priceHTG) || 0);
  if (['HTG', 'USD'].includes(data.currency)) push('currency', data.currency);
  if (data.bedrooms !== undefined) push('bedrooms', Number(data.bedrooms) || 0);
  if (data.bathrooms !== undefined) push('bathrooms', Number(data.bathrooms) || 0);
  if (data.areaM2 !== undefined) push('area_m2', Number(data.areaM2) || 0);
  if (['house', 'apartment', 'land'].includes(data.type)) push('type', data.type);
  if (data.purpose === 'sale' || data.purpose === 'rent') push('purpose', data.purpose);
  if (['monthly', 'quarterly', 'semiannual', 'annual'].includes(data.rentPeriod)) push('rent_period', data.rentPeriod);
  if (Array.isArray(data.photos)) push('photos', JSON.stringify(data.photos), '::jsonb');
  if (Array.isArray(data.videos)) push('videos', JSON.stringify(data.videos), '::jsonb');
  if (data.advertisedRequested !== undefined) push('advertised_requested', data.advertisedRequested === true);
  if (data.details !== undefined) push('details', JSON.stringify(sanitizeDetails(data.details)), '::jsonb');
  if (typeof data.lat === 'number') push('lat', data.lat);
  if (typeof data.lng === 'number') push('lng', data.lng);
  if (fields.length === 0) return null;
  const sets = fields.map((f, i) => `${f.col} = $${i + 1}${f.cast}`).join(', ');
  const vals = fields.map((f) => f.val);
  vals.push(id);
  const { rows } = await query(
    `UPDATE listings SET ${sets} WHERE id = $${vals.length} AND status = 'active' RETURNING *`,
    vals,
  );
  return rows[0] ? mapListing(rows[0]) : null;
}

// Listing limit (0015). An account's limit caps how many homes it may
// have LIVE at once (status 'active'); NULL means no limit. Counting and
// the change that adds a live home run in ONE transaction under a lock on
// that account, so two posts arriving together cannot both take the last
// slot. Returns { value } from `fn`, or { error: 'listing_limit', limit,
// used } without running it.
export async function withListingSlot(owner, fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('listing-limit:' || $1))", [owner]);
    const { rows: acc } = await client.query('SELECT listing_limit FROM accounts WHERE username = $1', [owner]);
    const limit = acc[0]?.listing_limit ?? null;
    if (limit !== null) {
      const { rows: c } = await client.query(`SELECT COUNT(*)::int AS n FROM listings WHERE owner = $1 AND status = 'active'`, [owner]);
      if (c[0].n >= limit) {
        await client.query('ROLLBACK');
        return { error: 'listing_limit', limit, used: c[0].n };
      }
    }
    const value = await fn(client);
    await client.query('COMMIT');
    return { value };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// { limit, used } for an account: what the landlord and the admin see.
export async function listingUsage(owner) {
  const { rows } = await query(
    `SELECT a.listing_limit,
       (SELECT COUNT(*)::int FROM listings l WHERE l.owner = a.username AND l.status = 'active') AS used
     FROM accounts a WHERE a.username = $1`,
    [owner],
  );
  return rows[0] ? { limit: rows[0].listing_limit ?? null, used: rows[0].used } : { limit: null, used: 0 };
}

// `db` lets withListingSlot run the insert inside its transaction.
export async function addListing(data, db = null) {
  const listing = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: ['house', 'apartment', 'land'].includes(data.type) ? data.type : 'house',
    department: resolveDepartmentId(data.department) || 'ouest',
    commune: resolveCommune(data.commune) || '',
    address: String(data.address || '').trim().slice(0, 500),
    // price is the amount in the listing's currency (priceHTG accepted
    // as a fallback for pages loaded before this change shipped).
    price: Number(data.price ?? data.priceHTG) || 0,
    currency: ['HTG', 'USD'].includes(data.currency) ? data.currency : 'HTG',
    bedrooms: Number(data.bedrooms) || 0,
    bathrooms: Number(data.bathrooms) || 0,
    title: String(data.title || '').trim(),
    description: String(data.description || '').trim(),
    photos: Array.isArray(data.photos) ? data.photos : [],
    videos: Array.isArray(data.videos) ? data.videos : [],
    purpose: data.purpose === 'sale' ? 'sale' : 'rent',
    advertised: false, // admin-approved only — never set from the public form
    advertisedRequested: data.advertisedRequested === true,
    areaM2: Number(data.areaM2) || 0,
    lat: typeof data.lat === 'number' ? data.lat : null,
    lng: typeof data.lng === 'number' ? data.lng : null,
    owner: typeof data.owner === 'string' && data.owner ? data.owner : null,
    rentPeriod: ['monthly', 'quarterly', 'semiannual', 'annual'].includes(data.rentPeriod) ? data.rentPeriod : 'monthly',
    createdAt: Date.now(),
  };
  if (!listing.title || !listing.commune) return null;
  const { rows } = await (db ? db.query.bind(db) : query)(
    `INSERT INTO listings (id, type, department, commune, price, currency, bedrooms, bathrooms, area_m2, title, description, photos, videos, purpose, advertised, advertised_requested, lat, lng, owner, rent_period, seed_order, created_at, details, address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18,$19,$20,NULL,$21,$22::jsonb,$23) RETURNING *`,
    [listing.id, listing.type, listing.department, listing.commune, listing.price, listing.currency, listing.bedrooms, listing.bathrooms, listing.areaM2, listing.title, listing.description, JSON.stringify(listing.photos), JSON.stringify(listing.videos), listing.purpose, listing.advertised, listing.advertisedRequested, listing.lat, listing.lng, listing.owner, listing.rentPeriod, listing.createdAt, JSON.stringify(sanitizeDetails(data.details)), listing.address],
  );
  return mapListing(rows[0]);
}

// Admin verification (Phase 3): a human checked the home and the owner.
// Never set automatically — paying for activation does not make a
// listing "verified".
export async function setVerified(id, value) {
  const { rows } = await query(
    'UPDATE listings SET verified = $2, verified_at = $3 WHERE id = $1 RETURNING *',
    [id, value === true, value === true ? Date.now() : null],
  );
  return rows[0] ? mapListing(rows[0]) : null;
}
