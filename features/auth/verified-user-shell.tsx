'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { fetchMe } from '@/lib/auth';
import {
  getStoredAccessToken,
} from '@/lib/auth-token';

/**
 * Tool routes require a verified email (password signup). Unverified users are sent to `/verify`.
 */
export function VerifiedUserShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = getStoredAccessToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      const me = await fetchMe();
      if (cancelled) return;
      if (!me) {
        router.replace('/login');
        return;
      }
      if (me.isVerified === false) {
        router.replace('/verify');
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl w-full py-24">
        <div className="animate-pulse space-y-4 rounded-2xl border border-card-border bg-card/40 p-10">
          <div className="mx-auto h-8 w-48 rounded-lg bg-surface" />
          <div className="h-12 w-full rounded-xl bg-surface" />
          <div className="h-12 w-full rounded-xl bg-surface" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
