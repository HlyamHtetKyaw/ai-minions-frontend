'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { fetchMe } from '@/lib/auth';
import { fetchMyProfile, updateMyProfile } from '@/lib/account';
import { AccountShell } from './account-shell';

export default function AccountProfileClient() {
  const t = useTranslations('account');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [credits, setCredits] = useState<number | null>(null);
  const [fullname, setFullname] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [me, profile] = await Promise.all([fetchMe(), fetchMyProfile()]);
        if (cancelled) return;
        if (!me) {
          setError(t('notSignedIn'));
          setLoading(false);
          return;
        }
        setEmail(me.email);
        setUsername(me.username);
        setCredits(typeof me.creditBalance === 'number' ? me.creditBalance : 0);
        setFullname(profile.fullname ?? '');
        setPhone(profile.phoneNumber ?? '');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('loadError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    setSaving(true);
    try {
      await updateMyProfile({ fullname, phoneNumber: phone });
      setOk(t('saved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AccountShell>
        <div className="space-y-4 animate-pulse rounded-2xl border border-card-border bg-card/30 p-8">
          <div className="h-4 w-24 rounded bg-surface" />
          <div className="h-10 w-full rounded-xl bg-surface" />
          <div className="h-10 w-full rounded-xl bg-surface" />
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell>
      <div className="rounded-2xl border border-card-border bg-card/50 p-6 sm:p-8">
        <dl className="mb-6 space-y-4 border-b border-card-border pb-6">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
            <dt className="text-xs font-medium text-muted">{t('fieldUsername')}</dt>
            <dd className="text-sm text-foreground">{username}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
            <dt className="text-xs font-medium text-muted">{t('fieldEmail')}</dt>
            <dd className="truncate text-sm text-foreground">{email}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
            <dt className="text-xs font-medium text-muted">{t('fieldCredits')}</dt>
            <dd className="text-sm font-medium tabular-nums text-foreground">
              {credits ?? '—'}
            </dd>
          </div>
        </dl>

        <form onSubmit={onSubmit} className="space-y-5">
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
              htmlFor="account-fullname"
              className="block text-sm font-medium text-foreground"
            >
              {t('labelFullname')}
            </label>
            <input
              id="account-fullname"
              value={fullname}
              onChange={(e) => setFullname(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-card-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-shadow focus:border-accent-gold/50 focus:ring-2 focus:ring-accent-gold/20"
              autoComplete="name"
            />
          </div>
          <div>
            <label
              htmlFor="account-phone"
              className="block text-sm font-medium text-foreground"
            >
              {t('labelPhone')}
            </label>
            <input
              id="account-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              className="mt-1.5 w-full rounded-xl border border-card-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-shadow focus:border-accent-gold/50 focus:ring-2 focus:ring-accent-gold/20"
              autoComplete="tel"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg transition-opacity hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </AccountShell>
  );
}
