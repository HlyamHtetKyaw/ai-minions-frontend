'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { fetchMe } from '@/lib/auth';
import {
  fetchMyProfile,
  fetchUsageHistory,
  type UsageHistoryFeatureType,
  type UsageHistoryItem,
  type UsageHistoryStatus,
  updateMyProfile,
} from '@/lib/account';
import { AccountActivateSection } from './account-activate-section';
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
  const [usageRows, setUsageRows] = useState<UsageHistoryItem[]>([]);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState('');
  const [usagePage, setUsagePage] = useState(0);
  const [usageTotalPages, setUsageTotalPages] = useState(1);
  const [usageLoadingMore, setUsageLoadingMore] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setUsageLoading(true);
      setUsageError('');
      try {
        const page = await fetchUsageHistory({ page: 0, size: 10 });
        if (cancelled) return;
        setUsageRows(Array.isArray(page.content) ? page.content : []);
        setUsagePage(page.currentPage ?? 0);
        setUsageTotalPages(page.totalPages ?? 1);
      } catch (e) {
        if (!cancelled) {
          setUsageError(e instanceof Error ? e.message : t('usageHistory.loadError'));
        }
      } finally {
        if (!cancelled) setUsageLoading(false);
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

  async function loadMoreUsage() {
    if (usageLoadingMore) return;
    const nextPage = usagePage + 1;
    if (nextPage >= usageTotalPages) return;
    setUsageLoadingMore(true);
    try {
      const page = await fetchUsageHistory({ page: nextPage, size: 10 });
      setUsageRows((prev) => [...prev, ...(Array.isArray(page.content) ? page.content : [])]);
      setUsagePage(page.currentPage ?? nextPage);
      setUsageTotalPages(page.totalPages ?? usageTotalPages);
    } catch (e) {
      setUsageError(e instanceof Error ? e.message : t('usageHistory.loadError'));
    } finally {
      setUsageLoadingMore(false);
    }
  }

  function featureLabel(featureType: UsageHistoryFeatureType): string {
    const key = String(featureType ?? '').toUpperCase();
    switch (key) {
      case 'TEXT':
        return t('usageHistory.featureText');
      case 'IMAGE':
        return t('usageHistory.featureImage');
      case 'AUDIO':
        return t('usageHistory.featureAudio');
      case 'VIDEO':
        return t('usageHistory.featureVideo');
      default:
        return key || t('usageHistory.featureUnknown');
    }
  }

  function statusLabel(status: UsageHistoryStatus): string {
    switch ((status ?? '').toUpperCase()) {
      case 'PENDING':
        return t('usageHistory.statusPending');
      case 'SUCCESS':
        return t('usageHistory.statusSuccess');
      case 'FAILED':
        return t('usageHistory.statusFailed');
      default:
        return String(status);
    }
  }

  function statusClassName(status: UsageHistoryStatus): string {
    switch ((status ?? '').toUpperCase()) {
      case 'SUCCESS':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
      case 'FAILED':
        return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300';
      default:
        return 'border-card-border bg-surface/50 text-muted';
    }
  }

  function formatWhen(raw: string): string {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  if (loading) {
    return (
      <AccountShell>
        <div className="space-y-6">
          <div className="animate-pulse space-y-4 rounded-2xl border border-card-border bg-card/30 p-8">
            <div className="h-4 w-40 rounded bg-surface" />
            <div className="h-10 w-full rounded-xl bg-surface sm:max-w-md" />
          </div>
          <div className="animate-pulse space-y-4 rounded-2xl border border-card-border bg-card/30 p-8">
            <div className="h-4 w-24 rounded bg-surface" />
            <div className="h-10 w-full rounded-xl bg-surface" />
            <div className="h-10 w-full rounded-xl bg-surface" />
          </div>
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell>
      <div className="space-y-6">
        <AccountActivateSection
          onActivated={(next) => setCredits(next)}
        />

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

      <div className="rounded-2xl border border-card-border bg-card/50 p-6 sm:p-8">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">{t('usageHistory.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('usageHistory.subtitle')}</p>
        </div>

        {usageError ? (
          <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {usageError}
          </p>
        ) : null}

        {usageLoading ? (
          <div className="space-y-2">
            <div className="h-10 animate-pulse rounded-lg bg-surface" />
            <div className="h-10 animate-pulse rounded-lg bg-surface" />
            <div className="h-10 animate-pulse rounded-lg bg-surface" />
          </div>
        ) : usageRows.length === 0 ? (
          <p className="rounded-xl border border-card-border bg-background px-4 py-3 text-sm text-muted">
            {t('usageHistory.empty')}
          </p>
        ) : (
          <div className="space-y-2">
            {usageRows.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-2 rounded-xl border border-card-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{featureLabel(row.featureType)}</p>
                  <p className="text-xs text-muted">{formatWhen(row.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <span className="text-sm font-semibold tabular-nums text-foreground">-{row.spentPoints}</span>
                  <span className="text-xs text-muted">{t('usageHistory.pointsUnit')}</span>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassName(row.status)}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                </div>
              </div>
            ))}

            {usagePage + 1 < usageTotalPages ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => void loadMoreUsage()}
                  disabled={usageLoadingMore}
                  className="rounded-full border border-card-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                >
                  {usageLoadingMore ? t('usageHistory.loadingMore') : t('usageHistory.loadMore')}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
      </div>
    </AccountShell>
  );
}
