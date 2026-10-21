// Server account store — Postgres (since Oct 2026; the old in-memory
// store wiped every account on a container restart). Only password HASHES
// are stored, never passwords. The admin activates accounts by matching
// the MonCash/NatCash transfer to the phone number on the account.
// Every user gets an assigned account id (kay-0001, kay-0002, …) from a
// sequence, so the admin can refer to a user exactly.
import { query } from './db';

function pub(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    username: r.username,
    phone: r.phone,
    email: r.email,
    location: r.location,
    role: r.role,
    activated: r.activated,
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
    [id, name, username, passwordHash, phone, email || null, location || null,
     isTenant ? 'tenant' : 'landlord',
     // Tenants are free: no fee, no admin activation — active immediately.
     // Landlords pay the fee and wait for admin activation.
     // Partner accounts (created by the admin) are active immediately too,
     // free — they never pay the fee and never count in revenue.
     isTenant || isPartner, isPartner, Date.now()],
  );
  return pub(rows[0]);
}

// Phone comparison for password reset: digits only, with the +509 country
// code stripped, so +509 32 17 1628, 32171628 and 32 17 1628 all match.
function phoneCore(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('509') ? digits.slice(3) : digits;
}

// Self-serve password reset: the account has no email channel (many have
// no email at all), so the phone number on the account is the check —
// the same phone the admin already uses to match transfers.
export async function resetPassword(username, phone, passwordHash) {
  const { rows } = await query('SELECT * FROM accounts WHERE LOWER(username) = LOWER($1)', [username]);
  const a = rows[0];
  if (!a || !passwordHash) return null;
  if (phoneCore(a.phone) !== phoneCore(phone) || !phoneCore(phone)) return null;
  const updated = await query('UPDATE accounts SET password_hash = $2 WHERE id = $1 RETURNING *', [a.id, passwordHash]);
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

// Sign-in check: the client sends the SHA-256 hash (never the password),
// the server compares it to the stored hash.
export async function verifyAccount(username, passwordHash) {
  const { rows } = await query('SELECT * FROM accounts WHERE username = $1', [username]);
  const a = rows[0];
  if (!a || a.password_hash !== passwordHash) return null;
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
