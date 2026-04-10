import { defineRouting, type Pathnames } from 'next-intl/routing';

const locales = ['en', 'mm'] as const;

const pathnames = {
  '/': '/',
  '/tools': '/tools',
  '/landing': '/landing',
  '/login': '/login',
  '/signup': '/signup',
  '/verify': '/verify',
  '/forgot-password': '/forgot-password',
  '/reset-password': '/reset-password',
  '/pricing': '/pricing',
  '/account': '/account',
  '/account/password': '/account/password',
  '/video-upload': '/video-upload',
  '/transcribe': '/transcribe',
  '/transcript': '/transcript',
  '/content-generation': '/content-generation',
  '/voice-over': '/voice-over',
  '/video-edit': '/video-edit',
  '/translate': '/translate',
  '/admin': '/admin'
} as const satisfies Pathnames<typeof locales>;

export type AppPathname = keyof typeof pathnames;

export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  pathnames
});