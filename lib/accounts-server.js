// Server account store — Postgres (since Oct 2026; the old in-memory
// store wiped every account on a container restart). Only password HASHES
// are stored, never passwords: the browser's SHA-256, wrapped server-side
// in salted scrypt (lib/password.js). The admin activates accounts by matching
// the MonCash/NatCash transfer to the phone number on the account.
// Every user gets an assigned account id (kay-0001, kay-0002, …) from a
// sequence, so the admin can refer to a user exactly.
import { query } from './db';
import { createHash, randomBytes } from 'crypto';
import path from 'node:path';
import { removeUpload } from './upload-files';
import { unlink } from 'node:fs/promises';
import { hashSecret, verifySecret } from './password';

function parseLocation(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try {
    const o = JSON.parse(v);
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}

function pub(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    username: r.username,
    phone: r.phone,
    email: r.email,
    // Stored as JSON text ({ department, commune }); it used to be handed
    // back unparsed, so every page showed "undefined, undefined".
    location: parseLocation(r.location),
    locale: r.locale || 'ht',
    // Most live homes allowed (0015); null = no limit.
    listingLimit: r.listing_limit ?? null,
    avatarUrl: r.avatar_url || null,
    role: r.role,
    activated: r.activated,
    // Subscription state (0010). `activated` is the gate every permission
    // check already reads; these say WHY it is what it is.
    billingStatus: r.billing_status || 'pending',
    // Fraud suspension is separate from billing (migration 0021): it
    // rides the account shape so /me, sign-in and the admin list all see
    // it, but no billing field ever changes with it.
    fraudSuspended: r.fraud_suspended === true,
    fraudSuspendedAt: r.fraud_suspended_at ? Number(r.fraud_suspended_at) : null,
    fraudReason: r.fraud_reason || '',
    paidUntil: r.paid_until ? Number(r.paid_until) : null,
    suspendedAt: r.suspended_at ? Number(r.suspended_at) : null,
    partner: r.partner,
    transferSent: r.transfer_sent,
    transferProvider: r.transfer_provider,
    createdAt: Number(r.created_at),
  };
}

export async function createServerAccount({ name, username, passwordHash, phone, email, location, role, partner }) {
  const dup = await query('SELECT id FROM accounts WHERE LOWER(username) = LOWER($1)', [username]);
  if (dup.rows.length > 0) return null;
  const isTenant = role === 'tenant';
  const isPartner = partner === true;
  const { rows: seq } = await query(`SELECT nextval('account_number_seq') AS n`);
  const id = `kay-${String(seq[0].n).padStart(4, '0')}`;
  const { rows } = await query(
    `INSERT INTO accounts (id, name, username, password_hash, phone, email, location, role, activated, partner, transfer_sent, transfer_provider, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,FALSE,NULL,$11) RETURNING *`,
    [id, name, username, await hashSecret(passwordHash), phone, email || null, location || null,
     isTenant ? 'tenant' : 'landlord',
     // Tenants are free: no fee, no admin activation — active immediately.
     // Landlords pay the fee and wait for admin activation.
     // Partner accounts (created by the admin) are active immediately too,
     // free — they never pay the fee and never count in revenue.
     isTenant || isPartner, isPartner, Date.now()],
  );
  // Tenants and partners do not expire; a new landlord owes the joining
  // fee before it can post.
  if (isTenant || isPartner) {
    await query(`UPDATE accounts SET billing_status = 'active', paid_until = NULL WHERE id = $1`, [id]);
  }
  const { rows: fresh } = await query('SELECT * FROM accounts WHERE id = $1', [id]);
  return pub(fresh[0] || rows[0]);
}

// Account deletion (Oct 2026, Apple Guideline 5.1.1(v) + the 2.1 review
// reply): a user deletes their own account from the Account page. What
// is theirs goes: listings, chats, reports, visits, reminders,
// notifications, sessions, login history, reset codes, traffic rows.
// The money ledger survives on purpose (payments, payment_deletions,
// audit_log, revenue_entries) — money is a ledger, and deleting an
// account must never rewrite what was paid. The account row goes last,
// so a failure mid-way leaves the account in place and the user can
// retry: every delete below is idempotent.
export async function deleteServerAccount(username) {
  const { rows: owned } = await query('SELECT id FROM listings WHERE owner = $1', [username]);
  const ownedIds = owned.map((r) => r.id);
  if (ownedIds.length) {
    await query('DELETE FROM chat_messages WHERE listing_id = ANY($1)', [ownedIds]);
    await query('DELETE FROM chat_reads WHERE listing_id = ANY($1)', [ownedIds]);
    await query('DELETE FROM chat_hidden WHERE listing_id = ANY($1)', [ownedIds]);
    await query('DELETE FROM conversations WHERE listing_id = ANY($1)', [ownedIds]);
    await query('DELETE FROM listings WHERE id = ANY($1)', [ownedIds]);
  }
  // Threads where the user is the tenant live on other landlords' homes:
  // only the tenant's own messages go, never the landlord's.
  const { rows: tenantThreads } = await query(
    'SELECT listing_id FROM conversations WHERE tenant = $1', [username]);
  const tenantIds = tenantThreads.map((r) => r.listing_id);
  if (tenantIds.length) {
    await query(
      'DELETE FROM chat_messages WHERE listing_id = ANY($1) AND (sender = $2 OR author = $2)',
      [tenantIds, username]);
    await query('DELETE FROM conversations WHERE tenant = $1', [username]);
  }
  // Safety net: anything the user authored anywhere else.
  await query('DELETE FROM chat_messages WHERE sender = $1 OR author = $1', [username]);
  await query('DELETE FROM chat_reads WHERE username = $1', [username]);
  await query('DELETE FROM chat_hidden WHERE username = $1', [username]);
  const { rows: visitRows } = await query(
    'SELECT id FROM visits WHERE tenant = $1 OR owner = $1', [username]);
  const { rows: ownedVisitRows } = ownedIds.length
    ? await query('SELECT id FROM visits WHERE listing_id = ANY($1)', [ownedIds])
    : { rows: [] };
  const visitIds = [...new Set([
    ...visitRows.map((r) => r.id), ...ownedVisitRows.map((r) => r.id),
  ])];
  if (visitIds.length) {
    await query('DELETE FROM visit_reminders WHERE visit_id = ANY($1)', [visitIds]);
    await query('DELETE FROM visits WHERE id = ANY($1)', [visitIds]);
  }
  await query('DELETE FROM reports WHERE reporter = $1', [username]);
  await query('DELETE FROM notifications WHERE username = $1', [username]);
  await query('DELETE FROM billing_reminders WHERE username = $1', [username]);
  await query('DELETE FROM password_reset_codes WHERE username = $1', [username]);
  await query('DELETE FROM sessions WHERE username = $1', [username]);
  await query('DELETE FROM login_events WHERE username = $1', [username]);
  await query('DELETE FROM traffic_visitors WHERE visitor = $1', [`u:${username}`]);
  // The profile photo, best effort: a failed unlink never blocks deletion.
  const { rows: me } = await query('SELECT avatar_url FROM accounts WHERE username = $1', [username]);
  const avatar = me[0]?.avatar_url || '';
  if (/^\/uploads\/[^/]+$/.test(avatar)) {
    await removeUpload(avatar); // the photo and its resized copies
  }
  const { rowCount } = await query('DELETE FROM accounts WHERE username = $1', [username]);
  return rowCount > 0;
}

// Password recovery (Phase 1b): admin-assisted. The admin confirms who
// is asking (e.g. calls back the phone on the account), issues a one-time
// code, and the user sets a new password with it. The old check — just
// username + phone — let anyone who knew a phone number take the account.
// Codes are random, stored only as SHA-256, single-use, 24h.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const CODE_TTL_MS = 24 * 60 * 60 * 1000;
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const normalizeCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export async function issueResetCode(username) {
  const { rows } = await query('SELECT username FROM accounts WHERE username = $1', [username]);
  if (!rows[0]) return null;
  const bytes = randomBytes(10);
  const raw = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  await query(
    `INSERT INTO password_reset_codes (username, code_hash, expires_at, created_at) VALUES ($1,$2,$3,$4)
     ON CONFLICT (username) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, created_at = EXCLUDED.created_at`,
    [rows[0].username, sha256(raw), Date.now() + CODE_TTL_MS, Date.now()],
  );
  return { username: rows[0].username, code: `${raw.slice(0, 5)}-${raw.slice(5)}`, expiresAt: Date.now() + CODE_TTL_MS };
}

export async function resetPasswordWithCode(username, code, passwordHash) {
  if (!passwordHash) return null;
  const { rows } = await query(
    `SELECT a.* FROM accounts a JOIN password_reset_codes c ON c.username = a.username
     WHERE LOWER(a.username) = LOWER($1) AND c.code_hash = $2 AND c.expires_at > $3`,
    [username, sha256(normalizeCode(code)), Date.now()],
  );
  const a = rows[0];
  if (!a) return null;
  await query('DELETE FROM password_reset_codes WHERE username = $1', [a.username]);
  const updated = await query('UPDATE accounts SET password_hash = $2 WHERE id = $1 RETURNING *', [a.id, await hashSecret(passwordHash)]);
  return pub(updated.rows[0]);
}

export const ACCOUNT_ROLES = ['tenant', 'landlord'];
export const ACCOUNT_BILLING = ['pending', 'active', 'suspended', 'deactivated'];

// One PAGE of accounts for the Admin Board, searched and filtered in
// Postgres. The board used to load every account and render a card each,
// which is survivable at fifty accounts and hopeless at fifty thousand:
// the query, the JSON and the DOM all grew with the user base.
//
// Newest first, because on a growing list the accounts you need are the
// ones that just arrived. `per` is capped so a hand-written ?per=100000
// cannot ask for the old behaviour back.
export async function listServerAccountsPage({ page = 1, per = 25, q = '', role = '', billing = '' } = {}) {
  const limit = Math.min(Math.max(Number(per) || 25, 1), 100);
  const p = Math.max(Number(page) || 1, 1);
  const where = [];
  const params = [];
  const term = String(q || '').trim().slice(0, 80);
  if (term) {
    // The wildcards are escaped, so searching for "100%" searches for
    // "100%" rather than matching every account.
    params.push(`%${term.replace(/([\\%_])/g, '\\$1')}%`);
    const n = params.length;
    where.push(`(name ILIKE $${n} OR username ILIKE $${n} OR id ILIKE $${n}
                 OR COALESCE(phone, '') ILIKE $${n} OR COALESCE(email, '') ILIKE $${n})`);
  }
  if (ACCOUNT_ROLES.includes(role)) {
    params.push(role);
    where.push(`role = $${params.length}`);
  }
  if (ACCOUNT_BILLING.includes(billing)) {
    params.push(billing);
    where.push(`billing_status = $${params.length}`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // A separate COUNT rather than COUNT(*) OVER(): the window version
  // reports 0 whenever the requested page lands past the end of the
  // list, which is exactly when the UI needs the real total to send the
  // reader back to a page that exists.
  const { rows: counted } = await query(`SELECT COUNT(*)::int AS n FROM accounts ${clause}`, params);
  const total = Number(counted[0]?.n || 0);

  const { rows } = await query(
    `SELECT accounts.*,
       (SELECT COUNT(*)::int FROM listings l WHERE l.owner = accounts.username AND l.status = 'active') AS live_listings
     FROM accounts ${clause}
     ORDER BY created_at DESC, id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (p - 1) * limit],
  );
  return { accounts: rows.map((r) => ({ ...pub(r), liveListings: r.live_listings ?? 0 })), total, page: p, per: limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

// Just the display fields for a known set of usernames. The Admin Board's
// "live now" panel used to load every account and .find() through them
// per live user, which is O(users x live) for data it already had keys
// for.
export async function getAccountNames(usernames) {
  const list = [...new Set((usernames || []).filter(Boolean))];
  if (list.length === 0) return {};
  const { rows } = await query('SELECT username, name, id FROM accounts WHERE username = ANY($1)', [list]);
  return Object.fromEntries(rows.map((r) => [r.username, { name: r.name, id: r.id }]));
}

export async function getServerAccount(username) {
  const { rows } = await query('SELECT * FROM accounts WHERE username = $1', [username]);
  return pub(rows[0]) || null;
}

// What anyone may see about another user: never phone or email (the
// phone used to be public here, and it was the only password-reset check).
export async function getPublicProfile(username) {
  const a = await getServerAccount(username);
  return a ? { username: a.username, name: a.name, role: a.role } : null;
}

// Sign-in check: the client sends the SHA-256 hash (never the password),
// the server checks it against the stored scrypt.
export async function verifyAccount(username, passwordHash) {
  const { rows } = await query('SELECT * FROM accounts WHERE username = $1', [username]);
  const a = rows[0];
  if (!a || !(await verifySecret(passwordHash, a.password_hash))) return null;
  return pub(a);
}

export async function markTransferSent(username, provider) {
  const { rows } = await query(
    'UPDATE accounts SET transfer_sent = TRUE, transfer_provider = $2 WHERE username = $1 RETURNING *',
    [username, provider],
  );
  return pub(rows[0]) || null;
}

export async function setAccountActivated(username, activated) {
  const { rows } = await query(
    'UPDATE accounts SET activated = $2 WHERE username = $1 RETURNING *',
    [username, activated === true],
  );
  return pub(rows[0]) || null;
}

// Profile photo (0004). The value is always an /uploads/<name> path this
// server wrote — never a URL from the client — so a profile photo cannot
// be pointed at a third-party tracker. Passing null removes the photo and
// the initials circle comes back. The old file is left on disk: nothing
// in this app deletes uploads, and a stray avatar costs a few hundred KB.
export async function setAccountAvatar(username, url) {
  if (url !== null && !(typeof url === 'string' && url.startsWith('/uploads/'))) return null;
  const { rows } = await query(
    'UPDATE accounts SET avatar_url = $2 WHERE username = $1 RETURNING *',
    [username, url],
  );
  return pub(rows[0]) || null;
}

// The language notifications are sent in (Phase 8): taken from the
// kay_locale cookie at signup / sign-in and when the user switches
// language in Account.
export async function setAccountLocale(username, locale) {
  if (!['ht', 'fr', 'en'].includes(locale)) return;
  await query('UPDATE accounts SET locale = $2 WHERE username = $1', [username, locale]);
}
