'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CircleHelp, Mic } from 'lucide-react';
import PageHeader from '@/components/layout/page-header';
import LoginGate from '@/components/shared/components/login-gate';
import UploadZone from '@/components/shared/components/upload-zone';
import TranscribeButton from '@/features/transcribe/components/transcribe-button';
import TranscriptResult from '@/features/transcribe/components/transcript-result';
import { AUTH_CHANGED_EVENT, clearClientAuth, getStoredAccessToken } from '@/lib/auth-token';
import {
  transcribePrepareUpload,
  transcribeUploadToSignedUrl,
  transcribeCompleteUpload,
  openGenerationJobSseStream,
} from '@/lib/transcribe-api';
import {
  extractTranscriptTextFromOutputData,
  parseGenerationSseProgressPayload,
} from '@/lib/generation-job-sse';

export default function TranscribePage() {
  const t = useTranslations('transcribe');
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

  const toUserSafeError = (raw: string): string => {
    const msg = (raw ?? '').trim();
    if (!msg) return 'Something went wrong. Please try again.';

    const lower = msg.toLowerCase();

    if (lower.includes('full authentication is required')) {
      return 'Your session expired. Please sign in again.';
    }

    // Points / billing
    // Example from API: "Insufficient points: available=100, required=1000"
    if (lower.includes('insufficient points')) {
      const m = msg.match(/available\s*=\s*(\d+)\s*,\s*required\s*=\s*(\d+)/i);
      if (m) {
        const available = Number(m[1]);
        const required = Number(m[2]);
        if (Number.isFinite(available) && Number.isFinite(required)) {
          return `Not enough points. You have ${available}, but this job needs ${required}.`;
        }
      }
      return 'Not enough points to run this transcription. Please top up and try again.';
    }
    // Hide internal domain/DB details from end users.
    if (lower.includes('userpoints not found')) {
      return 'Your account points are not set up yet. Please contact support.';
    }
    if (lower.includes('user not found')) {
      return 'Account not found. Please sign in again.';
    }
    if (lower.includes('feature not found')) {
      return 'This feature is not available right now. Please try again later.';
    }
    if (lower.includes('redis') && (lower.includes('unavailable') || lower.includes('connection'))) {
      return 'Service is temporarily unavailable. Please try again in a moment.';
    }
    if (lower.includes('failed to validate connection') || lower.includes('hikaripool')) {
      return 'Server is temporarily unavailable. Please try again in a moment.';
    }

    // Generic safety net: avoid leaking ids / internals.
    if (/\buserId\s*=\s*\d+\b/i.test(msg)) {
      return 'Request failed. Please try again.';
    }

    // Otherwise show a cleaned but still user-meaningful message.
    return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
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

  const handleTranscribe = async () => {
    if (!uploadedFile) return;
    setIsLoading(true);
    setStatus('');
    setProgress(null);
    try {
      setProgress({ percent: 10, label: 'Preparing upload…' });
      const prep = await withTimeout(
        transcribePrepareUpload(uploadedFile),
        20000,
        'Prepare upload timed out. The server may be unavailable.',
      );

      setProgress({ percent: 25, label: 'Uploading…' });
      await withTimeout(
        transcribeUploadToSignedUrl(prep.uploadUrl, uploadedFile),
        120000,
        'Upload timed out. Check your network and try again.',
      );

      setProgress({ percent: 35, label: 'Starting transcription…' });
      const complete = await withTimeout(
        transcribeCompleteUpload(prep.uploadSessionId),
        20000,
        'Starting job timed out. The server may be unhealthy (DB/Redis).',
      );

      openGenerationJobSseStream(complete.jobId, {
        onStatus: (raw) => {
          const p = parseGenerationSseProgressPayload(raw);
          if (p) {
            setProgress(p);
          }
        },
        onDone: () => {},
        onError: (msg) => {
          console.warn('[Transcribe SSE] error:', msg);
          setStatus(toUserSafeError(msg));
          setProgress(null);
        },
        onTerminal: (payload) => {
          const text = extractTranscriptTextFromOutputData(payload.outputData);
          if (text) {
            setTranscribedText(text);
            setStatus('');
            setProgress({ percent: 100, label: 'Finished 🎉' });
          } else {
            const raw = payload.message ?? 'No transcript text returned.';
            setStatus(toUserSafeError(raw));
            setProgress(null);
          }
        },
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
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isSignedIn ? (
        <LoginGate />
      ) : (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-2xl">
            <div className="transcribe-shell space-y-6">
              <PageHeader
                icon={
                  <PageHeader.Icon tileClassName="transcribe-icon-tile">
                    <Mic className="h-6 w-6" strokeWidth={2.25} />
                  </PageHeader.Icon>
                }
                title={<PageHeader.Title>{t('page.title')}</PageHeader.Title>}
                action={
                  <PageHeader.IconButton aria-label={t('page.helpAria')}>
                    <CircleHelp className="h-5 w-5" />
                  </PageHeader.IconButton>
                }
                subtitle={<PageHeader.Subtitle>{t('page.subtitle')}</PageHeader.Subtitle>}
              />

              <UploadZone
                accept="audio/*,video/*"
                kicker={t('uploadZone.kicker')}
                instructionPrimary={t('uploadZone.instruction')}
                instructionSecondary={t('uploadZone.formats')}
                dropzoneClassName="transcribe-dropzone"
                className="space-y-2"
                onFileChange={(f) => {
                  setUploadedFile(f);
                  setTranscribedText('');
                  setStatus('');
                  setProgress(null);
                }}
              />

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
                    <div className="mt-2 h-2 w-full rounded-full bg-subtle">
                      <div
                        className={`h-2 rounded-full transition-[width] ${
                          progress.percent >= 100 ? 'bg-emerald-600' : 'bg-foreground'
                        }`}
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                {!progress && status ? (
                  <div className="rounded-xl border border-card-border bg-card px-4 py-3">
                    <p className="text-sm text-muted-foreground">{status}</p>
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
