// Server account store (v0, in-memory — same honest limits as listings and
// chat: resets on server restart; a database comes later). Only password
// HASHES are stored, never passwords. The admin activates accounts by
// matching the MonCash/NatCash transfer to the phone number on the account.
const accounts = [];

function pub(a) {
  if (!a) return null;
  const { passwordHash, ...rest } = a;
  return rest;
}

export function createServerAccount({ name, username, passwordHash, phone, email, location, role }) {
  if (accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) return null;
  const isTenant = role === 'tenant';
  const account = {
    name, username, passwordHash, phone, email, location,
    role: isTenant ? 'tenant' : 'landlord',
    // Tenants are free: no fee, no admin activation — active immediately.
    // Landlords pay the fee and wait for admin activation.
    activated: isTenant,
    transferSent: false, transferProvider: null,
    createdAt: Date.now(),
  };
  accounts.push(account);
  return pub(account);
}

export function listServerAccounts() {
  return accounts.map(pub);
}

export function getServerAccount(username) {
  return pub(accounts.find((a) => a.username === username)) || null;
}

// Sign-in check: the client sends the SHA-256 hash (never the password),
// the server compares it to the stored hash.
export function verifyAccount(username, passwordHash) {
  const a = accounts.find((x) => x.username === username);
  if (!a || a.passwordHash !== passwordHash) return null;
  return pub(a);
}

export function markTransferSent(username, provider) {
  const a = accounts.find((x) => x.username === username);
  if (!a) return null;
  a.transferSent = true;
  a.transferProvider = provider;
  return pub(a);
}

export function setAccountActivated(username, activated) {
  const a = accounts.find((x) => x.username === username);
  if (!a) return null;
  a.activated = activated === true;
  return pub(a);
}
