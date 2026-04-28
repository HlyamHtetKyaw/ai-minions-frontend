'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';
import { fetchMe, resendOtp, verifyOtp } from '@/lib/auth';
import {
  AUTH_CHANGED_EVENT,
  getStoredAccessToken,
} from '@/lib/auth-token';

function mapVerifyError(
  raw: string,
  t: (key: string) => string,
): string {
  const x = raw.toLowerCase();
  if (
    x.includes('expired') ||
    x.includes('never sent') ||
    x.includes('signing up again')
  ) {
    return t('errorOtpExpired');
  }
  if (
    x.includes('does not match') ||
    x.includes('6-digit') ||
    x.includes('latest verification')
  ) {
    return t('errorOtpWrong');
  }
  return raw;
}

const RESEND_UI_COOLDOWN_SEC = 60;

export default function VerifyClient() {
  const t = useTranslations('verify');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendInfo, setResendInfo] = useState('');
  const [resendErr, setResendErr] = useState('');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(
      () => setResendCooldown((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [resendCooldown]);

  useEffect(() => {
    const qUser = searchParams.get('username') ?? searchParams.get('email') ?? '';
    const token = getStoredAccessToken();
    let cancelled = false;

    void (async () => {
      if (token) {
        const me = await fetchMe();
        if (cancelled) return;
        if (me?.isVerified) {
          router.replace('/tools');
          return;
        }
        if (me) {
          setUsernameOrEmail((prev) => prev || me.email || me.username || '');
        }
      }
      if (typeof window !== 'undefined') {
        const su = sessionStorage.getItem('aiminions_verify_username');
        const se = sessionStorage.getItem('aiminions_verify_email');
        if (su || se) {
          setUsernameOrEmail((prev) => prev || se || su || '');
        }
      }
      if (qUser && !cancelled) {
        setUsernameOrEmail((prev) => prev || qUser);
      }
      if (!cancelled) setInitializing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyOtp(usernameOrEmail.trim(), otp.trim());
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('aiminions_verify_username');
        sessionStorage.removeItem('aiminions_verify_email');
        window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      }
      router.push('/tools');
      router.refresh();
    } catch (err) {
      const raw = err instanceof Error ? err.message : t('errorGeneric');
      setError(mapVerifyError(raw, t));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    const id = usernameOrEmail.trim();
    if (!id) {
      setResendErr(t('resendNeedIdentity'));
      return;
    }
    setResendErr('');
    setResendInfo('');
    setResendBusy(true);
    try {
      await resendOtp(id);
      setResendInfo(t('resendSuccess'));
      setResendCooldown(RESEND_UI_COOLDOWN_SEC);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      const low = raw.toLowerCase();
      if (low.includes('wait')) {
        setResendErr(t('resendWait'));
      } else {
        setResendErr(raw || t('errorGeneric'));
      }
      setResendCooldown(RESEND_UI_COOLDOWN_SEC);
    } finally {
      setResendBusy(false);
    }
  }

  if (initializing) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <div className="animate-pulse space-y-6 rounded-2xl border border-card-border bg-card/50 p-8">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-surface" />
          <div className="h-6 w-3/4 rounded bg-surface" />
          <div className="h-12 w-full rounded-xl bg-surface" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-16">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -top-20 left-1/2 h-64 w-[min(100%,36rem)] -translate-x-1/2 rounded-full bg-accent-gold-muted/50 blur-3xl dark:opacity-40" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent-gold/35 bg-card">
            <Mail className="h-6 w-6 text-accent-gold" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t('title')}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('subtitle')}</p>
        </div>

        <div className="rounded-2xl border border-card-border bg-card/90 p-6 shadow-sm dark:bg-card/70 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <div
                className="rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-sm leading-relaxed"
                role="alert"
              >
                <p className="font-medium text-red-400">{t('errorTitle')}</p>
                <p className="mt-1.5 text-red-400">{error}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <label
                htmlFor="verify-identity"
                className="text-sm font-medium text-foreground"
              >
                {t('labelIdentity')}
              </label>
              <input
                id="verify-identity"
                type="text"
                required
                autoComplete="username"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder={t('placeholderIdentity')}
                className="w-full rounded-xl border border-card-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-accent-gold/50 focus:outline-none focus:ring-2 focus:ring-accent-gold/20"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="verify-otp" className="text-sm font-medium text-foreground">
                {t('labelOtp')}
              </label>
              <input
                id="verify-otp"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                required
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder={t('placeholderOtp')}
                className="w-full rounded-xl border border-card-border bg-background px-4 py-3 text-center font-mono text-lg tracking-[0.35em] text-foreground placeholder:tracking-normal placeholder:text-muted focus:border-accent-gold/50 focus:outline-none focus:ring-2 focus:ring-accent-gold/20"
              />
              <p className="text-xs text-muted">{t('otpHint')}</p>
            </div>

            {resendInfo ? (
              <p
                className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3 text-sm leading-relaxed text-emerald-800 dark:text-emerald-400"
                role="status"
              >
                {resendInfo}
              </p>
            ) : null}
            {resendErr ? (
              <p
                className="rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-sm text-red-400"
                role="alert"
              >
                {resendErr}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => void handleResend()}
                disabled={
                  resendBusy ||
                  resendCooldown > 0 ||
                  !usernameOrEmail.trim()
                }
                className="text-left text-sm font-medium text-accent-gold underline-offset-4 transition-opacity hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
              >
                {resendBusy
                  ? t('resending')
                  : resendCooldown > 0
                    ? t('resendCooldown', { seconds: resendCooldown })
                    : t('resend')}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-fg transition-opacity hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t('submitting') : t('submit')}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-sm text-muted">
          <Link
            href="/login"
            className="font-medium text-accent-gold underline-offset-4 hover:underline"
          >
            {t('backToSignIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
