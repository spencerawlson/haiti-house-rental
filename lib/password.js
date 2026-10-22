// Server-side password hashing (Oct 2026). The browser still sends a
// SHA-256 of the password, but that hash alone is never stored: an
// unsalted SHA-256 IS the password as far as sign-in goes, so a leaked
// table would have logged anyone in. The server wraps it in salted
// scrypt — stored as `scrypt$<salt hex>$<hash hex>`.
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';

const KEYLEN = 64;

function scryptAsync(secret, salt) {
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, KEYLEN, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export function isServerHash(stored) {
  return typeof stored === 'string' && stored.startsWith('scrypt$');
}

export async function hashSecret(secret) {
  const salt = randomBytes(16);
  const key = await scryptAsync(String(secret), salt);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifySecret(secret, stored) {
  if (!secret || !isServerHash(stored)) return false;
  const [, saltHex, keyHex] = stored.split('$');
  const expected = Buffer.from(keyHex, 'hex');
  const key = await scryptAsync(String(secret), Buffer.from(saltHex, 'hex'));
  return key.length === expected.length && timingSafeEqual(key, expected);
}
