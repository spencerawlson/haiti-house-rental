// Admin gate. The password lives ONLY in the server env (ADMIN_PASSWORD)
// and is never in the repo. The cookie holds the SHA-256 hash of the
// password, so it cannot be forged without knowing the password. If the
// env var is unset, the admin area is closed (fail closed).
export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function adminToken() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return sha256(pw);
}

export async function isAdminCookie(value) {
  const token = await adminToken();
  return !!token && value === token;
}
