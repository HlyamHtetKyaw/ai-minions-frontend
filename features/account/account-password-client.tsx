'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { changePassword } from '@/lib/account';
import { AccountShell } from './account-shell';

export default function AccountPasswordClient() {
  const t = useTranslations('account');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    if (newPassword.length < 6) {
      setError(t('passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setOk(t('passwordUpdated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('passwordError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AccountShell>
      <div className="rounded-2xl border border-card-border bg-card/50 p-6 sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {t('passwordHeading')}
        </h2>
        <p className="mt-1 text-sm text-muted">{t('passwordHint')}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          {error ? (
            <p
              className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {ok ? (
            <p
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-400"
              role="status"
            >
              {ok}
            </p>
          ) : null}

          <div>
            <label
              htmlFor="current-password"
              className="block text-sm font-medium text-foreground"
            >
              {t('labelCurrentPassword')}
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-xl border border-card-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-shadow focus:border-accent-gold/50 focus:ring-2 focus:ring-accent-gold/20"
              required
            />
          </div>
          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-foreground"
            >
              {t('labelNewPassword')}
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-xl border border-card-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-shadow focus:border-accent-gold/50 focus:ring-2 focus:ring-accent-gold/20"
              required
              minLength={6}
            />
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-foreground"
            >
              {t('labelConfirmPassword')}
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-xl border border-card-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-shadow focus:border-accent-gold/50 focus:ring-2 focus:ring-accent-gold/20"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg transition-opacity hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? t('updatingPassword') : t('updatePassword')}
          </button>
        </form>
      </div>
    </AccountShell>
  );
}
