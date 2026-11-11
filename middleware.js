import { NextResponse } from 'next/server';
import { getAdminScope } from './lib/admin-auth.js';
import { cloudflareScheme, canonicalHost } from './lib/cloudflare.js';

// 1. CSRF guard (Phase 1b): a state-changing /api request whose Origin
//    is another site is refused. Session cookies are SameSite=Lax (admin:
//    Strict), and this is the second wall. Requests without Origin
//    (curl, server-to-server) pass — browsers always send it on
//    cross-site POSTs. Extra allowed origins: ALLOWED_ORIGINS (comma list).
// 2. Admin gate: admin APIs, the admin page, and the full accounts list
//    (single-profile lookup by username stays public, name + role only).
//    A scoped ('stats') token may read the stats summary, sign out, and
//    open the stats page — nothing else. Anything admin that is not on
//    that list needs the full scope, so a scoped account can never reach
//    money, individual accounts, settings, or the board itself.
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const STATS_METHODS = {
  '/api/admin/stats-summary': new Set(['GET']),
  '/api/admin/logout': new Set(['POST']),
};

function sameSite(request) {
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  if (!origin) return true;
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  const allowed = new Set(
    [request.headers.get('host'), request.headers.get('x-forwarded-host'), request.nextUrl.host]
      .concat((process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim().replace(/^https?:\/\//, '')))
      .filter(Boolean),
  );
  return allowed.has(host);
}

function needsAdmin(pathname, request) {
  if (pathname === '/api/admin/login') return false;
  if (pathname.startsWith('/api/admin/')) return true;
  if (/^\/[^/]+\/admin$/.test(pathname)) return true;
  if (/^\/[^/]+\/stats$/.test(pathname)) return true;
  // Only the full accounts list is gated; creating an account (POST) and
  // the public ?username= lookup stay open.
  return pathname === '/api/accounts' && request.method === 'GET' && !request.nextUrl.searchParams.has('username');
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  // Canonical https (same class as Farelune's canonical fix): a visitor
  // who arrives over plain http must be sent to https, or search engines
  // see two copies of every page. The origin only ever sees http — the
  // Cloudflare edge terminates TLS and the tunnel hands it plain requests
  // — so the real scheme comes from the CF-Visitor header alone (see
  // lib/cloudflare.js for why X-Forwarded-Proto cannot be trusted here).
  // Absent or malformed = do nothing: local dev and direct-origin calls
  // send no CF-Visitor header and must keep working over http. The
  // Cloudflare "Always Use HTTPS" toggle does the same redirect at the
  // edge; this is the code half, so the canonical holds even if the
  // toggle is off, and it goes dormant (edge redirects first) if the
  // toggle is later turned on.
  const scheme = cloudflareScheme(request.headers.get('cf-visitor'));
  if (scheme === 'http') {
    // The redirect host is the canonical public host, never the request
    // URL's host: the origin binds 0.0.0.0:3000, so nextUrl carries that
    // internal address and a redirect built from it is dead. Setting
    // .host alone does NOT clear an explicit port (URL keeps :3000), so
    // the port is cleared too — https://kayayiti.app:3000 would be just
    // as dead as the 0.0.0.0 form.
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.host = canonicalHost(request.headers);
    url.port = '';
    return NextResponse.redirect(url, 308);
  }
  if (pathname.startsWith('/api/') && !SAFE.has(request.method) && !sameSite(request)) {
    return NextResponse.json({ error: 'Cross-site request refused' }, { status: 403 });
  }
  if (!needsAdmin(pathname, request)) return NextResponse.next();
  const scope = await getAdminScope(request.cookies.get('kay_admin')?.value);
  if (!scope) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Admin required' }, { status: 401 });
    }
    const locale = pathname.split('/')[1] || 'ht';
    return NextResponse.redirect(new URL(`/${locale}/admin-login`, request.url));
  }
  if (scope === 'stats') {
    const allowed = (STATS_METHODS[pathname] && STATS_METHODS[pathname].has(request.method))
      || /^\/[^/]+\/stats$/.test(pathname);
    if (allowed) return NextResponse.next();
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Admin required' }, { status: 401 });
    }
    const locale = pathname.split('/')[1] || 'ht';
    return NextResponse.redirect(new URL(`/${locale}/stats`, request.url));
  }
  return NextResponse.next();
}

export const config = {
  // API routes (CSRF guard + admin gate) plus every page: the https
  // redirect above has to see page requests, not just /api. Next
  // internals and files with an extension (/_next, /sw.js, /robots.txt,
  // /sitemap.xml, /llms.txt, images) skip middleware entirely.
  matcher: ['/api/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
