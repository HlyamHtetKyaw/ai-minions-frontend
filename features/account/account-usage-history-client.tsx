'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { fetchUsageHistory, type UsageHistoryFeatureKey, type UsageHistoryItem, type UsageHistoryStatus } from '@/lib/account';

export default function AccountUsageHistoryClient() {
  const t = useTranslations('account');
  const [usageRows, setUsageRows] = useState<UsageHistoryItem[]>([]);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState('');
  const [usagePage, setUsagePage] = useState(0);
  const [usageTotalPages, setUsageTotalPages] = useState(1);
  const [usageLoadingMore, setUsageLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setUsageLoading(true);
      setUsageError('');
      try {
        const page = await fetchUsageHistory({ page: 0, size: 20 });
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

  async function loadMoreUsage() {
    if (usageLoadingMore) return;
    const nextPage = usagePage + 1;
    if (nextPage >= usageTotalPages) return;
    setUsageLoadingMore(true);
    try {
      const page = await fetchUsageHistory({ page: nextPage, size: 20 });
      setUsageRows((prev) => [...prev, ...(Array.isArray(page.content) ? page.content : [])]);
      setUsagePage(page.currentPage ?? nextPage);
      setUsageTotalPages(page.totalPages ?? usageTotalPages);
    } catch (e) {
      setUsageError(e instanceof Error ? e.message : t('usageHistory.loadError'));
    } finally {
      setUsageLoadingMore(false);
    }
  }

  function featureLabel(featureKey: UsageHistoryFeatureKey): string {
    const key = String(featureKey ?? '').toUpperCase();
    switch (key) {
      case 'TRANSLATE':
        return t('usageHistory.featureTranslate');
      case 'VOICE_OVER':
        return t('usageHistory.featureVoiceOver');
      case 'TRANSCRIBE':
        return t('usageHistory.featureTranscribe');
      case 'SUBTITLES':
        return t('usageHistory.featureSubtitles');
      case 'CONTENT_V2':
        return t('usageHistory.featureContentV2');
      case 'BALANCED_SYNC':
        return t('usageHistory.featureBalancedSync');
      case 'TEXT_GENERATION':
        return t('usageHistory.featureTextGeneration');
      case 'IMAGE_GENERATION':
        return t('usageHistory.featureImageGeneration');
      case 'AUDIO_GENERATION':
        return t('usageHistory.featureAudioGeneration');
      case 'VIDEO_GENERATION':
        return t('usageHistory.featureVideoGeneration');
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
    if (Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  return (
    <div className="min-w-0 pb-16 pt-8 sm:pt-12">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{t('usageHistory.title')}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t('usageHistory.title')}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t('usageHistory.subtitle')}</p>

      <div className="mt-8 rounded-2xl border border-card-border bg-card/50 p-6 sm:p-8">
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
                  <p className="truncate text-sm font-medium text-foreground">{featureLabel(row.featureKey)}</p>
                  <p className="text-xs text-muted">{formatWhen(row.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  {String(row.status ?? '').toUpperCase() === 'FAILED' ? (
                    <span className="text-xs font-medium text-muted">{t('usageHistory.notCharged')}</span>
                  ) : (
                    <>
                      <span className="text-sm font-semibold tabular-nums text-foreground">-{row.chargedPoints}</span>
                      <span className="text-xs text-muted">{t('usageHistory.pointsUnit')}</span>
                    </>
                  )}
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassName(
                      row.status,
                    )}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                  {String(row.status ?? '').toUpperCase() === 'SUCCESS' ? (
                    <Link
                      href={{ pathname: '/account/usage-history/[id]', params: { id: String(row.id) } }}
                      className="rounded-md border border-card-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                    >
                      {t('usageHistory.viewDetails')}
                    </Link>
                  ) : (
                    <span className="rounded-md border border-card-border px-2.5 py-1 text-xs text-muted">
                      {t('usageHistory.noDetails')}
                    </span>
                  )}
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
  );
}

