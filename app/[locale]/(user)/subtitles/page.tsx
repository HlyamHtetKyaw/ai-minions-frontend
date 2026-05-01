'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Captions, Download } from 'lucide-react';
import LoginGate from '@/components/shared/components/login-gate';
import UploadZone from '@/components/shared/components/upload-zone';
import ActionButton from '@/components/shared/components/action-button';
import ProgressBar from '@/components/shared/components/progress-bar';
import FeatureHelpButton from '@/components/shared/components/feature-help-button';
import { AUTH_CHANGED_EVENT, clearClientAuth, getStoredAccessToken } from '@/lib/auth-token';
import { openGenerationJobSseStream } from '@/lib/generation-job-sse';
import { parseGenerationSseProgressPayload } from '@/lib/generation-job-sse';
import {
  fetchSubtitleDownloadUrl,
  fetchSubtitleSrtText,
  subtitlesCompleteUpload,
  subtitlesEstimatePoints,
  subtitlesPrepareUpload,
  uploadToSignedUrl,
  type PointsEstimate,
  type SubtitlesTargetMode,
} from '@/lib/subtitles-api';
import { parseSrt, type SrtCue } from '@/features/video-edit/lib/parse-srt';
import { normalizeClientErrorMessage } from '@/lib/api-error-message';

export default function SubtitlesPage() {
  const t = useTranslations('subtitlesPage');

  const sseStageOverrides = useMemo(
    () => ({
      download: { percent: 22, label: t('stages.download') },
      extract_audio: { percent: 38, label: t('stages.extract_audio') },
      normalize_audio: { percent: 48, label: t('stages.normalize_audio') },
      segment_audio: { percent: 62, label: t('stages.segment_audio') },
      ai_subtitles: { percent: 80, label: t('stages.ai_subtitles') },
      upload_srt: { percent: 92, label: t('stages.upload_srt') },
    }),
    [t],
  );

  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  useEffect(() => {
    const resolve = () => setIsSignedIn(Boolean(getStoredAccessToken()));
    resolve();
    window.addEventListener(AUTH_CHANGED_EVENT, resolve);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, resolve);
  }, []);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);
  const [estimate, setEstimate] = useState<PointsEstimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [previewCues, setPreviewCues] = useState<SrtCue[]>([]);
  const [previewTruncated, setPreviewTruncated] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [subtitlesMode, setSubtitlesMode] = useState<SubtitlesTargetMode>('burmese');

  const toUserSafeError = useCallback(
    (raw: string): string => {
      const msg = (raw ?? '').trim();
      if (!msg) return t('errors.generic');
      const lower = msg.toLowerCase();
      if (lower.includes('full authentication is required')) {
        return t('errors.sessionExpired');
      }
      if (lower.includes('redis') && (lower.includes('unavailable') || lower.includes('connection'))) {
        return t('errors.serviceUnavailable');
      }
      return normalizeClientErrorMessage(raw, { maxLength: 160 });
    },
    [t],
  );

  const formatSeconds = (t: number): string => {
    if (!Number.isFinite(t)) return '0:00';
    const ms = Math.round((t - Math.floor(t)) * 1000);
    const total = Math.floor(t);
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const pad3 = (n: number) => String(n).padStart(3, '0');
    return hh > 0 ? `${hh}:${pad2(mm)}:${pad2(ss)},${pad3(ms)}` : `${mm}:${pad2(ss)},${pad3(ms)}`;
  };

  const withTimeout = async <T,>(p: Promise<T>, ms: number, message: string): Promise<T> => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<T>((_, reject) => {
      t = setTimeout(() => reject(new Error(message)), ms);
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      if (t) clearTimeout(t);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!uploadedFile) {
      setEstimate(null);
      setEstimateError(null);
      setEstimateLoading(false);
      return;
    }
    setEstimateLoading(true);
    setEstimateError(null);
    void withTimeout(subtitlesEstimatePoints(uploadedFile), 12000, t('timeouts.estimate'))
      .then((d) => {
        if (cancelled) return;
        setEstimate(d);
        setEstimateLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setEstimate(null);
        setEstimateError(toUserSafeError(msg));
        setEstimateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uploadedFile, t, toUserSafeError]);

  const handleGenerate = async () => {
    if (!uploadedFile) return;
    setIsLoading(true);
    setStatus('');
    setProgress(null);
    setDownloadUrl(null);
    setPreviewCues([]);
    setPreviewTruncated(false);
    setPreviewLoading(false);
    setPreviewError(null);
    try {
      setProgress({ percent: 10, label: t('progress.preparingUpload') });
      const prep = await withTimeout(subtitlesPrepareUpload(uploadedFile, subtitlesMode), 20000, t('timeouts.prepareUpload'));

      setProgress({ percent: 25, label: t('progress.uploading') });
      await withTimeout(uploadToSignedUrl(prep.uploadUrl, uploadedFile), 120000, t('timeouts.upload'));

      setProgress({ percent: 35, label: t('progress.startingJob') });
      const complete = await withTimeout(subtitlesCompleteUpload(prep.uploadSessionId), 20000, t('timeouts.startJob'));
      const generationId = complete.jobId;

      openGenerationJobSseStream(complete.jobId, {
        onStatus: (raw) => {
          const p = parseGenerationSseProgressPayload(raw, {
            stages: sseStageOverrides,
            subscribedLabel: t('sse.subscribed'),
          });
          if (p) setProgress(p);
        },
        onDone: () => {},
        onError: (msg) => {
          setStatus(toUserSafeError(msg));
          setProgress(null);
        },
        onTerminal: (payload) => {
          if (payload.status !== 'completed') {
            setStatus(toUserSafeError(payload.message ?? t('errors.jobFailed')));
            setProgress(null);
            return;
          }
          setProgress({ percent: 100, label: t('progress.finished') });
          void fetchSubtitleDownloadUrl(generationId)
            .then((d) => {
              setDownloadUrl(d.downloadUrl);
              setStatus('');
            })
            .catch((e) => {
              const msg = e instanceof Error ? e.message : String(e);
              setStatus(toUserSafeError(msg));
            });

          setPreviewLoading(true);
          setPreviewError(null);
          void withTimeout(fetchSubtitleSrtText(generationId), 30000, t('timeouts.preview'))
            .then((d) => {
              setPreviewTruncated(Boolean(d.truncated));
              const cues = parseSrt(d.srtText);
              setPreviewCues(cues.slice(0, 200));
              setPreviewLoading(false);
            })
            .catch((e) => {
              const msg = e instanceof Error ? e.message : String(e);
              setPreviewError(toUserSafeError(msg));
              setPreviewLoading(false);
            });
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(toUserSafeError(msg || t('errors.generationFailed')));
      setProgress(null);
      if ((msg ?? '').toLowerCase().includes('full authentication is required')) {
        clearClientAuth();
        setIsSignedIn(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isGenerateDisabled = !uploadedFile || Boolean(progress && progress.percent < 100);

  return (
    <>
      {!isSignedIn ? (
        <LoginGate />
      ) : (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col py-6 sm:py-6">
          <div className="w-full min-w-0 space-y-6">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{t('hero.kicker')}</h1>
              <FeatureHelpButton ariaLabel={t('hero.helpAria')} message={t('hero.helpMessage')} />
            </div>

            <div className="rounded-2xl border border-card-border bg-card px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t('hero.kicker')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('hero.description')}</p>
            </div>

            <UploadZone
              accept="audio/*,video/*"
              kicker={t('uploadZone.kicker')}
              instructionPrimary={t('uploadZone.instructionPrimary')}
              instructionSecondary={t('uploadZone.instructionSecondary')}
              className="space-y-2"
              onFileChange={(f) => {
                setUploadedFile(f);
                setStatus('');
                setProgress(null);
                setEstimate(null);
                setEstimateError(null);
                setDownloadUrl(null);
                setPreviewCues([]);
                setPreviewTruncated(false);
                setPreviewLoading(false);
                setPreviewError(null);
              }}
            />

            <div className="rounded-xl border border-card-border bg-card px-4 py-3">
              <p className={`text-sm ${estimateError ? 'text-red-400' : 'text-muted-foreground'}`}>
                {estimateLoading
                  ? t('estimate.loading')
                  : estimate
                    ? t('estimate.cost', { points: estimate.reserveCostPoints })
                    : estimateError
                      ? t('estimate.unavailable', { message: estimateError })
                      : t('estimate.prompt')}
              </p>
            </div>

            <div className="rounded-xl border border-card-border bg-card px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t('mode.kicker')}</p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    name="subtitles-target-mode"
                    value="burmese"
                    checked={subtitlesMode === 'burmese'}
                    onChange={() => setSubtitlesMode('burmese')}
                    disabled={isLoading}
                  />
                  <span>{t('mode.burmese')}</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    name="subtitles-target-mode"
                    value="original"
                    checked={subtitlesMode === 'original'}
                    onChange={() => setSubtitlesMode('original')}
                    disabled={isLoading}
                  />
                  <span>{t('mode.original')}</span>
                </label>
              </div>
            </div>

            <ActionButton
              onClick={handleGenerate}
              isLoading={isLoading}
              disabled={isGenerateDisabled}
              label={t('generateButton.label')}
              loadingLabel={t('generateButton.loading')}
              icon={<Captions className="h-4 w-4 shrink-0" strokeWidth={2.25} />}
              className="btn-transcribe"
            />

            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{t('result.heading')}</p>

              {progress ? (
                <div
                  className={`rounded-xl border border-card-border bg-card px-4 py-3 ${
                    progress.percent >= 100 ? 'border-emerald-500/30 bg-emerald-500/5' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className={`text-sm ${
                        progress.percent >= 100 ? 'font-medium text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {progress.label}
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground tabular-nums">{progress.percent}%</p>
                  </div>
                  <ProgressBar
                    value={progress.percent}
                    max={100}
                    ariaLabel={progress.label}
                    isComplete={progress.percent >= 100}
                  />
                </div>
              ) : null}

              {!progress && status ? (
                <div className="rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3">
                  <p className="text-sm text-red-400">{status}</p>
                </div>
              ) : null}

              {downloadUrl ? (
                <div className="rounded-xl border border-card-border bg-card px-4 py-4">
                  <p className="text-sm font-medium text-foreground">{t('download.title')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t('download.description')}</p>
                  <a
                    href={downloadUrl}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-card-border bg-card px-3 py-2 text-sm font-medium hover:bg-card/70"
                    download
                    rel="noreferrer"
                  >
                    <Download className="h-4 w-4" />
                    {t('download.button')}
                  </a>

                  <div className="mt-5 border-t border-card-border pt-4">
                    <p className="text-sm font-medium text-foreground">{t('preview.title')}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{t('preview.description')}</p>

                    {previewLoading ? (
                      <p className="mt-3 text-sm text-muted-foreground">{t('preview.loading')}</p>
                    ) : null}

                    {previewError ? (
                      <p className="mt-3 text-sm text-red-400">{previewError}</p>
                    ) : null}

                    {!previewLoading && previewCues.length > 0 ? (
                      <div className="mt-3 max-h-[min(50vh,420px)] overflow-auto rounded-lg border border-card-border bg-black/10 p-3">
                        <div className="space-y-3">
                          {previewCues.map((c, idx) => (
                            <div key={`${c.startTime}-${c.endTime}-${idx}`} className="text-sm leading-relaxed">
                              <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                                {formatSeconds(c.startTime)} → {formatSeconds(c.endTime)}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-foreground">{c.content}</p>
                            </div>
                          ))}
                        </div>
                        {previewTruncated ? (
                          <p className="mt-3 text-xs text-muted-foreground">
                            {t('preview.truncated')}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {!previewLoading && !previewError && previewCues.length === 0 && downloadUrl ? (
                      <p className="mt-3 text-sm text-muted-foreground">{t('preview.empty')}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

