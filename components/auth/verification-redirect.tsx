'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { fetchMe } from '@/lib/auth';
import { getStoredAccessToken } from '@/lib/auth-token';

const AUTH_PATH_PREFIXES = ['/login', '/signup', '/verify', '/pricing'];

function isAuthOrPublicPath(path: string): boolean {
  if (path === '/') return false;
  return AUTH_PATH_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
}

/** Sends users with an unverified account to `/verify` before they use the app. */
export function VerificationRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isAuthOrPublicPath(pathname)) return;
    const token = getStoredAccessToken();
    if (!token) return;
    let cancelled = false;
    void (async () => {
      const me = await fetchMe();
      if (cancelled) return;
      if (me && me.isVerified === false) {
        router.replace('/verify');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
