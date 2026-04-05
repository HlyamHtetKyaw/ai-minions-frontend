import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

// Cookie name(s) the backend sets on login — update to match your API.
const AUTH_COOKIE_NAMES = ['session', 'token', 'auth'];

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

  return intlMiddleware(request);
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
