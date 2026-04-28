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
  '/password-setup': '/password-setup',
  '/reset-password': '/reset-password',
  '/pricing': '/pricing',
  '/account': '/account',
  '/account/password': '/account/password',
  '/account/usage-history/[id]': '/account/usage-history/[id]',
  '/video-upload': '/video-upload',
  '/transcribe': '/transcribe',
  '/subtitles': '/subtitles',
  '/transcript': '/transcript',
  '/content-generation': '/content-generation',
  '/voice-over': '/voice-over',
  '/video-edit': '/video-edit',
  '/video-edit/history': '/video-edit/history',
  '/video-edit/work-space': '/video-edit/work-space',
  '/editor': '/editor',
  '/translate': '/translate',
  '/admin': '/admin',
  '/viral-shorts': '/viral-shorts',
} as const satisfies Pathnames<typeof locales>;

export type AppPathname = keyof typeof pathnames;

export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  pathnames
});