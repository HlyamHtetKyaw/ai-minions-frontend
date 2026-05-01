'use client';

import { useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { signup } from '@/lib/auth';

type PasswordStrength = {
  score: number;
};

function getPasswordStrength(value: string): PasswordStrength {
  const checks = [
    value.length >= 8,
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ];
  const score = checks.filter(Boolean).length;

  if (score <= 2) {
    return { score };
  }
  if (score === 3) {
    return { score };
  }
  if (score === 4) {
    return { score };
  }

  return { score };
}

export default function SignupPage() {
  const router = useRouter();
  const t = useTranslations('signup');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = password === confirmPassword;
  const canSubmit =
    passwordStrength.score >= 4 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    passwordsMatch &&
    !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (passwordStrength.score < 4) {
      setError(t('errors.chooseStronger'));
      return;
    }
    if (!passwordsMatch) {
      setError(t('errors.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await signup(username, email, password);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('aiminions_verify_username', username.trim());
        sessionStorage.setItem('aiminions_verify_email', email.trim());
      }
      router.push('/verify');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.signupFailed');
      if (message.toLowerCase().includes('already exists via google login')) {
        router.push({ pathname: '/password-setup', query: { email: email.trim() } });
        router.refresh();
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
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

          <div className="space-y-1.5">
            <label htmlFor="username" className="text-sm font-medium text-foreground">
              {t('fields.username')}
            </label>
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="yourname"
              className="w-full rounded-lg border border-card-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent-gold focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              {t('fields.email')}
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

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              {t('fields.password')}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-surface px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted focus:border-accent-gold focus:outline-none transition-colors"
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
            {password.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted">
                  {t('strength.label')}:{' '}
                  <span className="font-medium text-foreground">
                    {passwordStrength.score <= 2
                      ? t('strength.weak')
                      : passwordStrength.score === 3
                        ? t('strength.fair')
                        : passwordStrength.score === 4
                          ? t('strength.good')
                          : t('strength.strong')}
                  </span>
                </p>
                <div className="h-1.5 w-full rounded-full bg-card-border/70">
                  <div
                    className={`h-full rounded-full transition-all ${
                      passwordStrength.score <= 2
                        ? 'bg-red-500'
                        : passwordStrength.score === 3
                          ? 'bg-amber-500'
                          : passwordStrength.score === 4
                            ? 'bg-yellow-500'
                            : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(20, passwordStrength.score * 20)}%` }}
                  />
                </div>
                <p className="text-xs text-muted">
                  {passwordStrength.score <= 2
                    ? t('strength.hints.weak')
                    : passwordStrength.score === 3
                      ? t('strength.hints.fair')
                      : passwordStrength.score === 4
                        ? t('strength.hints.good')
                        : t('strength.hints.strong')}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
              {t('fields.confirmPassword')}
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
                aria-label={showConfirmPassword ? t('aria.hideConfirmPassword') : t('aria.showConfirmPassword')}
              >
                {showConfirmPassword ? (
                  <EyeOff className="mx-auto h-4 w-4" />
                ) : (
                  <Eye className="mx-auto h-4 w-4" />
                )}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <p className={`text-xs ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                {passwordsMatch ? t('passwordMatch.match') : t('passwordMatch.mismatch')}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? t('submit.loading') : t('submit.idle')}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {t('footer.haveAccount')}{' '}
          <Link href="/login" className="font-medium text-accent-gold hover:underline">
            {t('footer.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
