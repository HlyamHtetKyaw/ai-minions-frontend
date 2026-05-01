'use client';

import { useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, KeyRound, Lock, Sparkles } from 'lucide-react';
import { beginGoogleLogin, login, loginWithCode } from '@/lib/auth';

type Mode = 'password' | 'code';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('login');
  const [mode, setMode] = useState<Mode>('password');
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'code') {
        await loginWithCode(accessCode);
      } else {
        const res = await login(usernameOrEmail, password);
        if (res.success && res.data?.verified === false) {
          router.push('/verify');
          router.refresh();
          return;
        }
      }
      router.push('/tools');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.loginFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center py-16">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -top-24 left-1/2 h-72 w-[min(100%,42rem)] -translate-x-1/2 rounded-full bg-accent-gold-muted blur-3xl opacity-70 dark:opacity-40" />
        <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-accent-purple/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent-gold/40 bg-gradient-to-br from-accent-gold/20 to-transparent shadow-[0_0_32px_-8px_rgba(212,168,83,0.45)] dark:shadow-[0_0_40px_-10px_rgba(232,201,106,0.35)]">
            <Sparkles className="h-6 w-6 text-accent-gold" strokeWidth={1.75} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {t('subtitle')}
          </p>
        </div>

        <div
          className="rounded-3xl border border-glass-border bg-glass p-1 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:border-white/10 dark:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.65)]"
          role="region"
          aria-label={t('aria.signInOptions')}
        >
          <div className="rounded-[1.35rem] border border-card-border bg-card/90 p-6 dark:bg-card/70">
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-card-border bg-surface/50 p-1 dark:bg-surface/30">
              <button
                type="button"
                onClick={() => {
                  setMode('password');
                  setError('');
                }}
                className={`relative flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  mode === 'password'
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-accent-gold/35 dark:bg-subtle dark:ring-accent-gold/25'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <Lock className="h-4 w-4 shrink-0 opacity-80" />
                {t('modes.password')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('code');
                  setError('');
                }}
                className={`relative flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  mode === 'code'
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-accent-gold/35 dark:bg-subtle dark:ring-accent-gold/25'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <KeyRound className="h-4 w-4 shrink-0 opacity-80" />
                {t('modes.code')}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <p
                  className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400 dark:text-red-300"
                  role="alert"
                >
                  {error}
                </p>
              )}

              {mode === 'code' ? (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-gold-muted/60 dark:bg-accent-gold-muted/40">
                      <KeyRound
                        className="h-7 w-7 text-accent-gold"
                        strokeWidth={1.5}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 text-center sm:text-left">
                    <label
                      htmlFor="accessCode"
                      className="block text-sm font-medium text-foreground"
                    >
                      {t('code.label')}
                    </label>
                    <p className="text-xs text-muted sm:text-sm">
                      {t('code.hint')}
                    </p>
                  </div>
                  <input
                    id="accessCode"
                    type="text"
                    required
                    autoComplete="one-time-code"
                    autoCapitalize="characters"
                    spellCheck={false}
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder={t('code.placeholder')}
                    className="w-full rounded-xl border border-card-border bg-surface/80 px-4 py-3.5 text-center font-mono text-base tracking-[0.2em] text-foreground placeholder:text-muted placeholder:tracking-normal focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/25 dark:bg-surface/50"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label
                      htmlFor="usernameOrEmail"
                      className="text-sm font-medium text-foreground"
                    >
                      {t('fields.usernameOrEmail')}
                    </label>
                    <input
                      id="usernameOrEmail"
                      type="text"
                      required
                      autoComplete="username"
                      value={usernameOrEmail}
                      onChange={(e) => setUsernameOrEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-card-border bg-surface/80 px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/25 dark:bg-surface/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="password"
                      className="text-sm font-medium text-foreground"
                    >
                      {t('fields.password')}
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-card-border bg-surface/80 px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/25 dark:bg-surface/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-2 my-auto h-8 w-8 rounded-md text-muted transition-colors hover:text-foreground"
                        aria-label={showPassword ? t('aria.hidePassword') : t('aria.showPassword')}
                      >
                        {showPassword ? (
                          <EyeOff className="mx-auto h-4 w-4" />
                        ) : (
                          <Eye className="mx-auto h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <div className="flex justify-end">
                      <Link
                        href="/forgot-password"
                        className="text-xs font-medium text-accent-gold underline-offset-4 hover:underline"
                      >
                        {t('links.forgotPassword')}
                      </Link>
                    </div>
                    <div className="flex justify-end">
                      <Link
                        href="/password-setup"
                        className="text-xs font-medium text-accent-gold underline-offset-4 hover:underline"
                      >
                        {t('links.googleOtpSetup')}
                      </Link>
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-fg transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="relative z-10">
                  {loading
                    ? mode === 'code'
                      ? t('submit.verifyingCode')
                      : t('submit.signingIn')
                    : mode === 'code'
                      ? t('submit.continueWithCode')
                      : t('submit.signIn')}
                </span>
                <span
                  className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:via-white/5"
                  aria-hidden
                />
              </button>
            </form>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-card-border" />
              <span className="text-xs text-muted">{t('or')}</span>
              <div className="h-px flex-1 bg-card-border" />
            </div>
            <button
              type="button"
              onClick={() => beginGoogleLogin('/tools')}
              className="w-full rounded-xl border border-card-border bg-surface/60 px-4 py-3 text-sm font-medium text-foreground transition hover:bg-surface"
            >
              {t('continueWithGoogle')}
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-muted">
          {t('footer.noAccount')}{' '}
          <Link
            href="/signup"
            className="font-medium text-accent-gold underline-offset-4 hover:underline"
          >
            {t('footer.signUp')}
          </Link>
        </p>
      </div>
    </div>
  );
}
