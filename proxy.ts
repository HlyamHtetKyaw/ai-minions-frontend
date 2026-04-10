import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

/** Keep in sync with `lib/auth-token` (Next cannot import client module in edge — duplicate name). */
const SESSION_HINT_COOKIE = 'aiminions_auth';

const AUTH_COOKIE_NAMES = [
  SESSION_HINT_COOKIE,
  'access_token',
  'refresh_token',
];

const PROTECTED_PATHS = [
  '/video-upload',
  '/transcribe',
  '/transcript',
  '/content-generation',
  '/voice-over',
  '/video-edit',
  '/translate',
  '/ai-voice',
  '/voice-gen-live',
  '/master-editor',
  '/admin',
];

const GUEST_ONLY_PATHS = ['/forgot-password', '/reset-password'];

const intlMiddleware = createMiddleware(routing);

function isAuthenticated(request: NextRequest): boolean {
  return AUTH_COOKIE_NAMES.some((name) => request.cookies.has(name));
}

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || '/';
    }
  }
  return pathname;
}

export function proxy(request: NextRequest) {
  const path = stripLocale(request.nextUrl.pathname);

  const isProtected = PROTECTED_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  if (isProtected && !isAuthenticated(request)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `/${routing.defaultLocale}/login`;
    return NextResponse.redirect(loginUrl);
  }

  const isGuestOnly = GUEST_ONLY_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  if (isGuestOnly && isAuthenticated(request)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = `/${routing.defaultLocale}`;
    return NextResponse.redirect(homeUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
