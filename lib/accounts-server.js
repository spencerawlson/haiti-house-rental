// Server account store (v0, in-memory — same honest limits as listings and
// chat: resets on server restart; a database comes later). Only password
// HASHES are stored, never passwords. The admin activates accounts by
// matching the MonCash/NatCash transfer to the phone number on the account.
const accounts = [];
let nextAccountNumber = 1;

// Every user gets an assigned account id (kay-0001, kay-0002, …) so the
// admin can refer to a user exactly — in the roster, in transfer matching,
// and when a user quotes their id. Accounts created before ids existed
// get one the first time they are read.
function ensureAccountId(a) {
  if (!a) return a;
  if (!a.id) a.id = `kay-${String(nextAccountNumber++).padStart(4, '0')}`;
  return a;
}

function pub(a) {
  if (!a) return null;
  const { passwordHash, ...rest } = a;
  return rest;
}

export function createServerAccount({ name, username, passwordHash, phone, email, location, role, partner }) {
  if (accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) return null;
  const isTenant = role === 'tenant';
  const isPartner = partner === true;
  const account = {
    name, username, passwordHash, phone, email, location,
    role: isTenant ? 'tenant' : 'landlord',
    // Tenants are free: no fee, no admin activation — active immediately.
    // Landlords pay the fee and wait for admin activation.
    // Partner accounts (created by the admin) are active immediately too,
    // free — they never pay the fee and never count in revenue.
    activated: isTenant || isPartner,
    partner: isPartner,
    transferSent: false, transferProvider: null,
    createdAt: Date.now(),
  };
  ensureAccountId(account);
  accounts.push(account);
  return pub(account);
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
export function resetPassword(username, phone, passwordHash) {
  const a = accounts.find((x) => x.username.toLowerCase() === String(username || '').toLowerCase());
  if (!a || !passwordHash) return null;
  if (phoneCore(a.phone) !== phoneCore(phone) || !phoneCore(phone)) return null;
  a.passwordHash = passwordHash;
  return pub(a);
}

export function listServerAccounts() {
  return accounts.map((a) => pub(ensureAccountId(a)));
}

export function getServerAccount(username) {
  return pub(ensureAccountId(accounts.find((a) => a.username === username))) || null;
}

// Sign-in check: the client sends the SHA-256 hash (never the password),
// the server compares it to the stored hash.
export function verifyAccount(username, passwordHash) {
  const a = accounts.find((x) => x.username === username);
  if (!a || a.passwordHash !== passwordHash) return null;
  return pub(ensureAccountId(a));
}

export function markTransferSent(username, provider) {
  const a = accounts.find((x) => x.username === username);
  if (!a) return null;
  a.transferSent = true;
  a.transferProvider = provider;
  return pub(ensureAccountId(a));
}

export function setAccountActivated(username, activated) {
  const a = accounts.find((x) => x.username === username);
  if (!a) return null;
  a.activated = activated === true;
  return pub(ensureAccountId(a));
}
