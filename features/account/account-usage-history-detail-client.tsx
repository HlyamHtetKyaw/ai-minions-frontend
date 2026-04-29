'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  fetchUsageHistoryContentImageDownloadUrl,
  fetchUsageHistoryDownloadUrl,
  fetchUsageHistoryDetail,
  type UsageHistoryDetail,
  type UsageHistoryFeatureKey,
} from '@/lib/account';
import { AccountShell } from './account-shell';

function featureLabel(t: ReturnType<typeof useTranslations>, featureKey: UsageHistoryFeatureKey): string {
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
    case 'WORKSPACE_EXPORT':
      return t('usageHistory.featureVideoGeneration');
    default:
      return key || t('usageHistory.featureUnknown');
  }
}

export default function AccountUsageHistoryDetailClient({ id }: { id: string }) {
  const t = useTranslations('account');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<UsageHistoryDetail | null>(null);
  const [downloadingField, setDownloadingField] = useState<string | null>(null);

  const generationId = useMemo(() => Number.parseInt(id, 10), [id]);

  async function downloadContentImageByGenerationId(value: string) {
    const generationId = Number.parseInt(value, 10);
    if (!Number.isFinite(generationId) || generationId <= 0) return;
    setDownloadingField(`img-${value}`);
    try {
      const data = await fetchUsageHistoryContentImageDownloadUrl(generationId);
      const a = document.createElement('a');
      a.href = data.downloadUrl;
      a.download = '';
      a.rel = 'noopener noreferrer';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setDownloadingField(null);
    }
  }

  async function downloadUsageFileByGenerationId(value: string, loadingKey: string) {
    const generationId = Number.parseInt(value, 10);
    if (!Number.isFinite(generationId) || generationId <= 0) return;
    setDownloadingField(loadingKey);
    try {
      const data = await fetchUsageHistoryDownloadUrl(generationId);
      const a = document.createElement('a');
      a.href = data.downloadUrl;
      a.download = '';
      a.rel = 'noopener noreferrer';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setDownloadingField(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Number.isFinite(generationId) || generationId <= 0) {
        setError(t('usageHistory.detail.invalidId'));
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const row = await fetchUsageHistoryDetail(generationId);
        if (cancelled) return;
        setDetail(row);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('usageHistory.detail.loadError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [generationId, t]);

  return (
    <AccountShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">{t('usageHistory.detail.title')}</h1>
          <Link
            href="/account"
            className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface"
          >
            {t('usageHistory.detail.back')}
          </Link>
        </div>

        {loading ? <p className="text-sm text-muted">{t('usageHistory.detail.loading')}</p> : null}
        {error ? <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600">{error}</p> : null}

        {!loading && !error && detail ? (
          <div className="space-y-4 rounded-2xl border border-card-border bg-card/50 p-6">
            <p className="text-sm text-muted">{featureLabel(t, detail.featureKey)}</p>

            {!detail.available ? (
              <p className="rounded-xl border border-card-border bg-background px-4 py-3 text-sm text-muted">
                {t('usageHistory.detail.noDetails')}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-xl border border-card-border bg-background p-4">
                  <h2 className="mb-3 text-sm font-semibold text-foreground">{t('usageHistory.detail.input')}</h2>
                  <div className="space-y-3">
                    {detail.input.map((field, idx) => (
                      <div key={`${field.label}-${idx}`}>
                        <p className="text-xs text-muted">{field.label}</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">{field.value || '—'}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-xl border border-card-border bg-background p-4">
                  <h2 className="mb-3 text-sm font-semibold text-foreground">{t('usageHistory.detail.output')}</h2>
                  <div className="space-y-3">
                    {detail.output.map((field, idx) => (
                      <div key={`${field.label}-${idx}`}>
                        <p className="text-xs text-muted">{field.label}</p>
                        {field.kind === 'download' ? (
                          <button
                            type="button"
                            onClick={() => downloadUsageFileByGenerationId(field.value, `subtitle-${field.value}`)}
                            disabled={downloadingField === `subtitle-${field.value}`}
                            className="mt-1 rounded-lg border border-card-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {downloadingField === `subtitle-${field.value}`
                              ? t('usageHistory.detail.downloadingSubtitle')
                              : t('usageHistory.detail.downloadSubtitle')}
                          </button>
                        ) : field.kind === 'audio_download' ? (
                          <button
                            type="button"
                            onClick={() => downloadUsageFileByGenerationId(field.value, `audio-${field.value}`)}
                            disabled={downloadingField === `audio-${field.value}`}
                            className="mt-1 rounded-lg border border-card-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {downloadingField === `audio-${field.value}`
                              ? t('usageHistory.detail.downloadingAudio')
                              : t('usageHistory.detail.downloadAudio')}
                          </button>
                        ) : field.kind === 'video_download' ? (
                          <button
                            type="button"
                            onClick={() => downloadUsageFileByGenerationId(field.value, `video-${field.value}`)}
                            disabled={downloadingField === `video-${field.value}`}
                            className="mt-1 rounded-lg border border-card-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {downloadingField === `video-${field.value}`
                              ? t('usageHistory.detail.downloadingVideo')
                              : t('usageHistory.detail.downloadVideo')}
                          </button>
                        ) : field.kind === 'image_download' ? (
                          <button
                            type="button"
                            onClick={() => downloadContentImageByGenerationId(field.value)}
                            disabled={downloadingField === `img-${field.value}`}
                            className="mt-1 rounded-lg border border-card-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {downloadingField === `img-${field.value}`
                              ? t('usageHistory.detail.downloadingImage')
                              : t('usageHistory.detail.downloadImage')}
                          </button>
                        ) : (
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{field.value || '—'}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </AccountShell>
  );
}
