'use client';

import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { getPublicApiBaseUrl } from '@/lib/api-base';
import {
  detectCurrentLocale,
  getDefaultErrorMessage,
  getNetworkErrorMessage,
  getStatusErrorMessage,
} from '@/lib/api-error-message';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isExpiredError, setIsExpiredError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedToken = sessionStorage.getItem('aiminions_reset_token');
    if (storedToken) setToken(storedToken);
  }, []);

  const isPasswordValid = newPassword.length >= 8;
  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit =
    token.trim().length > 0 &&
    isPasswordValid &&
    passwordsMatch &&
    !loading &&
    newPassword.length > 0 &&
    confirmPassword.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsExpiredError(false);

    if (!isPasswordValid) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const base = getPublicApiBaseUrl();
      if (!base) {
        throw new Error(
          'API base URL is not set (set NEXT_PUBLIC_API_URL in .env.local, then restart npm run dev)',
        );
      }

      const res = await fetch(`${base}/api/v1/auth/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token.trim(),
          newPassword,
        }),
      });

      if (!res.ok) {
        setIsExpiredError(res.status === 408);
        setError(getStatusErrorMessage(res.status, detectCurrentLocale()));
        return;
      }

      setSuccessMessage('Password reset successful. Redirecting to login...');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('aiminions_reset_token');
      }
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      if (err instanceof TypeError) {
        setError(getNetworkErrorMessage(detectCurrentLocale()));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(getDefaultErrorMessage(detectCurrentLocale()));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Reset password</h1>
          <p className="mt-1 text-sm text-muted">
            Enter your reset token and choose a new password.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-card-border bg-card p-6 shadow-sm space-y-4"
        >
          {successMessage && (
            <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
              {successMessage}
            </p>
          )}

          {error && (
            <div className="space-y-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
              <p className="text-sm text-red-400">{error}</p>
              {isExpiredError && (
                <button
                  type="button"
                  onClick={() => router.push('/forgot-password')}
                  className="text-xs font-medium text-accent-gold underline-offset-4 hover:underline"
                >
                  Request a new reset link
                </button>
              )}
            </div>
          )}

          <fieldset disabled={loading} className="space-y-4 disabled:opacity-70">
            <div className="space-y-1.5">
              <label htmlFor="token" className="text-sm font-medium text-foreground">
                Reset token
              </label>
              <input
                id="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your reset token"
                className="w-full rounded-lg border border-card-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent-gold focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="newPassword" className="text-sm font-medium text-foreground">
                New password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-card-border bg-surface px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted focus:border-accent-gold focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-2 my-auto h-8 w-8 rounded-md text-muted transition-colors hover:text-foreground"
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                >
                  {showNewPassword ? (
                    <EyeOff className="mx-auto h-4 w-4" />
                  ) : (
                    <Eye className="mx-auto h-4 w-4" />
                  )}
                </button>
              </div>
              {newPassword.length > 0 && !isPasswordValid && (
                <p className="text-xs text-red-400">Password must be at least 8 characters.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-card-border bg-surface px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted focus:border-accent-gold focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-2 my-auto h-8 w-8 rounded-md text-muted transition-colors hover:text-foreground"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="mx-auto h-4 w-4" />
                  ) : (
                    <Eye className="mx-auto h-4 w-4" />
                  )}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-400">Passwords do not match.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-fg/40 border-t-primary-fg" />
              )}
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </fieldset>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-accent-gold hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
