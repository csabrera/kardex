import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/recuperar-password', '/reset-password', '/setup'];
const AUTH_ROUTES = ['/login', '/recuperar-password', '/reset-password', '/setup'];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasRefreshCookie = request.cookies.has('refresh_token');

  // Authenticated user tries to access login/auth pages → redirect to dashboard
  if (hasRefreshCookie && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Unauthenticated user tries to access protected routes → redirect to login
  if (!hasRefreshCookie && !isPublicRoute(pathname) && pathname !== '/') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
