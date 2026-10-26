import { NextResponse } from 'next/server';
import { getAdminScope } from './lib/admin-auth.js';

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
  matcher: ['/api/:path*', '/:locale/admin', '/:locale/stats'],
};
