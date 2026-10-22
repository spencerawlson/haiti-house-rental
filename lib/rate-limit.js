// In-memory fixed-window rate limiter. One container serves kayayiti.app,
// so a process-local map is enough; it resets on restart, which only
// ever loosens limits briefly. Guards sign-in, signup, password reset,
// uploads and chat against guessing and flooding.
const buckets = new Map(); // key -> { count, resetAt }

export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  if (buckets.size > 10000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= max;
}

// Cloudflare Tunnel puts the visitor's address in cf-connecting-ip.
export function clientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

export function tooMany() {
  return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
}
