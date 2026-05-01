'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mic } from 'lucide-react';
import LoginGate from '@/components/shared/components/login-gate';
import UploadZone from '@/components/shared/components/upload-zone';
import ProgressBar from '@/components/shared/components/progress-bar';
import FeatureHelpButton from '@/components/shared/components/feature-help-button';
import TranscribeButton from '@/features/transcribe/components/transcribe-button';
import TranscriptResult from '@/features/transcribe/components/transcript-result';
import { AUTH_CHANGED_EVENT, clearClientAuth, getStoredAccessToken } from '@/lib/auth-token';
import {
  transcribePrepareUpload,
  transcribeUploadToSignedUrl,
  transcribeCompleteUpload,
  openGenerationJobSseStream,
  transcribeEstimatePoints,
  type PointsEstimate,
} from '@/lib/transcribe-api';
import {
  extractTranscriptTextFromOutputData,
  parseGenerationSseProgressPayload,
} from '@/lib/generation-job-sse';
import {
  detectCurrentLocale,
  getDefaultErrorMessage,
  getNetworkErrorMessage,
  getStatusErrorMessage,
} from '@/lib/api-error-message';

export default function TranscribePage() {
  const t = useTranslations('transcribe');
  const transcribeRunRef = useRef(0);
  const progressSimTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseProgressFloorRef = useRef(0);

  const transcribeSseOverrides = useMemo(
    () => ({
      stages: {
        download: { percent: 22, label: t('stages.download') },
        extract_audio: { percent: 38, label: t('stages.extract_audio') },
        normalize_audio: { percent: 48, label: t('stages.normalize_audio') },
        silence_removal: { percent: 58, label: t('stages.silence_removal') },
        segment_audio: { percent: 62, label: t('stages.segment_audio') },
        ai_transcription: { percent: 78, label: t('stages.ai_transcription') },
        ai_subtitles: { percent: 80, label: t('stages.ai_subtitles') },
        upload_srt: { percent: 92, label: t('stages.upload_srt') },
      },
      subscribedLabel: t('sse.subscribed'),
      /** Lower than default 38 so real stage events can jump the bar; monotonic UI keeps upload phase % until SSE catches up. */
      subscribedPercent: 28,
    }),
    [t],
  );

  const clearProgressSimulator = () => {
    if (progressSimTickRef.current != null) {
      clearInterval(progressSimTickRef.current);
      progressSimTickRef.current = null;
    }
  };

  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);

  useEffect(() => {
    const resolve = () => setIsSignedIn(Boolean(getStoredAccessToken()));
    resolve();
    window.addEventListener(AUTH_CHANGED_EVENT, resolve);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, resolve);
  }, []);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);
  const [estimate, setEstimate] = useState<PointsEstimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);

  /** Blob URL for the side preview column on md+ (UploadZone keeps its own URL below md). */
  const [splitPreviewUrl, setSplitPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!uploadedFile) {
      setSplitPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(uploadedFile);
    setSplitPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [uploadedFile]);

  const isVideoFile = Boolean(uploadedFile?.type.startsWith('video/'));
  const isAudioFile = Boolean(uploadedFile?.type.startsWith('audio/'));
  const useMediaSplitColumn = Boolean(uploadedFile && (isVideoFile || isAudioFile));
  const splitLayoutActive = useMediaSplitColumn && Boolean(splitPreviewUrl);

  const toUserSafeError = (raw: string): string => {
    const msg = (raw ?? '').trim();
    if (!msg) return getDefaultErrorMessage(detectCurrentLocale());
    const lower = msg.toLowerCase();
    const statusMatch = msg.match(/\((\d{3})\)/);
    if (statusMatch) {
      return getStatusErrorMessage(Number(statusMatch[1]), detectCurrentLocale());
    }
    if (lower.includes('network') || lower.includes('failed to fetch')) {
      return getNetworkErrorMessage(detectCurrentLocale());
    }
    return getDefaultErrorMessage(detectCurrentLocale());
  };

  const withTimeout = async <T,>(
    p: Promise<T>,
    ms: number,
    message: string,
  ): Promise<T> => {
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
    void withTimeout(
      transcribeEstimatePoints(uploadedFile),
      12000,
      'Estimate timed out. Please try again.',
    )
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
  }, [uploadedFile]);

  const handleTranscribe = async () => {
    if (!uploadedFile) return;
    const runId = ++transcribeRunRef.current;
    clearProgressSimulator();

    setIsLoading(true);
    setStatus('');
    setProgress(null);
    try {
      setProgress({ percent: 10, label: t('progress.preparingUpload') });
      const prep = await withTimeout(
        transcribePrepareUpload(uploadedFile),
        20000,
        'Prepare upload timed out. The server may be unavailable.',
      );

      setProgress({ percent: 25, label: t('progress.uploading') });
      await withTimeout(
        transcribeUploadToSignedUrl(prep.uploadUrl, uploadedFile),
        120000,
        'Upload timed out. Check your network and try again.',
      );

      setProgress({ percent: 35, label: t('progress.startingJob') });
      const complete = await withTimeout(
        transcribeCompleteUpload(prep.uploadSessionId),
        20000,
        'Starting job timed out. The server may be unhealthy (DB/Redis).',
      );

      await new Promise<void>((resolve) => {
        sseProgressFloorRef.current = 35;
        progressSimTickRef.current = setInterval(() => {
          if (transcribeRunRef.current !== runId) {
            clearProgressSimulator();
            return;
          }
          setProgress((prev) => {
            if (!prev) return prev;
            const floor = Math.min(sseProgressFloorRef.current, 94);
            const next = Math.min(95, Math.max(prev.percent + 1, floor));
            if (next <= prev.percent) return prev;
            const useSimulatedCopy = prev.percent >= floor + 8;
            return {
              percent: next,
              label: useSimulatedCopy ? t('progress.simulated') : prev.label,
            };
          });
        }, 420);

        openGenerationJobSseStream(complete.jobId, {
          onStatus: (raw) => {
            if (transcribeRunRef.current !== runId) return;
            const p = parseGenerationSseProgressPayload(raw, transcribeSseOverrides);
            if (p) {
              if (p.percent >= 100) {
                clearProgressSimulator();
              }
              sseProgressFloorRef.current = Math.max(
                sseProgressFloorRef.current,
                p.percent >= 100 ? p.percent : Math.min(p.percent, 99),
              );
              setProgress((prev) => ({
                percent: Math.max(p.percent, prev?.percent ?? 0),
                label: p.label,
              }));
            }
          },
          onDone: () => {},
          onError: (msg) => {
            if (transcribeRunRef.current !== runId) return;
            console.warn('[Transcribe SSE] error:', msg);
            clearProgressSimulator();
            setStatus(toUserSafeError(msg));
            setProgress(null);
            resolve();
          },
          onTerminal: (payload) => {
            if (transcribeRunRef.current !== runId) return;
            clearProgressSimulator();
            const text = extractTranscriptTextFromOutputData(payload.outputData);
            if (text) {
              setTranscribedText(text);
              setStatus('');
              setProgress({ percent: 100, label: t('progress.finished') });
            } else {
              const raw = payload.message ?? 'No transcript text returned.';
              setStatus(toUserSafeError(raw));
              setProgress(null);
            }
            resolve();
          },
        });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[Transcribe] failed:', e);
      const safe = toUserSafeError(msg || 'Transcribe failed.');
      setStatus(safe);
      setProgress(null);
      if ((msg ?? '').toLowerCase().includes('full authentication is required')) {
        clearClientAuth();
        setIsSignedIn(false);
      }
    } finally {
      clearProgressSimulator();
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isSignedIn ? (
        <LoginGate />
      ) : (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col py-6 sm:py-6">
          <div className="w-full min-w-0 md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,26rem)] md:items-start md:gap-8 lg:gap-10 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,28rem)] xl:gap-12">
            <div className="hidden min-w-0 flex-col gap-4 md:flex md:sticky md:top-24">
              {splitLayoutActive ? (
                <>
                  {isVideoFile ? (
                    <div className="flex max-h-[min(70vh,520px)] w-full justify-center overflow-hidden rounded-xl border border-card-border bg-black/5">
                      <video
                        src={splitPreviewUrl ?? undefined}
                        controls
                        playsInline
                        className="max-h-[min(70vh,520px)] w-auto max-w-full object-contain"
                      />
                    </div>
                  ) : null}
                  {isAudioFile ? (
                    <div className="rounded-xl border border-card-border bg-card p-4">
                      <audio src={splitPreviewUrl ?? undefined} controls className="w-full" />
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex min-h-[min(36vh,280px)] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-card-border bg-card/40 px-4 py-10 text-center">
                  <Mic className="h-10 w-10 text-muted" strokeWidth={1.75} />
                  <p className="max-w-56 text-sm leading-relaxed text-muted-foreground">
                    {t('layout.previewPlaceholder')}
                  </p>
                </div>
              )}
            </div>

            <div className="transcribe-shell min-w-0 space-y-6">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{t('page.title')}</h1>
                <FeatureHelpButton ariaLabel={t('page.helpAria')} message={t('page.helpMessage')} />
              </div>

              <UploadZone
                accept="audio/*,video/*"
                kicker={t('uploadZone.kicker')}
                instructionPrimary={t('uploadZone.instruction')}
                instructionSecondary={t('uploadZone.formats')}
                dropzoneClassName="transcribe-dropzone"
                className="space-y-2"
                mediaPreviewClassName="md:hidden"
                onFileChange={(f) => {
                  setUploadedFile(f);
                  setTranscribedText('');
                  setStatus('');
                  setProgress(null);
                  setEstimate(null);
                  setEstimateError(null);
                }}
              />

              <div className="rounded-xl border border-card-border bg-card px-4 py-3">
                <p className={`text-sm ${estimateError ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {estimateLoading
                    ? 'Estimating points…'
                    : estimate
                      ? `Estimated cost: ~${estimate.reserveCostPoints} points`
                      : estimateError
                        ? `Estimate unavailable: ${estimateError}`
                        : 'Select a file to estimate points.'}
                </p>
              </div>

              <TranscribeButton
                onClick={handleTranscribe}
                isLoading={isLoading}
                disabled={!uploadedFile}
              />

              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Result
                </p>

                {progress ? (
                  <div
                    className={`rounded-xl border border-card-border bg-card px-4 py-3 ${
                      progress.percent >= 100 ? 'border-emerald-500/30 bg-emerald-500/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className={`text-sm ${
                          progress.percent >= 100
                            ? 'font-medium text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {progress.label}
                      </p>
                      <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                        {progress.percent}%
                      </p>
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

                {transcribedText ? (
                  <TranscriptResult text={transcribedText} />
                ) : !progress ? (
                  <div className="rounded-xl border border-card-border bg-card px-4 py-6">
                    <p className="text-sm font-medium text-foreground">
                      No transcript yet
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Upload an audio/video file, then click Transcribe to generate the result here.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
