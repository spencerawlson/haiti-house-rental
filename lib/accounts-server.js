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

export function createServerAccount({ name, username, passwordHash, phone, email, location }) {
  if (accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) return null;
  const account = {
    name, username, passwordHash, phone, email, location,
    activated: false, transferSent: false, transferProvider: null,
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
