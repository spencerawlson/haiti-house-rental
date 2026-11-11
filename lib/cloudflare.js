// Cloudflare edge headers. Cloudflare terminates TLS at the edge, so the
// origin only ever sees plain HTTP (the tunnel hands it http://localhost
// requests). Cloudflare sends the real visitor scheme in the CF-Visitor
// header, which the tunnel passes through untouched.
//
// Same shape as Farelune's src/lib/cloudflare.ts: absent or malformed =
// null, so callers leave the request alone (local dev has no Cloudflare
// in front of it).
//
// Deliberately NOT X-Forwarded-Proto: Next stamps that header with the
// origin's own scheme (plain http) when it is absent, so it always reads
// "http" at the origin and can never tell a real http visitor from an
// https one. CF-Visitor is the only header that carries the truth.
export function cloudflareScheme(cfVisitor) {
  if (!cfVisitor) return null;
  try {
    const scheme = JSON.parse(cfVisitor).scheme;
    return scheme === 'https' || scheme === 'http' ? scheme : null;
  } catch {
    return null;
  }
}
