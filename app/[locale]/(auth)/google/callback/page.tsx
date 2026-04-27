'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { tryRefreshAccessToken } from '@/lib/api-auth-fetch';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const status = params.get('status');
  const immediateError = status === 'success' ? null : (params.get('message') ?? 'Google login failed.');

  const next = useMemo(() => {
    const value = params.get('next') ?? '/tools';
    if (!value.startsWith('/') || value.startsWith('//')) {
      return '/tools';
    }
    return value;
  }, [params]);

  useEffect(() => {
    if (status !== 'success') {
      return;
    }
    let cancelled = false;
    (async () => {
      const refreshed = await tryRefreshAccessToken();
      if (!refreshed) {
        setRefreshError('Google login completed but session could not be established.');
        return;
      }
      if (!cancelled) {
        router.replace(next);
        router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [next, router, status]);

  const error = immediateError ?? refreshError;

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-card p-6 text-center">
        {error ? (
          <>
            <p className="text-sm font-medium text-red-400">{error}</p>
            <p className="mt-2 text-xs text-muted">Please return to login and try again.</p>
          </>
        ) : (
          <p className="text-sm text-muted">Finishing Google sign in...</p>
        )}
      </div>
    </div>
  );
}
