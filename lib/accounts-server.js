// Server account store — Postgres (since Oct 2026; the old in-memory
// store wiped every account on a container restart). Only password HASHES
// are stored, never passwords: the browser's SHA-256, wrapped server-side
// in salted scrypt (lib/password.js). The admin activates accounts by matching
// the MonCash/NatCash transfer to the phone number on the account.
// Every user gets an assigned account id (kay-0001, kay-0002, …) from a
// sequence, so the admin can refer to a user exactly.
import { query } from './db';
import { createHash, randomBytes } from 'crypto';
import { hashSecret, verifySecret } from './password';

function pub(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    username: r.username,
    phone: r.phone,
    email: r.email,
    location: r.location,
    locale: r.locale || 'ht',
    avatarUrl: r.avatar_url || null,
    role: r.role,
    activated: r.activated,
    // Subscription state (0010). `activated` is the gate every permission
    // check already reads; these say WHY it is what it is.
    billingStatus: r.billing_status || 'pending',
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

export async function listServerAccounts() {
  const { rows } = await query('SELECT * FROM accounts ORDER BY created_at ASC, id ASC');
  return rows.map(pub);
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
