import { NextResponse } from 'next/server';
import { isAdminCookie } from './lib/admin-auth.js';

// Gates the admin area: admin APIs, the admin page, and the full accounts
// list (single-profile lookup by username stays public for the Account page).
export async function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;
  // The login endpoint itself must stay open, or nobody can ever get in.
  if (pathname === '/api/admin/login') {
    return NextResponse.next();
  }
  // Only the full accounts list is gated. Creating an account (POST) and
  // looking up your own profile (?username=) stay public.
  if (pathname === '/api/accounts' && request.method === 'GET' && !searchParams.has('username')) {
    // fall through to the admin check below
  } else if (pathname === '/api/accounts') {
    return NextResponse.next();
  }
  const ok = await isAdminCookie(request.cookies.get('kay_admin')?.value);
  if (ok) return NextResponse.next();
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Admin required' }, { status: 401 });
  }
  const locale = pathname.split('/')[1] || 'ht';
  return NextResponse.redirect(new URL(`/${locale}/admin-login`, request.url));
}

export const config = {
  matcher: ['/api/admin/:path*', '/api/accounts', '/:locale/admin'],
};
