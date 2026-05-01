'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { requestPasswordSetupOtp, verifyPasswordSetupOtp } from '@/lib/auth';

type Step = 'request' | 'verify';

export default function PasswordSetupPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialEmail = useMemo(() => (params.get('email') ?? '').trim(), [params]);

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await requestPasswordSetupOtp(email);
      setSuccess('OTP sent to your email. Enter it below to enable password login.');
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await verifyPasswordSetupOtp(email, otp, newPassword);
      setSuccess('Password login enabled. You can now sign in with email and password.');
      router.push('/login');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify OTP.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Enable password login</h1>
          <p className="mt-1 text-sm text-muted">
            This email is linked to Google sign in. Verify OTP to also use email/password.
          </p>
        </div>

        {step === 'request' ? (
          <form
            onSubmit={handleRequestOtp}
            className="rounded-2xl border border-card-border bg-card p-6 shadow-sm space-y-4"
          >
            {error && (
              <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm text-emerald-400">
                {success}
              </p>
            )}
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
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending OTP…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleVerifyOtp}
            className="rounded-2xl border border-card-border bg-card p-6 shadow-sm space-y-4"
          >
            {error && (
              <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm text-emerald-400">
                {success}
              </p>
            )}
            <div className="space-y-1.5">
              <label htmlFor="emailVerify" className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="emailVerify"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent-gold focus:outline-none transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="otp" className="text-sm font-medium text-foreground">
                OTP code
              </label>
              <input
                id="otp"
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="000000"
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
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
            </div>
            <div className="space-y-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying…' : 'Verify OTP and enable password'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setStep('request');
                  setOtp('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setError('');
                  setSuccess('');
                }}
                className="w-full rounded-lg border border-card-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface/80"
              >
                Back
              </button>
            </div>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-accent-gold hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
