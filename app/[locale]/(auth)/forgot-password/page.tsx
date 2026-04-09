'use client';

import { useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { getPublicApiBaseUrl } from '@/lib/api-base';

type ForgotPasswordResponse = {
  token?: string;
  accessToken?: string;
  data?: {
    token?: string;
    accessToken?: string;
  };
  message?: string;
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const base = getPublicApiBaseUrl();
      if (!base) {
        throw new Error(
          'API base URL is not set (set NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)',
        );
      }

      const res = await fetch(`${base}/api/v1/auth/forget-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const body = (await res
        .json()
        .catch(() => ({}))) as ForgotPasswordResponse;

      if (!res.ok) {
        if (res.status === 404) {
          setError('Email not found.');
        } else {
          setError(
            typeof body.message === 'string' && body.message.length > 0
              ? body.message
              : `Request failed (${res.status})`,
          );
        }
        return;
      }

      const returnedToken =
        body.data?.token ??
        body.data?.accessToken ??
        body.token ??
        body.accessToken ??
        '';

      if (!returnedToken) {
        setError('No token returned from server.');
        return;
      }

      setToken(returnedToken);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('aiminions_reset_token', returnedToken);
      }
      router.push('/reset-password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to continue. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Forgot password</h1>
          <p className="mt-1 text-sm text-muted">Enter your email to receive reset instructions.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-card-border bg-card p-6 shadow-sm space-y-4"
        >
          {error && (
            <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <fieldset disabled={loading} className="space-y-4 disabled:opacity-70">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-card-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent-gold focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-fg/40 border-t-primary-fg" />
              )}
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </fieldset>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-accent-gold hover:underline">
            Back to login
          </Link>
        </p>

        {token && <p className="sr-only">{token}</p>}
      </div>
    </div>
  );
}
